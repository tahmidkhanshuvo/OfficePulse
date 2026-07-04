import { useMemo, useState } from "react";
import type { DeviceStatus, OccupancyState, RoomSlug } from "../../../../packages/contracts/src";
import { DashboardChrome } from "../components/DashboardChrome";
import { commandDevice, withControlRetry } from "../lib/api";
import { useOfficeSnapshot } from "../hooks/useOfficeSnapshot";

type MapProps = {
  onExit?: () => void;
};

type RoomId = "drawing" | "work1" | "work2";

const lightId = (room: RoomId, idx: number) => `${room}-light-${idx + 1}`;
const fanId = (room: RoomId, idx: number) => `${room}-fan-${idx + 1}`;

function LightDot({
  active,
  onClick,
  className,
}: {
  active: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      aria-pressed={active}
      aria-label={active ? "Light on" : "Light off"}
      className={`absolute w-5 h-5 rounded-full border z-20 cursor-pointer hover:scale-110 transition-transform ${
        active
          ? "glow-active border-[#FFCC00]"
          : "glow-inactive border-border-subtle"
      } ${className ?? ""}`}
    />
  );
}

export function Map({ onExit }: MapProps) {
  const { snapshot, refresh } = useOfficeSnapshot();
  const [optimisticStatus, setOptimisticStatus] = useState<Record<string, DeviceStatus>>({});
  const [busyDevice, setBusyDevice] = useState<string | null>(null);

  const deviceStatus = (deviceId: string): DeviceStatus =>
    optimisticStatus[deviceId] ??
    snapshot?.devices.find((device) => device.id === deviceId)?.state.status ??
    "unknown";

  const deviceIsOn = (deviceId: string) => deviceStatus(deviceId) === "on";

  const toggleLight = async (room: RoomId, idx: number) => {
    const deviceId = lightId(room, idx);
    const next = !deviceIsOn(deviceId);
    setBusyDevice(deviceId);
    setOptimisticStatus((prev) => ({ ...prev, [deviceId]: next ? "on" : "off" }));
    try {
      await withControlRetry(() => commandDevice(deviceId, next ? "on" : "off"));
      await refresh();
    } catch {
      setOptimisticStatus((prev) => ({ ...prev, [deviceId]: next ? "off" : "on" }));
    } finally {
      setBusyDevice(null);
      setOptimisticStatus((prev) => {
        const { [deviceId]: _device, ...rest } = prev;
        return rest;
      });
    }
  };

  const toggleFan = async (room: RoomId, idx: number) => {
    const deviceId = fanId(room, idx);
    const next = !deviceIsOn(deviceId);
    setBusyDevice(deviceId);
    setOptimisticStatus((prev) => ({ ...prev, [deviceId]: next ? "on" : "off" }));
    try {
      await withControlRetry(() => commandDevice(deviceId, next ? "on" : "off"));
      await refresh();
    } catch {
      setOptimisticStatus((prev) => ({ ...prev, [deviceId]: next ? "off" : "on" }));
    } finally {
      setBusyDevice(null);
      setOptimisticStatus((prev) => {
        const { [deviceId]: _device, ...rest } = prev;
        return rest;
      });
    }
  };

  const roomCounts = useMemo(() => {
    const fallback: Record<RoomSlug, { fans: number; lights: number }> = {
      drawing: { fans: 2, lights: 3 },
      work1: { fans: 2, lights: 3 },
      work2: { fans: 2, lights: 3 },
    };
    if (!snapshot) return fallback;
    return snapshot.rooms.reduce((acc, room) => {
      acc[room.room.slug] = {
        fans: room.devices.filter((device) => device.type === "fan").length,
        lights: room.devices.filter((device) => device.type === "light").length,
      };
      return acc;
    }, fallback);
  }, [snapshot]);

  const roomWise = [
    { id: "drawing", label: "Drawing Room", tint: "yellow" },
    { id: "work1", label: "Work Room 1", tint: "blue" },
    { id: "work2", label: "Work Room 2", tint: "green" },
  ] as const;

  const occupancyState = (room: RoomId): OccupancyState =>
    snapshot?.occupancy.find((item) => item.roomId === room)?.state ?? "unknown";

  const isOccupied = (room: RoomId) => {
    const state = occupancyState(room);
    return state === "occupied" || state === "recently_active";
  };

  const occupancyStyle = (room: RoomId) =>
    isOccupied(room)
      ? {
          backgroundColor: "rgba(34, 197, 94, 0.86)",
          borderColor: "rgba(74, 222, 128, 0.95)",
          borderStyle: "solid",
          boxShadow: "0 0 16px rgba(34, 197, 94, 0.65)",
        }
      : {
          backgroundColor: "rgba(255, 255, 255, 0.08)",
          borderColor: "rgba(255, 255, 255, 0.22)",
          borderStyle: "solid",
          boxShadow: "inset 0 0 5px rgba(255, 255, 255, 0.12)",
        };

  const occupancyLabel = (room: RoomId, label: string) =>
    `${label} occupancy: ${occupancyState(room).replace("_", " ")}`;

  return (
    <DashboardChrome active="map" onExit={onExit}>
      <main className="pt-20 md:pl-64 md:h-screen md:overflow-hidden flex flex-col">
        <div className="flex-1 md:min-h-0 p-4 md:p-8 lg:p-12 flex flex-col gap-8 md:overflow-y-auto custom-scrollbar">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-subtle pb-4 shrink-0">
            <div>
              <h1 className="font-headline-md text-headline-md text-text-primary">
                Office Layout (Top View)
              </h1>
              <p className="font-body-base text-body-base text-text-secondary mt-1">
                All rooms have 2 Fans and 3 Lights
              </p>
            </div>
            {/* Legend */}
            <div className="room-panel rounded-lg p-3 flex gap-4 items-center shadow-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full glow-active border border-[#FFCC00]" />
                <span className="font-label-caps text-label-caps text-text-secondary">
                  LIGHT ON
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full glow-inactive border border-border-subtle" />
                <span className="font-label-caps text-label-caps text-text-secondary">
                  LIGHT OFF
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-text-secondary spin-slow text-[20px]">
                  mode_fan
                </span>
                <span className="font-label-caps text-label-caps text-text-secondary">
                  FAN ACTIVE
                </span>
              </div>
            </div>
          </header>

          {/* Floorplan */}
          <section className="relative flex items-center justify-center min-h-[440px] py-6 pb-14 shrink-0">
            <div className="relative w-full max-w-[1000px] aspect-[16/10] bg-[#111] border border-outline-variant shadow-2xl rounded-sm">
              {/* External walls */}
              <div className="absolute inset-0 border-4 border-surface-variant pointer-events-none z-30" />

              {/* ===== DRAWING ROOM (Left) ===== */}
              <div className="absolute top-0 left-0 w-[30%] h-[75%] room-panel floor-grid-wood border-r-4 border-b-4 border-surface-variant">
                <div className="absolute top-4 left-4 font-label-caps text-label-caps text-text-secondary bg-black/50 px-2 py-1 rounded">
                  DRAWING ROOM
                </div>
                {/* Windows */}
                <div className="window-line top-0 left-[20%] w-[40%] -mt-[2px]" />
                <div className="window-line left-0 top-[20%] h-[20%] w-[4px] -ml-[2px]" />
                {/* Furniture */}
                <div className="sofa h-[40%] w-[30px] left-4 top-[30%] rounded-l-none border-l-0" />
                <div className="table-fp w-[40px] h-[60px] left-[50px] top-[40%]" />
                <div className="chair w-[35px] h-[35px] left-4 bottom-[10%] rounded-sm" />
                {/* Plants */}
                <div
                  aria-label={occupancyLabel("drawing", "Drawing Room")}
                  className="plant left-5 top-12"
                  role="img"
                  style={occupancyStyle("drawing")}
                  title={occupancyLabel("drawing", "Drawing Room")}
                />
                <div className="plant right-6 bottom-[9%]" />
                {/* Devices */}
                <LightDot
                  active={deviceIsOn(lightId("drawing", 0))}
                  onClick={() => toggleLight("drawing", 0)}
                  className={`top-[15%] left-[20%] ${busyDevice === lightId("drawing", 0) ? "opacity-50" : ""}`}
                />
                <LightDot
                  active={deviceIsOn(lightId("drawing", 1))}
                  onClick={() => toggleLight("drawing", 1)}
                  className={`top-[15%] right-[20%] ${busyDevice === lightId("drawing", 1) ? "opacity-50" : ""}`}
                />
                {/* Fans */}
                <button type="button" onClick={() => toggleFan("drawing", 0)} aria-label="Toggle Drawing Room Fan 1" className="absolute top-[15%] left-[50%] -translate-x-1/2 w-8 h-8 flex items-center justify-center z-20 hover:scale-110 transition-transform">
                  <span className={`material-symbols-outlined text-white text-[32px] drop-shadow-md ${deviceIsOn(fanId("drawing", 0)) ? "spin-slow opacity-80" : "opacity-30"} ${busyDevice === fanId("drawing", 0) ? "opacity-50" : ""}`}>
                    mode_fan
                  </span>
                </button>
                <button type="button" onClick={() => toggleFan("drawing", 1)} aria-label="Toggle Drawing Room Fan 2" className="absolute bottom-[20%] left-[50%] -translate-x-1/2 w-8 h-8 flex items-center justify-center z-20 hover:scale-110 transition-transform">
                  <span className={`material-symbols-outlined text-white text-[32px] drop-shadow-md ${deviceIsOn(fanId("drawing", 1)) ? "spin-slow opacity-80" : "opacity-30"} ${busyDevice === fanId("drawing", 1) ? "opacity-50" : ""}`}>
                    mode_fan
                  </span>
                </button>
                <LightDot
                  active={deviceIsOn(lightId("drawing", 2))}
                  onClick={() => toggleLight("drawing", 2)}
                  className={`bottom-[20%] left-[30%] ${busyDevice === lightId("drawing", 2) ? "opacity-50" : ""}`}
                />
                {/* Door */}
                <div className="absolute bottom-[-4px] right-[10%] w-[40px] h-[40px] z-40 bg-[#111]">
                  <div className="door-arc bottom-0 right-0 border-t border-l rounded-tl-full border-white/40" />
                  <div className="door-line bottom-0 left-0 w-[40px] h-[2px] bg-white/40 transform rotate-90 origin-bottom-left" />
                </div>
              </div>

              {/* ===== WORK ROOM 1 (Middle) ===== */}
              <div className="absolute top-0 left-[30%] w-[35%] h-[75%] room-panel floor-grid border-r-4 border-b-4 border-surface-variant">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 font-label-caps text-label-caps text-text-secondary bg-black/50 px-2 py-1 rounded whitespace-nowrap">
                  WORK ROOM 1
                </div>
                {/* Window */}
                <div className="window-line top-0 left-[30%] w-[40%] -mt-[2px]" />
                {/* Desks */}
                <div className="desk top-[25%] left-[10%]">
                  <div className="monitor bottom-2 right-2" />
                  <div className="keyboard bottom-2 left-2" />
                  <div
                    aria-label={occupancyLabel("work1", "Work Room 1")}
                    className="chair top-[110%] left-[30%]"
                    role="img"
                    style={occupancyStyle("work1")}
                    title={occupancyLabel("work1", "Work Room 1")}
                  />
                </div>
                <div className="desk top-[25%] right-[10%]">
                  <div className="monitor bottom-2 left-2" />
                  <div className="keyboard bottom-2 right-2" />
                  <div className="chair top-[110%] right-[30%]" />
                </div>
                <div className="desk bottom-[25%] left-[10%]">
                  <div className="monitor top-2 right-2" />
                  <div className="keyboard top-2 left-2" />
                  <div className="chair bottom-[110%] left-[30%]" />
                </div>
                <div className="desk bottom-[25%] right-[10%]">
                  <div className="monitor top-2 left-2" />
                  <div className="keyboard top-2 right-2" />
                  <div className="chair bottom-[110%] right-[30%]" />
                </div>
                {/* Devices */}
                <LightDot
                  active={deviceIsOn(lightId("work1", 0))}
                  onClick={() => toggleLight("work1", 0)}
                  className={`top-[10%] left-[15%] ${busyDevice === lightId("work1", 0) ? "opacity-50" : ""}`}
                />
                <LightDot
                  active={deviceIsOn(lightId("work1", 1))}
                  onClick={() => toggleLight("work1", 1)}
                  className={`top-[10%] right-[15%] ${busyDevice === lightId("work1", 1) ? "opacity-50" : ""}`}
                />
                <button type="button" onClick={() => toggleFan("work1", 0)} aria-label="Toggle Work Room 1 Fan 1" className="absolute top-[15%] left-[50%] -translate-x-1/2 w-8 h-8 flex items-center justify-center z-20 hover:scale-110 transition-transform">
                  <span className={`material-symbols-outlined text-white text-[32px] ${deviceIsOn(fanId("work1", 0)) ? "spin-slow opacity-80" : "opacity-30"} ${busyDevice === fanId("work1", 0) ? "opacity-50" : ""}`}>
                    mode_fan
                  </span>
                </button>
                <button type="button" onClick={() => toggleFan("work1", 1)} aria-label="Toggle Work Room 1 Fan 2" className="absolute bottom-[35%] left-[50%] -translate-x-1/2 w-8 h-8 flex items-center justify-center z-20 hover:scale-110 transition-transform">
                  <span className={`material-symbols-outlined text-white text-[32px] ${deviceIsOn(fanId("work1", 1)) ? "spin-slow opacity-80" : "opacity-30"} ${busyDevice === fanId("work1", 1) ? "opacity-50" : ""}`}>
                    mode_fan
                  </span>
                </button>
                <LightDot
                  active={deviceIsOn(lightId("work1", 2))}
                  onClick={() => toggleLight("work1", 2)}
                  className={`bottom-[15%] left-[50%] -translate-x-1/2 ${busyDevice === lightId("work1", 2) ? "opacity-50" : ""}`}
                />
                {/* Door */}
                <div className="absolute bottom-[-4px] left-[5%] w-[40px] h-[40px] z-40 bg-[#111]">
                  <div className="door-arc bottom-0 left-0 border-t border-r rounded-tr-full border-white/40" />
                  <div className="door-line bottom-0 right-0 w-[40px] h-[2px] bg-white/40 transform -rotate-90 origin-bottom-right" />
                </div>
              </div>

              {/* ===== WORK ROOM 2 (Right) ===== */}
              <div className="absolute top-0 right-0 w-[35%] h-[75%] room-panel floor-grid-wood border-b-4 border-surface-variant">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 font-label-caps text-label-caps text-text-secondary bg-black/50 px-2 py-1 rounded whitespace-nowrap">
                  WORK ROOM 2
                </div>
                {/* Windows */}
                <div className="window-line top-0 left-[30%] w-[40%] -mt-[2px]" />
                <div className="window-line right-0 top-[40%] h-[20%] w-[4px] -mr-[2px]" />
                {/* Desks */}
                <div className="desk top-[25%] left-[10%]">
                  <div className="monitor bottom-2 right-2" />
                  <div className="keyboard bottom-2 left-2" />
                  <div
                    aria-label={occupancyLabel("work2", "Work Room 2")}
                    className="chair top-[110%] left-[30%]"
                    role="img"
                    style={occupancyStyle("work2")}
                    title={occupancyLabel("work2", "Work Room 2")}
                  />
                </div>
                <div className="desk top-[25%] right-[10%]">
                  <div className="monitor bottom-2 left-2" />
                  <div className="keyboard bottom-2 right-2" />
                  <div className="chair top-[110%] right-[30%]" />
                </div>
                <div className="desk bottom-[25%] left-[10%]">
                  <div className="monitor top-2 right-2" />
                  <div className="keyboard top-2 left-2" />
                  <div className="chair bottom-[110%] left-[30%]" />
                </div>
                <div className="desk bottom-[25%] right-[10%]">
                  <div className="monitor top-2 left-2" />
                  <div className="keyboard top-2 right-2" />
                  <div className="chair bottom-[110%] right-[30%]" />
                </div>
                {/* Devices */}
                <LightDot
                  active={deviceIsOn(lightId("work2", 0))}
                  onClick={() => toggleLight("work2", 0)}
                  className={`top-[10%] left-[15%] ${busyDevice === lightId("work2", 0) ? "opacity-50" : ""}`}
                />
                <LightDot
                  active={deviceIsOn(lightId("work2", 1))}
                  onClick={() => toggleLight("work2", 1)}
                  className={`top-[10%] right-[15%] ${busyDevice === lightId("work2", 1) ? "opacity-50" : ""}`}
                />
                <button type="button" onClick={() => toggleFan("work2", 0)} aria-label="Toggle Work Room 2 Fan 1" className="absolute top-[15%] left-[50%] -translate-x-1/2 w-8 h-8 flex items-center justify-center z-20 hover:scale-110 transition-transform">
                  <span className={`material-symbols-outlined text-white text-[32px] ${deviceIsOn(fanId("work2", 0)) ? "spin-slow opacity-80" : "opacity-30"} ${busyDevice === fanId("work2", 0) ? "opacity-50" : ""}`}>
                    mode_fan
                  </span>
                </button>
                <button type="button" onClick={() => toggleFan("work2", 1)} aria-label="Toggle Work Room 2 Fan 2" className="absolute bottom-[35%] left-[50%] -translate-x-1/2 w-8 h-8 flex items-center justify-center z-20 hover:scale-110 transition-transform">
                  <span className={`material-symbols-outlined text-white text-[32px] ${deviceIsOn(fanId("work2", 1)) ? "spin-slow opacity-80" : "opacity-30"} ${busyDevice === fanId("work2", 1) ? "opacity-50" : ""}`}>
                    mode_fan
                  </span>
                </button>
                <LightDot
                  active={deviceIsOn(lightId("work2", 2))}
                  onClick={() => toggleLight("work2", 2)}
                  className={`bottom-[15%] left-[50%] -translate-x-1/2 ${busyDevice === lightId("work2", 2) ? "opacity-50" : ""}`}
                />
                {/* Door */}
                <div className="absolute bottom-[-4px] left-[5%] w-[40px] h-[40px] z-40 bg-[#111]">
                  <div className="door-arc bottom-0 left-0 border-t border-r rounded-tr-full border-white/40" />
                  <div className="door-line bottom-0 right-0 w-[40px] h-[2px] bg-white/40 transform -rotate-90 origin-bottom-right" />
                </div>
              </div>

              {/* ===== HALLWAY (Bottom) ===== */}
              <div className="absolute bottom-0 left-0 w-full h-[25%] room-panel floor-grid bg-surface-container-low">
                {/* Entry */}
                <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-[40px] h-[40px] z-40 bg-[#0A0A0A]">
                  <div className="door-arc top-0 right-0 border-b border-l rounded-bl-full border-white/40" />
                  <div className="door-line top-0 left-0 w-[40px] h-[2px] bg-white/40 transform -rotate-90 origin-top-left" />
                </div>
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 font-label-caps text-label-caps text-text-secondary flex flex-col items-center pointer-events-none">
                  <span className="material-symbols-outlined text-[16px] leading-none text-[#FF9D63]">
                    arrow_upward
                  </span>
                  <span className="mt-1 rounded bg-black/70 px-2 py-0.5 text-[10px] tracking-normal">
                    ENTRY
                  </span>
                </div>
                {/* Details */}
                <div className="plant left-8 top-1/2 -translate-y-1/2" />
                <div className="plant right-16 top-1/2 -translate-y-1/2" />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-8 bg-blue-500/20 border border-blue-400/40 rounded-sm" />
              </div>
            </div>
          </section>

          {/* Bottom Summary Panels */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 shrink-0">
            {/* Room wise */}
            <div className="room-panel rounded-lg p-4 border-t-2 border-[#FF9D63]">
              <h3 className="font-label-caps text-label-caps text-text-secondary mb-3">
                ROOM WISE DEVICES
              </h3>
              <div className="flex flex-wrap gap-2">
                {roomWise.map((r) => (
                  <div
                    key={r.id}
                    className={`p-2 rounded text-center min-w-[90px] border ${
                      r.tint === "yellow"
                        ? "bg-yellow-900/20 border-yellow-700/30"
                        : r.tint === "blue"
                          ? "bg-blue-900/20 border-blue-700/30"
                          : "bg-green-900/20 border-green-700/30"
                    }`}
                  >
                    <div
                      className={`font-label-caps text-[10px] mb-1 ${
                        r.tint === "yellow"
                          ? "text-yellow-500/80"
                          : r.tint === "blue"
                            ? "text-blue-400/80"
                            : "text-green-400/80"
                      }`}
                    >
                      {r.label.toUpperCase()}
                    </div>
                    <div className="font-body-sm text-text-primary text-[12px]">
                      {roomCounts[r.id].fans} Fans
                    </div>
                    <div className="font-body-sm text-text-primary text-[12px]">
                      {roomCounts[r.id].lights} Lights
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="room-panel rounded-lg p-4">
              <h3 className="font-label-caps text-label-caps text-text-secondary mb-3 border-b border-border-subtle pb-2">
                DEVICES SUMMARY
              </h3>
              <ul className="font-body-sm text-text-primary space-y-1 text-[13px]">
                <li className="flex justify-between">
                  <span>Rooms:</span>
                  <span className="font-metric-lg text-[14px]">3</span>
                </li>
                <li className="flex justify-between">
                  <span>Fans per room:</span>
                  <span className="font-metric-lg text-[14px]">2</span>
                </li>
                <li className="flex justify-between">
                  <span>Lights per room:</span>
                  <span className="font-metric-lg text-[14px]">3</span>
                </li>
                <li className="my-1 border-t border-white/5 pt-1" />
                <li className="flex justify-between text-[#FF9D63]">
                  <span>Total Fans:</span>
                  <span className="font-metric-lg text-[14px]">6</span>
                </li>
                <li className="flex justify-between text-[#FF9D63]">
                  <span>Total Lights:</span>
                  <span className="font-metric-lg text-[14px]">9</span>
                </li>
                <li className="flex justify-between font-bold mt-2 pt-2 border-t border-border-subtle">
                  <span>Total Devices:</span>
                  <span className="font-metric-lg text-[16px]">15</span>
                </li>
              </ul>
            </div>
          </section>
        </div>
      </main>
    </DashboardChrome>
  );
}

export default Map;
