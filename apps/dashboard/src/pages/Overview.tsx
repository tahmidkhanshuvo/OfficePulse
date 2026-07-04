import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ActivityItem, Alert, DeviceStatus, OfficeSnapshot, RoomSlug } from "../../../../packages/contracts/src";
import { DashboardChrome } from "../components/DashboardChrome";
import {
  commandDevice,
  emergencyShutdownOffice,
  getActivity,
  getOfficeClosingChecklist,
  shutdownOffice,
  shutdownRoom,
  updateAlert,
  withControlRetry,
} from "../lib/api";
import { useOfficeSnapshot } from "../hooks/useOfficeSnapshot";

type OverviewProps = {
  onExit?: () => void;
};

type DeviceKey = string;

type Room = {
  id: string;
  slug: RoomSlug;
  name: string;
  status: "active" | "standby";
  icon: string;
  drawLabel: string;
  drawValue: string;
  tally: string;
  inactive?: boolean;
  devices: { id: DeviceKey; label: string; defaultOn: boolean; status?: DeviceStatus }[];
};

const ROOMS: Room[] = [
  {
    id: "drawing-room",
    slug: "drawing",
    name: "Drawing Room",
    status: "active",
    icon: "chair",
    drawLabel: "Current Draw",
    drawValue: "150W",
    tally: "2 Fans, 3 Lights ON",
    devices: [
      { id: "lighting", label: "Main Lighting", defaultOn: true },
      { id: "accents", label: "Accent Lights", defaultOn: false },
      { id: "fan1", label: "Ceiling Fan 1", defaultOn: true },
    ],
  },
  {
    id: "work-room-1",
    slug: "work1",
    name: "Work Room 1",
    status: "active",
    icon: "meeting_room",
    drawLabel: "Current Draw",
    drawValue: "210W",
    tally: "4 Workstations, 2 Displays ON",
    devices: [
      { id: "ws-a", label: "Workstation Group A", defaultOn: true },
      { id: "display", label: "Display Screen 1", defaultOn: true },
    ],
  },
  {
    id: "work-room-2",
    slug: "work2",
    name: "Work Room 2",
    status: "standby",
    icon: "meeting_room",
    drawLabel: "Standby Draw",
    drawValue: "5W",
    tally: "All devices OFF/Standby",
    inactive: true,
    devices: [{ id: "ws-b", label: "Workstation Group B", defaultOn: false }],
  },
];

const FALLBACK_ACTIVITY = [
  {
    time: "10:42 AM",
    message: "Drawing Room Fan 1 turned",
    emphasis: "OFF",
    actor: "System",
  },
  {
    time: "09:15 AM",
    message: "Work Room 1 Main Lighting turned",
    emphasis: "ON",
    actor: "User: Admin",
  },
  {
    time: "08:00 AM",
    message: "Scheduled Mode: 'Daytime Operations' activated.",
    actor: "Schedule",
  },
];

const FALLBACK_ALERTS = [
  {
    title: "Policy Violation",
    time: "10 mins ago",
    body: "Work Room 1: Device ON after 5 PM outside scheduled hours.",
    actions: [
      { label: "Acknowledge", variant: "outline" },
      { label: "Turn Off", variant: "solid" },
    ],
  },
  {
    title: "High Usage",
    time: "1 hr ago",
    body: "Drawing Room power draw exceeding expected baseline by 15%.",
    actions: [{ label: "Dismiss", variant: "outline" }],
  },
];

