import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ActivityItem, DeviceStatus, OfficeSnapshot, RoomSlug } from "../../../../packages/contracts/src";
import { DashboardChrome } from "../components/DashboardChrome";
import {
  commandDevice,
  emergencyShutdownOffice,
  getActivity,
  getCurrentMonthEnergy,
  getOfficeClosingChecklist,
  shutdownOffice,
  withControlRetry,
} from "../lib/api";
import { formatKwh, formatWatts } from "../lib/format";
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
      { id: "drawing-fan-1", label: "Fan 1", defaultOn: true },
      { id: "drawing-fan-2", label: "Fan 2", defaultOn: true },
      { id: "drawing-light-1", label: "Light 1", defaultOn: true },
      { id: "drawing-light-2", label: "Light 2", defaultOn: true },
      { id: "drawing-light-3", label: "Light 3", defaultOn: true },
    ],
  },
  {
    id: "work-room-1",
    slug: "work1",
    name: "Work Room 1",
    status: "active",
    icon: "meeting_room",
    drawLabel: "Current Draw",
    drawValue: "150W",
    tally: "2 Fans, 3 Lights ON",
    devices: [
      { id: "work1-fan-1", label: "Fan 1", defaultOn: true },
      { id: "work1-fan-2", label: "Fan 2", defaultOn: true },
      { id: "work1-light-1", label: "Light 1", defaultOn: true },
      { id: "work1-light-2", label: "Light 2", defaultOn: true },
      { id: "work1-light-3", label: "Light 3", defaultOn: true },
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
    tally: "0 Fans, 3 Lights ON",
    inactive: true,
    devices: [
      { id: "work2-fan-1", label: "Fan 1", defaultOn: false },
      { id: "work2-fan-2", label: "Fan 2", defaultOn: false },
      { id: "work2-light-1", label: "Light 1", defaultOn: true },
      { id: "work2-light-2", label: "Light 2", defaultOn: true },
      { id: "work2-light-3", label: "Light 3", defaultOn: true },
    ],
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
      drawValue: formatWatts(room.powerWatts),
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

function fallbackCurrentMonthBill(snapshot: OfficeSnapshot | null) {
  if (!snapshot) return [];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const elapsedMonthHours = Math.max(1, (Date.now() - monthStart.getTime()) / 3_600_000);
  const tariff = snapshot.energy.todayKwh > 0 ? snapshot.energy.estimatedCostToday / snapshot.energy.todayKwh : 12;
  return snapshot.rooms.map((room) => {
    const energyKwh = (room.powerWatts / 1000) * elapsedMonthHours;
    return {
      roomId: room.room.slug,
      roomName: room.room.name,
      powerWatts: room.powerWatts,
      energyKwh,
      cost: energyKwh * tariff,
    };
  });
}

function overviewActivityRows(activity: ActivityItem[], snapshot: OfficeSnapshot | null) {
  if (activity.length > 0) {
    return activity.map((item) => ({
      id: item.id,
      time: formatClock(item.occurredAt),
      message: item.message,
      actor: item.type.replace(/\./g, " "),
    }));
  }
  if (!snapshot) return [];
  const now = formatClock(snapshot.generatedAt);
  return [
    ...snapshot.alerts.map((alert) => ({
      id: `alert-${alert.id}`,
      time: formatClock(alert.updatedAt),
      message: alert.message,
      actor: "alert",
    })),
    {
      id: "office-current",
      time: now,
      message: `Office total power ${snapshot.energy.totalPowerWatts.toFixed(2)}W, today ${snapshot.energy.todayKwh.toFixed(2)} kWh.`,
      actor: "system",
    },
    ...snapshot.rooms.map((room) => ({
      id: `room-${room.room.slug}`,
      time: now,
      message: `${room.room.name}: ${room.activeDeviceCount} devices on, ${room.powerWatts.toFixed(2)}W, occupancy ${room.occupancy.state.replace("_", " ")}.`,
      actor: "sensor",
    })),
  ].slice(0, 6);
}

export function Overview({ onExit }: OverviewProps) {
  const { snapshot, error: snapshotError, refresh } = useOfficeSnapshot();
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [optimisticStatus, setOptimisticStatus] = useState<Record<string, DeviceStatus>>({});
  const [checklist, setChecklist] = useState<{
    rooms: Array<{ roomId: RoomSlug; devicesOn: number; alerts: number; readyToClose: boolean }>;
    readyToClose: boolean;
  } | null>(null);
  const [monthBill, setMonthBill] = useState<{
    currency: string;
    month: string;
    rooms: Array<{ roomId: RoomSlug; roomName: string; energyKwh: number; cost: number; powerWatts?: number }>;
    totalKwh: number;
    totalCost: number;
  } | null>(null);
  const rooms = useMemo(() => {
    const built = buildRooms(snapshot?.rooms);
    return built.map((room) => ({
      ...room,
      devices: room.devices.map((device) => ({
        ...device,
        status: optimisticStatus[device.id] ?? device.status,
        defaultOn: optimisticStatus[device.id] ? optimisticStatus[device.id] === "on" : device.defaultOn,
      })),
    }));
  }, [optimisticStatus, snapshot]);
  const currentMonthRooms = monthBill?.rooms ?? fallbackCurrentMonthBill(snapshot);
  const currentMonthTotal = monthBill?.totalCost ?? currentMonthRooms.reduce((total, room) => total + room.cost, 0);
  const currentMonthKwh = monthBill?.totalKwh ?? currentMonthRooms.reduce((total, room) => total + room.energyKwh, 0);
  const activityRows = useMemo(() => overviewActivityRows(activity, snapshot), [activity, snapshot]);

  useEffect(() => {
    getActivity()
      .then((next) => setActivity(next.items.slice(0, 6)))
      .catch(() => setActivity([]));
    getOfficeClosingChecklist()
      .then(setChecklist)
      .catch(() => setChecklist(null));
    getCurrentMonthEnergy()
      .then(setMonthBill)
      .catch(() => setMonthBill(null));
  }, [snapshot?.realtime.stateVersion]);

  const toggleDevice = async (deviceId: DeviceKey, next: boolean) => {
    setBusyId(deviceId);
    setOptimisticStatus((prev) => ({ ...prev, [deviceId]: next ? "on" : "off" }));
    try {
      await withControlRetry(() => commandDevice(deviceId, next ? "on" : "off"));
      await refresh();
    } finally {
      setBusyId(null);
      setOptimisticStatus((prev) => {
        const { [deviceId]: _device, ...rest } = prev;
        return rest;
      });
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

  const topNavCenter = snapshot ? (
    <>
      <div className="flex flex-col items-end gap-1">
        <span className="font-label-caps text-label-caps text-text-secondary uppercase">
          Total Office Power
        </span>
        <span className="font-metric-lg text-metric-lg gradient-sunset">
          {formatWatts(snapshot.energy.totalPowerWatts)}
        </span>
      </div>
      <div className="h-8 w-px bg-border-subtle" />
      <div className="flex flex-col items-end gap-1">
        <span className="font-label-caps text-label-caps text-text-secondary uppercase">
          Today
        </span>
        <span className="font-metric-lg text-metric-lg gradient-sunset">
          {formatKwh(snapshot.energy.todayKwh)}
        </span>
      </div>
    </>
  ) : undefined;

  return (
    <DashboardChrome active="overview" onExit={onExit} topNavCenter={topNavCenter}>
      {/* Main Content */}
      <main className="pt-20 md:pl-64 md:h-screen md:overflow-hidden flex flex-col">
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
              {snapshotError && (
                <p className="font-body-sm text-body-sm text-[#FF9D63] mt-2">
                  Showing fallback device layout until live office data loads.
                </p>
              )}
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
          <section className="mt-auto grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-4">
            <div className="bg-surface-panel rounded-xl border border-border-subtle p-4 min-h-[220px]">
              <div className="flex items-center gap-3 mb-4 border-b border-border-subtle pb-2">
                <Icon name="history" />
                <h3 className="font-headline-md text-headline-md text-text-primary">
                  Recent Activity Feed
                </h3>
              </div>
              <div className="space-y-3 max-h-[172px] overflow-y-auto pr-2 custom-scrollbar">
                {activityRows.map((row) => (
                  <div
                    key={row.id}
                    className="flex gap-4 items-start text-sm border-l border-white/20 pl-2 py-1"
                  >
                    <span className="font-metric-lg text-metric-lg text-text-secondary whitespace-nowrap w-20">
                      {row.time}
                    </span>
                    <span className="font-body-sm text-body-sm text-text-primary flex-1">
                      {row.message}
                    </span>
                    <span className="font-label-caps text-label-caps text-[#FF9D63] bg-surface-panel px-1 py-[2px] rounded uppercase border border-[#FF9D63]">
                      {row.actor}
                    </span>
                  </div>
                ))}
                {activityRows.length === 0 && (
                  <div className="py-8 text-center font-body-sm text-body-sm text-text-secondary">
                    Waiting for live activity...
                  </div>
                )}
              </div>
            </div>

            <div className="bg-surface-panel rounded-xl border border-border-subtle p-4 min-h-[220px]">
              <div className="flex items-center justify-between gap-3 mb-4 border-b border-border-subtle pb-2">
                <div className="flex items-center gap-3">
                  <Icon name="payments" />
                  <h3 className="font-headline-md text-headline-md text-text-primary">
                    Current Month Bill
                  </h3>
                </div>
                <span className="font-label-caps text-label-caps text-[#FF9D63] border border-[#FF9D63]/50 rounded-full px-2 py-1 uppercase">
                  Taka
                </span>
              </div>
              <div className="space-y-2">
                {(currentMonthRooms.length > 0 ? currentMonthRooms : rooms.map((room) => ({
                  roomId: room.slug,
                  roomName: room.name,
                  powerWatts: Number.parseFloat(room.drawValue) || 0,
                  energyKwh: 0,
                  cost: 0,
                }))).map((room) => (
                  <div key={room.roomId} className="rounded-lg border border-border-subtle bg-black/20 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-body-sm text-body-sm text-text-primary">{room.roomName}</span>
                      <span className="font-metric-lg text-[15px] leading-5 text-[#FF9D63]">
                        Tk {room.cost.toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between font-label-caps text-label-caps text-text-secondary uppercase">
                      <span>{"powerWatts" in room && typeof room.powerWatts === "number" ? formatWatts(room.powerWatts) : monthBill?.month ?? "month-to-date"}</span>
                      <span>{room.energyKwh.toFixed(2)} kWh used</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3">
                <span className="font-label-caps text-label-caps text-text-secondary uppercase">
                  Month-to-date total
                </span>
                <div className="text-right">
                  <span className="block font-metric-lg text-metric-lg text-text-primary">
                    Tk {currentMonthTotal.toFixed(2)}
                  </span>
                  <span className="block font-label-caps text-label-caps text-text-secondary uppercase">
                    {currentMonthKwh.toFixed(2)} kWh
                  </span>
                </div>
              </div>
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

      </main>
    </DashboardChrome>
  );
}

export default Overview;
