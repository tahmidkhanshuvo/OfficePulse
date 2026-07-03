import { useState, type CSSProperties } from "react";
import { DashboardChrome } from "../components/DashboardChrome";

type OverviewProps = {
  onExit?: () => void;
};

type DeviceKey = "lighting" | "accents" | "fan1" | "fan2" | "ws-a" | "display" | "ws-b";

type Room = {
  id: string;
  name: string;
  status: "active" | "standby";
  icon: string;
  drawLabel: string;
  drawValue: string;
  tally: string;
  inactive?: boolean;
  devices: { id: DeviceKey; label: string; defaultOn: boolean }[];
};

const ROOMS: Room[] = [
  {
    id: "drawing-room",
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

const ACTIVITY = [
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

const ALERTS = [
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

export function Overview({ onExit }: OverviewProps) {
  const [deviceState, setDeviceState] = useState<Record<string, Record<DeviceKey, boolean>>>(
    () =>
      ROOMS.reduce<Record<string, Record<DeviceKey, boolean>>>((acc, room) => {
        acc[room.id] = room.devices.reduce(
          (map, d) => {
            map[d.id] = d.defaultOn;
            return map;
          },
          {} as Record<DeviceKey, boolean>,
        );
        return acc;
      }, {}),
  );

  const toggleDevice = (roomId: string, deviceId: DeviceKey) => {
    setDeviceState((prev) => ({
      ...prev,
      [roomId]: { ...prev[roomId], [deviceId]: !prev[roomId][deviceId] },
    }));
  };

  return (
    <DashboardChrome active="overview" onExit={onExit}>
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
            {ROOMS.map((room) => {
              const roomDevices = deviceState[room.id];
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
                          checked={roomDevices[device.id]}
                          disabled={!!room.inactive}
                          onChange={() => toggleDevice(room.id, device.id)}
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
              {ACTIVITY.map((row) => (
                <div
                  key={`${row.time}-${row.message}`}
                  className="flex gap-4 items-start text-sm border-l border-white/20 pl-2 py-1"
                >
                  <span className="font-metric-lg text-metric-lg text-text-secondary whitespace-nowrap w-20">
                    {row.time}
                  </span>
                  <span className="font-body-sm text-body-sm text-text-primary flex-1">
                    {row.message}{" "}
                    {row.emphasis && (
                      <strong className="text-text-secondary">{row.emphasis}</strong>
                    )}
                  </span>
                  <span className="font-label-caps text-label-caps text-[#FF9D63] bg-surface-panel px-1 py-[2px] rounded uppercase border border-[#FF9D63]">
                    {row.actor}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Alerts Panel */}
        <aside className="w-full md:w-80 md:min-h-0 bg-surface-panel border-l border-border-subtle flex flex-col md:overflow-hidden">
          <div className="shrink-0 p-4 border-b border-border-subtle flex justify-between items-center  backdrop-blur-[20px] z-10">
            <h2 className="font-headline-md text-headline-md text-text-primary flex items-center gap-3">
              <span className="material-symbols-outlined">warning</span>
              Active Alerts
            </h2>
            <span className="font-label-caps text-label-caps bg-[#FF9D63] border border-[#FF9D63] text-black px-3 py-1 rounded-full">
              {ALERTS.length}
            </span>
          </div>
          <div className="flex-1 md:min-h-0 p-4 space-y-4 md:overflow-y-auto custom-scrollbar">
            {ALERTS.map((alert) => (
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