function PillToggle({
  checked,
  disabled,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <label
      className={`relative inline-flex items-center ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={ariaLabel}
      />
      <div
        className={`w-9 h-5 bg-surface-panel rounded-full border relative transition-colors duration-200
          ${disabled ? "border-border-subtle" : checked ? "bg-[#FF9D63] border-[#FF9D63]" : "border-border-subtle"}
          ${disabled ? "" : "peer-focus:outline-none"}
        `}
      >
        <div
          className={`absolute top-[1px] left-[1px] h-4 w-4 rounded-full transition-all duration-200
            ${checked && !disabled ? "translate-x-4 bg-white" : "bg-text-secondary"}
          `}
        />
      </div>
    </label>
  );
}

function Icon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined" data-icon={name}>
      {name}
    </span>
  );
}

function iconStyle(_active: boolean): CSSProperties {
  return { color: "#FF9D63" };
}

function formatClock(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatAlertTime(value: string): string {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(elapsed / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes} mins ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr${hours === 1 ? "" : "s"} ago`;
}

function roomIcon(slug: RoomSlug): string {
  return slug === "drawing" ? "chair" : "meeting_room";
}

function buildRooms(snapshotRooms: OfficeSnapshot["rooms"] | undefined): Room[] {
  if (!snapshotRooms) return ROOMS;
  return snapshotRooms.map((room) => {
    const fansOn = room.devices.filter((device) => device.type === "fan" && device.state.status === "on").length;
    const lightsOn = room.devices.filter((device) => device.type === "light" && device.state.status === "on").length;
    return {
      id: room.room.slug,
      slug: room.room.slug,
      name: room.room.name,
      status: room.activeDeviceCount > 0 ? "active" : "standby",
      icon: roomIcon(room.room.slug),
      drawLabel: room.activeDeviceCount > 0 ? "Current Draw" : "Standby Draw",
      drawValue: `${room.powerWatts}W`,
      tally: `${fansOn} Fans, ${lightsOn} Lights ON`,
      inactive: room.activeDeviceCount === 0,
      devices: room.devices.map((device) => ({
        id: device.id,
        label: device.label,
        defaultOn: device.state.status === "on",
        status: device.state.status,
      })),
    };
  });
}

export function Overview({ onExit }: OverviewProps) {
  const { snapshot, refresh } = useOfficeSnapshot();
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [hiddenAlertIds, setHiddenAlertIds] = useState<Set<string>>(() => new Set());
  const [checklist, setChecklist] = useState<{
    rooms: Array<{ roomId: RoomSlug; devicesOn: number; alerts: number; readyToClose: boolean }>;
    readyToClose: boolean;
  } | null>(null);
  const rooms = useMemo(() => buildRooms(snapshot?.rooms), [snapshot]);
  const alerts = (snapshot?.alerts ?? []).filter((alert) => alert.status === "active" && !hiddenAlertIds.has(alert.id));

  useEffect(() => {
    getActivity()
      .then((next) => setActivity(next.items.slice(-6).reverse()))
      .catch(() => setActivity([]));
    getOfficeClosingChecklist()
      .then(setChecklist)
      .catch(() => setChecklist(null));
  }, [snapshot?.realtime.stateVersion]);

  const toggleDevice = async (deviceId: DeviceKey, next: boolean) => {
    setBusyId(deviceId);
    try {
      await withControlRetry(() => commandDevice(deviceId, next ? "on" : "off"));
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleAlertAction = async (alert: Alert, action: "acknowledge" | "resolve" | "snooze" | "mute") => {
    setBusyId(alert.id);
    setAlertError(null);
    try {
      await withControlRetry(() => updateAlert(alert.id, action));
      setHiddenAlertIds((current) => new Set(current).add(alert.id));
      await refresh();
    } catch (cause) {
      setAlertError(cause instanceof Error ? cause.message : "Unable to update alert. Confirm the control PIN and try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleOfficeShutdown = async (emergency = false) => {
    setBusyId(emergency ? "office-emergency" : "office-shutdown");
    try {
      await withControlRetry(() => (emergency ? emergencyShutdownOffice() : shutdownOffice()));
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const shutdownAlertRoom = async (alert: Alert) => {
    if (!alert.roomId) return;
    setBusyId(alert.id);
    setAlertError(null);
    try {
      await withControlRetry(() => shutdownRoom(alert.roomId!));
      setHiddenAlertIds((current) => new Set(current).add(alert.id));
      await refresh();
    } catch (cause) {
      setAlertError(cause instanceof Error ? cause.message : "Unable to turn off room devices. Confirm the control PIN and try again.");
    } finally {
      setBusyId(null);
    }
  };

  const topNavCenter = snapshot ? (
    <>
      <div className="flex flex-col items-end gap-1">
        <span className="font-label-caps text-label-caps text-text-secondary uppercase">
          Total Office Power
        </span>
        <span className="font-metric-lg text-metric-lg gradient-sunset">
          {snapshot.energy.totalPowerWatts}W
        </span>
      </div>
      <div className="h-8 w-px bg-border-subtle" />
      <div className="flex flex-col items-end gap-1">
        <span className="font-label-caps text-label-caps text-text-secondary uppercase">
          Today
        </span>
        <span className="font-metric-lg text-metric-lg gradient-sunset">
          {snapshot.energy.todayKwh} kWh
        </span>
      </div>
    </>
  ) : undefined;

  return (
    <DashboardChrome active="overview" onExit={onExit} topNavCenter={topNavCenter}>
      {/* Main Content */}
      <main className="pt-20 md:pl-64 md:h-screen md:overflow-hidden flex flex-col md:flex-row">
        {/* Center canvas */}
        <div className="flex-1 md:min-h-0 p-4 md:p-8 lg:p-12 flex flex-col gap-8 md:overflow-y-auto custom-scrollbar">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-subtle pb-4 shrink-0">
            <div>
              <h1 className="font-headline-md text-headline-md text-text-primary">
                Live Environment
              </h1>
              <p className="font-body-base text-body-base text-text-secondary mt-1">
                Real-time power distribution and active device status across all primary zones.
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {rooms.map((room) => {
              const drawClass = room.inactive ? "text-text-secondary" : "text-text-primary";
              return (
                <div
                  key={room.id}
                  className={`bg-surface-panel border border-border-subtle rounded-xl p-4 flex flex-col relative overflow-hidden group transition-opacity duration-200 ${
                    room.inactive ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-surface-panel flex items-center justify-center border border-border-subtle">
                        <span className="material-symbols-outlined" style={iconStyle(!room.inactive)}>
                          {room.icon}
                        </span>
                      </div>
                      <div>
                        <h3
                          className={`font-headline-md text-headline-md ${
                            room.inactive ? "text-text-secondary" : "text-text-primary"
                          }`}
                        >
                          {room.name}
                        </h3>
                        <span className="font-label-caps text-label-caps text-text-secondary uppercase">
                          {room.status === "active" ? "Active Zone" : "Standby Zone"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-metric-lg text-metric-lg ${drawClass}`}>
                        {room.drawValue}
                      </div>
                      <div className="font-label-caps text-label-caps text-text-secondary uppercase">
                        {room.drawLabel}
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 relative z-10">
                    <div className="font-label-caps text-label-caps text-text-secondary mb-1 uppercase">
                      Device Tally
                    </div>
                    <div
                      className={`font-body-sm text-body-sm rounded-lg border border-border-subtle p-2 ${
                        room.inactive ? "text-text-secondary" : "text-text-primary"
                      } bg-surface-panel`}
                    >
                      {room.tally}
                    </div>
                  </div>

                  <div
                    className={`mt-auto space-y-3 relative z-10 border-t border-border-subtle pt-4 ${
                      room.inactive ? "opacity-50" : ""
                    }`}
                  >
                    {room.devices.map((device) => (
                      <div
                        key={device.id}
                        className={`flex justify-between items-center ${
                          room.inactive ? "text-text-secondary" : "text-text-primary"
                        }`}
                      >
                        <span className="font-body-sm text-body-sm">{device.label}</span>
                        <PillToggle
                          checked={device.status ? device.status === "on" : device.defaultOn}
                          disabled={busyId === device.id}
                          onChange={(next) => toggleDevice(device.id, next)}
                          ariaLabel={`${room.name} ${device.label}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent Activity Feed */}
          <section className="mt-auto bg-surface-panel rounded-xl border border-border-subtle p-4">
            <div className="flex items-center gap-3 mb-4 border-b border-border-subtle pb-2">
              <Icon name="history" />
              <h3 className="font-headline-md text-headline-md text-text-primary">
                Recent Activity Feed
              </h3>
            </div>
            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              {(activity.length > 0
                ? activity.map((item) => ({
                    time: formatClock(item.occurredAt),
                    message: item.message,
                    actor: item.type.replace(/\./g, " "),
                  }))
                : FALLBACK_ACTIVITY
              ).map((row) => (
                <div
                  key={`${row.time}-${row.message}`}
                  className="flex gap-4 items-start text-sm border-l border-white/20 pl-2 py-1"
                >
                  <span className="font-metric-lg text-metric-lg text-text-secondary whitespace-nowrap w-20">
                    {row.time}
                  </span>
                  <span className="font-body-sm text-body-sm text-text-primary flex-1">
                    {row.message}{" "}
                    {"emphasis" in row && typeof row.emphasis === "string" ? (
                      <strong className="text-text-secondary">{row.emphasis}</strong>
                    ) : null}
                  </span>
                  <span className="font-label-caps text-label-caps text-[#FF9D63] bg-surface-panel px-1 py-[2px] rounded uppercase border border-[#FF9D63]">
                    {row.actor}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-surface-panel rounded-xl border border-border-subtle p-4">
            <div className="flex items-center justify-between gap-3 mb-4 border-b border-border-subtle pb-2">
              <div className="flex items-center gap-3">
                <Icon name="fact_check" />
                <h3 className="font-headline-md text-headline-md text-text-primary">
                  Office Closing Checklist
                </h3>
              </div>
              <span
                className={`font-label-caps text-label-caps px-3 py-1 rounded-full border uppercase ${
                  checklist?.readyToClose
                    ? "text-[#FF9D63] border-[#FF9D63]"
                    : "text-text-secondary border-border-subtle"
                }`}
              >
                {checklist?.readyToClose ? "Ready" : "Review"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(checklist?.rooms ?? rooms.map((room) => ({
                roomId: room.slug,
                devicesOn: room.devices.filter((device) => device.status === "on" || device.defaultOn).length,
                alerts: 0,
                readyToClose: room.inactive ?? false,
              }))).map((room) => (
                <div key={room.roomId} className="border border-border-subtle rounded-lg p-3 bg-surface-panel">
                  <div className="font-label-caps text-label-caps text-text-secondary uppercase mb-2">
                    {room.roomId}
                  </div>
                  <div className="flex justify-between font-body-sm text-body-sm text-text-primary">
                    <span>Devices on</span>
                    <span>{room.devicesOn}</span>
                  </div>
                  <div className="flex justify-between font-body-sm text-body-sm text-text-primary">
                    <span>Alerts</span>
                    <span>{room.alerts}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-3 pt-4 mt-4 border-t border-border-subtle">
              <button
                type="button"
                disabled={busyId === "office-shutdown"}
                onClick={() => handleOfficeShutdown(false)}
                className="bg-surface-panel text-[#FF9D63] border border-[#FF9D63] px-3 py-2 rounded text-xs font-label-caps uppercase hover:bg-[#FF9D63]/10 transition-colors disabled:opacity-50"
              >
                Shutdown Office
              </button>
              <button
                type="button"
                disabled={busyId === "office-emergency"}
                onClick={() => handleOfficeShutdown(true)}
                className="bg-[#FF9D63] text-black px-3 py-2 rounded text-xs font-label-caps uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Emergency Shutdown
              </button>
            </div>
          </section>
        </div>

        {/* Right Alerts Panel */}
        <aside className="w-full md:w-96 md:min-h-0 bg-surface-panel border-l border-border-subtle flex flex-col md:overflow-hidden">
          <div className="shrink-0 p-4 border-b border-border-subtle flex justify-between items-center  backdrop-blur-[20px] z-10">
            <h2 className="font-headline-md text-headline-md text-text-primary flex items-center gap-3">
              <span className="material-symbols-outlined">warning</span>
              Active Alerts
            </h2>
            <span className="font-label-caps text-label-caps bg-[#FF9D63] border border-[#FF9D63] text-black px-3 py-1 rounded-full">
              {alerts.length || FALLBACK_ALERTS.length}
            </span>
          </div>
          <div className="flex-1 md:min-h-0 p-4 space-y-4 md:overflow-y-auto custom-scrollbar">
            {alertError && (
              <p className="font-body-sm text-body-sm text-[#FF9D63] border border-[#FF9D63]/40 bg-[#FF9D63]/10 rounded-lg px-3 py-2">
                {alertError}
              </p>
            )}
            {(alerts.length > 0 ? alerts : []).map((alert) => (
              <div
                key={alert.id}
                className="bg-surface-panel border border-border-subtle rounded-lg p-3"
              >
                <div className="flex justify-between items-start gap-3 mb-1">
                  <span className="font-label-caps text-label-caps text-text-primary uppercase font-bold min-w-0 break-words">
                    {alert.title}
                  </span>
                  <span className="font-metric-lg text-metric-lg text-text-secondary shrink-0">
                    {formatAlertTime(alert.createdAt)}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-text-secondary mb-3">
                  {alert.message}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busyId === alert.id}
                    onClick={() => handleAlertAction(alert, "acknowledge")}
                    className="w-full bg-surface-panel text-[#FF9D63] border border-[#FF9D63] px-2 py-2 rounded text-xs font-label-caps uppercase hover:bg-[#FF9D63]/10 transition-colors disabled:opacity-50"
                  >
                    Acknowledge
                  </button>
                  <button
                    type="button"
                    disabled={busyId === alert.id}
                    onClick={() => (alert.roomId ? shutdownAlertRoom(alert) : handleAlertAction(alert, "resolve"))}
                    className="w-full bg-[#FF9D63] text-black px-2 py-2 rounded text-xs font-label-caps uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {alert.roomId ? "Turn Off" : "Resolve"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === alert.id}
                    onClick={() => handleAlertAction(alert, "snooze")}
                    className="w-full bg-surface-panel text-text-secondary border border-border-subtle px-2 py-2 rounded text-xs font-label-caps uppercase hover:text-[#FF9D63] hover:border-[#FF9D63]/50 transition-colors disabled:opacity-50"
                  >
                    Snooze
                  </button>
                  <button
                    type="button"
                    disabled={busyId === alert.id}
                    onClick={() => handleAlertAction(alert, "mute")}
                    className="w-full bg-surface-panel text-text-secondary border border-border-subtle px-2 py-2 rounded text-xs font-label-caps uppercase hover:text-[#FF9D63] hover:border-[#FF9D63]/50 transition-colors disabled:opacity-50"
                  >
                    Mute
                  </button>
                </div>
              </div>
            ))}
            {alerts.length === 0 &&
              FALLBACK_ALERTS.map((alert) => (
                <div
                  key={alert.title}
                  className="bg-surface-panel border border-border-subtle rounded-lg p-3"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-label-caps text-label-caps text-text-primary uppercase font-bold">
                      {alert.title}
                    </span>
                    <span className="font-metric-lg text-metric-lg text-text-secondary">
                      {alert.time}
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-text-secondary mb-3">
                    {alert.body}
                  </p>
                  <div className="flex gap-3">
                    {alert.actions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        className={
                          action.variant === "solid"
                            ? "bg-[#FF9D63] text-black px-3 py-1 rounded text-xs font-label-caps uppercase hover:opacity-90 transition-opacity"
                            : "bg-surface-panel text-[#FF9D63] border border-[#FF9D63] px-3 py-1 rounded text-xs font-label-caps uppercase hover:bg-[#FF9D63]/10 transition-colors"
                        }
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </aside>
      </main>
    </DashboardChrome>
  );
}

export default Overview;
