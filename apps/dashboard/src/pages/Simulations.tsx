import { useEffect, useMemo, useState } from "react";
import type { Device, DeviceState, RoomSlug } from "../../../../packages/contracts/src";
import { DashboardChrome } from "../components/DashboardChrome";
import {
  commandDevice,
  getSimulatorScenarios,
  sendSimulatedDeviceTelemetry,
  sendSimulatedOccupancy,
  withControlRetry,
} from "../lib/api";
import { formatWatts } from "../lib/format";
import { useOfficeSnapshot } from "../hooks/useOfficeSnapshot";

type SimulationsProps = {
  onExit?: () => void;
};

type DeviceWithState = Device & { state: DeviceState };

const ROOM_LABELS: Record<RoomSlug, string> = {
  drawing: "Drawing Room",
  work1: "Work Room 1",
  work2: "Work Room 2",
};

export function Simulations({ onExit }: SimulationsProps) {
  const { snapshot, refresh } = useOfficeSnapshot();
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getSimulatorScenarios()
      .then((next) => setScenarios(next.scenarios))
      .catch(() => setScenarios(["normal-day", "after-hours-waste", "all-on-two-hours", "peak-load", "all-off"]));
  }, []);

  const rooms = useMemo(() => snapshot?.rooms ?? [], [snapshot]);

  const runScenario = async (scenario: string) => {
    if (!snapshot) return;
    setBusy(`scenario:${scenario}`);
    setMessage(null);
    try {
      const devices = snapshot.devices;
      if (scenario === "all-off") {
        await Promise.all(devices.map((device) => withControlRetry(() => commandDevice(device.id, "off"))));
      } else if (scenario === "peak-load" || scenario === "all-on-two-hours" || scenario === "normal-day") {
        await Promise.all(devices.map((device) => withControlRetry(() => commandDevice(device.id, "on"))));
        await Promise.all(rooms.map((room) => sendSimulatedOccupancy(room.room.slug, true)));
      } else if (scenario === "after-hours-waste") {
        const work2 = devices.filter((device) => device.roomId === "work2");
        await Promise.all(work2.map((device) => withControlRetry(() => commandDevice(device.id, "on"))));
        await setRoomVacant("work2", false);
      } else {
        await sendSimulatedDeviceTelemetry(
          devices.slice(0, 5).map((device) => ({
            deviceId: device.id,
            status: "on",
            powerWatts: device.ratedWatts,
          })),
        );
      }
      setMessage(`${scenario.replace(/-/g, " ")} applied.`);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const setRoomVacant = async (roomId: RoomSlug, showBusy = true) => {
    if (showBusy) setBusy(`occupancy:${roomId}:vacant`);
    setMessage(null);
    try {
      await sendSimulatedOccupancy(roomId, false);
      await sendSimulatedOccupancy(roomId, false);
      setMessage(`${ROOM_LABELS[roomId]} marked vacant.`);
      await refresh();
    } finally {
      if (showBusy) setBusy(null);
    }
  };

  const setRoomOccupied = async (roomId: RoomSlug) => {
    setBusy(`occupancy:${roomId}:occupied`);
    setMessage(null);
    try {
      await sendSimulatedOccupancy(roomId, true);
      setMessage(`${ROOM_LABELS[roomId]} marked occupied.`);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const toggleDevice = async (device: DeviceWithState) => {
    const next = device.state.status === "on" ? "off" : "on";
    setBusy(`device:${device.id}`);
    setMessage(null);
    try {
      await withControlRetry(() => commandDevice(device.id, next));
      setMessage(`${device.label} in ${ROOM_LABELS[device.roomId]} turned ${next}.`);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <DashboardChrome active="simulations" onExit={onExit}>
      <main className="pt-20 md:pl-64 md:h-screen md:overflow-hidden flex flex-col">
        <div className="flex-1 md:min-h-0 p-4 md:p-8 lg:p-12 flex flex-col gap-8 md:overflow-y-auto custom-scrollbar">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-subtle pb-4 shrink-0">
            <div>
              <h1 className="font-headline-md text-headline-md text-text-primary">Simulations</h1>
              <p className="font-body-base text-body-base text-text-secondary mt-1">
                Run test scenarios and manually change occupancy or device state.
              </p>
            </div>
            {message && (
              <span className="font-label-caps text-label-caps text-[#FF9D63] border border-[#FF9D63]/50 rounded-full px-3 py-1 uppercase">
                {message}
              </span>
            )}
          </header>

          <section className="bg-surface-panel border border-border-subtle rounded-xl p-4">
            <div className="flex items-center gap-3 mb-4 border-b border-border-subtle pb-3">
              <span className="material-symbols-outlined">science</span>
              <h2 className="font-headline-md text-headline-md text-text-primary">Scenarios</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {scenarios.map((scenario) => (
                <button
                  key={scenario}
                  type="button"
                  disabled={busy === `scenario:${scenario}`}
                  onClick={() => runScenario(scenario)}
                  className="text-left rounded-lg border border-border-subtle bg-black/20 px-4 py-3 hover:border-[#FF9D63]/60 hover:bg-[#FF9D63]/10 transition-colors disabled:opacity-50"
                >
                  <span className="block font-label-caps text-label-caps text-[#FF9D63] uppercase">
                    {scenario.replace(/-/g, " ")}
                  </span>
                  <span className="block font-body-sm text-body-sm text-text-secondary mt-1">
                    Apply simulated telemetry and occupancy state.
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {rooms.map((room) => {
              const devices = room.devices as DeviceWithState[];
              return (
                <div key={room.room.slug} className="bg-surface-panel border border-border-subtle rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 border-b border-border-subtle pb-3 mb-4">
                    <div>
                      <h3 className="font-headline-md text-headline-md text-text-primary">{room.room.name}</h3>
                      <p className="font-body-sm text-body-sm text-text-secondary">
                        {room.occupancy.state.replace("_", " ")} - {formatWatts(room.powerWatts)}
                      </p>
                    </div>
                    <span className="font-label-caps text-label-caps text-[#FF9D63] border border-[#FF9D63]/40 rounded-full px-2 py-1 uppercase">
                      {room.activeDeviceCount} on
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      type="button"
                      disabled={busy === `occupancy:${room.room.slug}:occupied`}
                      onClick={() => setRoomOccupied(room.room.slug)}
                      className="rounded border border-border-subtle px-3 py-2 font-label-caps text-label-caps uppercase text-text-secondary hover:text-[#FF9D63] hover:border-[#FF9D63]/50 disabled:opacity-50"
                    >
                      Occupied
                    </button>
                    <button
                      type="button"
                      disabled={busy === `occupancy:${room.room.slug}:vacant`}
                      onClick={() => setRoomVacant(room.room.slug)}
                      className="rounded border border-border-subtle px-3 py-2 font-label-caps text-label-caps uppercase text-text-secondary hover:text-[#FF9D63] hover:border-[#FF9D63]/50 disabled:opacity-50"
                    >
                      Vacant
                    </button>
                  </div>

                  <div className="space-y-2">
                    {devices.map((device) => (
                      <button
                        key={device.id}
                        type="button"
                        disabled={busy === `device:${device.id}`}
                        onClick={() => toggleDevice(device)}
                        className="w-full flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-black/20 px-3 py-2 hover:border-[#FF9D63]/50 transition-colors disabled:opacity-50"
                      >
                        <span>
                          <span className="block font-body-sm text-body-sm text-text-primary">{device.label}</span>
                          <span className="block font-label-caps text-label-caps text-text-secondary uppercase">{device.id}</span>
                        </span>
                        <span className={`font-label-caps text-label-caps rounded-full border px-2 py-1 uppercase ${
                          device.state.status === "on"
                            ? "text-[#FF9D63] border-[#FF9D63]/50"
                            : "text-text-secondary border-border-subtle"
                        }`}>
                          {device.state.status}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      </main>
    </DashboardChrome>
  );
}

export default Simulations;
