import { useEffect, useMemo, useState } from "react";
import { DashboardChrome } from "../components/DashboardChrome";
import type { ActivityItem, RoomSlug } from "../../../../packages/contracts/src";
import {
  getBillForecast,
  getDeviceHistory,
  getDeviceMaintenance,
  getDeviceUsage,
  getEnergyCarbon,
  getEnergyHistory,
  getEnergyRankings,
  getEnergySavings,
} from "../lib/api";
import { useOfficeSnapshot } from "../hooks/useOfficeSnapshot";

type DeviceAnalyticsProps = {
  onExit?: () => void;
};

const BAR_PCT = [20, 50, 90, 30, 10, 60, 40];

const TIME_LABELS = ["08:00", "12:00", "16:00"];

function Icon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined" data-icon={name}>
      {name}
    </span>
  );
}

function deviceDisplayName(device: { roomId: string; label: string } | undefined): string {
  if (!device) return "Work Room 1 - Light 2";
  return `${device.roomId} - ${device.label}`;
}

export function DeviceAnalytics({ onExit }: DeviceAnalyticsProps) {
  const { snapshot } = useOfficeSnapshot();
  const [selectedDeviceId, setSelectedDeviceId] = useState("work1-light-2");
  const [deviceMenuOpen, setDeviceMenuOpen] = useState(false);
  const selectedDevice = useMemo(
    () => snapshot?.devices.find((device) => device.id === selectedDeviceId) ?? snapshot?.devices[0],
    [selectedDeviceId, snapshot],
  );
  const [usage, setUsage] = useState<{
    powerWatts: number;
    todayKwh: number;
    estimatedCostToday: number;
  } | null>(null);
  const [historyBars, setHistoryBars] = useState(BAR_PCT);
  const [energyStats, setEnergyStats] = useState<{
    carbon?: { energyKwh: number; kgCo2e: number; factor: number };
    savings?: { estimatedKwhSaved: number; estimatedCostSaved: number; evidence: string };
    forecast?: { monthEndCost: number; currency: string; confidence: string };
    rankings?: {
      rooms: Array<{ roomId: RoomSlug; name: string; powerWatts: number }>;
      devices: Array<{ deviceId: string; label: string; roomId: RoomSlug; powerWatts: number }>;
    };
  }>({});
  const [maintenance, setMaintenance] = useState<{
    status: string;
    runtimeHours: number;
    recommendations: string[];
  } | null>(null);
  const [deviceHistory, setDeviceHistory] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!selectedDevice) return;
    getDeviceUsage(selectedDevice.id)
      .then((next) => setUsage(next))
      .catch(() => setUsage(null));
    getDeviceMaintenance(selectedDevice.id)
      .then(setMaintenance)
      .catch(() => setMaintenance(null));
    getDeviceHistory(selectedDevice.id)
      .then((next) => setDeviceHistory(next.items.slice(-4).reverse()))
      .catch(() => setDeviceHistory([]));
  }, [selectedDevice]);

  useEffect(() => {
    getEnergyHistory()
      .then((history) => {
        const max = Math.max(...history.points.map((point) => point.powerWatts), 1);
        const points = history.points.map((point) => Math.max(8, Math.round((point.powerWatts / max) * 100)));
        if (points.length > 0) setHistoryBars(points);
      })
      .catch(() => setHistoryBars(BAR_PCT));
  }, []);

  useEffect(() => {
    Promise.allSettled([getEnergyCarbon(), getEnergySavings(), getBillForecast(), getEnergyRankings()]).then(
      ([carbon, savings, forecast, rankings]) => {
        setEnergyStats({
          carbon: carbon.status === "fulfilled" ? carbon.value : undefined,
          savings: savings.status === "fulfilled" ? savings.value : undefined,
          forecast: forecast.status === "fulfilled" ? forecast.value : undefined,
          rankings: rankings.status === "fulfilled" ? rankings.value : undefined,
        });
      },
    );
  }, []);

  return (
    <DashboardChrome active="analytics" onExit={onExit}>
      <main className="pt-20 md:pl-64 md:h-screen md:overflow-hidden flex flex-col">
        <div className="flex-1 md:min-h-0 p-4 md:p-8 lg:p-12 flex flex-col gap-8 md:overflow-y-auto custom-scrollbar">
          {/* Header Section */}
          <section className="flex flex-col gap-4 border-b border-border-subtle pb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="relative inline-flex items-center">
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={deviceMenuOpen}
                    onClick={() => setDeviceMenuOpen((open) => !open)}
                    className="inline-flex items-center gap-2 border border-transparent rounded-md py-0 pl-0 pr-1 font-headline-md text-headline-md text-text-primary hover:border-border-subtle focus:border-[#FF9D63] focus:outline-none transition-colors"
                  >
                    <span>{deviceDisplayName(selectedDevice)}</span>
                    <span className="material-symbols-outlined text-[20px] text-text-secondary">
                      expand_more
                    </span>
                  </button>
                  {deviceMenuOpen && (
                    <div
                      role="listbox"
                      className="absolute left-0 top-full mt-2 z-50 w-72 max-h-72 overflow-y-auto custom-scrollbar rounded-lg border border-border-subtle bg-bg-deep shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-1"
                    >
                      {(snapshot?.devices ?? []).map((device) => {
                        const active = device.id === selectedDevice?.id;
                        return (
                          <button
                            key={device.id}
                            type="button"
                            role="option"
                            aria-selected={active}
                            onClick={() => {
                              setSelectedDeviceId(device.id);
                              setDeviceMenuOpen(false);
                            }}
                            className={
                              active
                                ? "w-full text-left rounded-md px-3 py-2 bg-surface-panel border border-border-subtle text-text-primary"
                                : "w-full text-left rounded-md px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-surface-panel transition-colors"
                            }
                          >
                            <span className="block font-body-base text-body-base">
                              {deviceDisplayName(device)}
                            </span>
                            <span className="block font-label-caps text-label-caps uppercase">
                              {device.id}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <span className="bg-surface-panel text-text-primary border border-border-subtle px-3 py-1 rounded-full font-label-caps text-label-caps flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#FF9D63] animate-pulse shadow-[0_0_8px_#FF9D63]" />
                  {(selectedDevice?.state.status ?? "on").toUpperCase()}
                </span>
              </div>
              <p className="font-body-base text-body-base text-text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                Current Draw: {usage?.powerWatts ?? selectedDevice?.state.powerWatts ?? 15}W
              </p>
            </div>
          </section>

          {/* Metrics Row */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface-panel backdrop-blur-xl p-4 rounded-xl border border-border-subtle relative overflow-hidden group hover:border-[#FF9D63]/50 transition-colors">
              <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-[#FF9D63] text-4xl">timer</span>
              </div>
              <h3 className="font-label-caps text-label-caps text-text-secondary mb-1">
                Total Uptime Today
              </h3>
              <div className="font-metric-lg text-metric-lg text-text-primary tabular-nums tracking-tighter">
                {selectedDevice?.state.status === "on" ? "8" : "0"}{" "}
                <span className="font-body-sm text-body-sm text-text-secondary ml-1">Hours</span>
              </div>
            </div>
            <div className="bg-surface-panel backdrop-blur-xl p-4 rounded-xl border border-border-subtle relative overflow-hidden group hover:border-[#FF9D63]/50 transition-colors">
              <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-[#FF9D63] text-4xl">
                  electric_meter
                </span>
              </div>
              <h3 className="font-label-caps text-label-caps text-text-secondary mb-1">
                Energy Consumed Today
              </h3>
              <div className="font-metric-lg text-metric-lg text-text-primary tabular-nums tracking-tighter">
                {usage?.todayKwh ?? "0.09"}{" "}
                <span className="font-body-sm text-body-sm text-text-secondary ml-1">kWh</span>
              </div>
            </div>
          </section>

          {/* Charts Section */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
            {/* Usage Frequency Bar Chart */}
            <div className="lg:col-span-4 bg-surface-panel backdrop-blur-xl p-4 rounded-xl border border-border-subtle flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-label-caps text-label-caps text-text-secondary">
                  Usage Frequency
                </h3>
                <span className="material-symbols-outlined text-sm cursor-pointer transition-colors">
                  open_in_full
                </span>
              </div>
              <div className="flex-1 flex items-end gap-1 h-48 border-b border-border-subtle pb-1">
                {historyBars.map((pct, i) => {
                  const isPeak = pct === Math.max(...historyBars);
                  return (
                    <div
                      key={i}
                      className={`w-full rounded-t-sm relative group transition-colors ${
                        isPeak
                          ? "bg-accent-orange shadow-[0_0_10px_rgba(255,157,99,0.3)] hover:opacity-90"
                          : "bg-surface-container-high/50 hover:bg-surface-container-high"
                      }`}
                      style={{ height: `${pct}%` }}
                    >
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-surface-container-highest px-1 py-[2px] rounded text-[10px] hidden group-hover:block border border-border-subtle text-text-primary z-10">
                        {pct}%
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-text-secondary font-label-caps text-label-caps">
                {TIME_LABELS.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </div>

            {/* Energy Consumption Line Graph */}
            <div className="lg:col-span-8 bg-surface-panel backdrop-blur-xl p-4 rounded-xl border border-border-subtle flex flex-col relative overflow-hidden">
              <div className="flex justify-between items-center mb-4 z-10">
                <h3 className="font-label-caps text-label-caps text-text-secondary">
                  Energy Consumption (24h)
                </h3>
                <span className="material-symbols-outlined text-sm cursor-pointer transition-colors">
                  open_in_full
                </span>
              </div>
              <div className="flex-1 w-full h-full relative z-0 min-h-[200px]">
                <svg
                  className="absolute inset-0 w-full h-full"
                  preserveAspectRatio="none"
                  viewBox="0 0 100 100"
                >
                  {/* Grid lines */}
                  <line
                    stroke="rgba(255,255,255,0.1)"
                    strokeDasharray="2,2"
                    strokeWidth="0.5"
                    x1="0"
                    x2="100"
                    y1="25"
                    y2="25"
                  />
                  <line
                    stroke="rgba(255,255,255,0.1)"
                    strokeDasharray="2,2"
                    strokeWidth="0.5"
                    x1="0"
                    x2="100"
                    y1="50"
                    y2="50"
                  />
                  <line
                    stroke="rgba(255,255,255,0.1)"
                    strokeDasharray="2,2"
                    strokeWidth="0.5"
                    x1="0"
                    x2="100"
                    y1="75"
                    y2="75"
                  />

                  {/* Area fill */}
                  <path
                    d="M0,80 Q10,70 20,75 T40,60 T60,80 T80,40 T100,50 L100,100 L0,100 Z"
                    fill="#FF9D63"
                    opacity="0.15"
                  />

                  {/* Line */}
                  <path
                    d="M0,80 Q10,70 20,75 T40,60 T60,80 T80,40 T100,50"
                    fill="none"
                    stroke="#FF9D63"
                    strokeWidth="2.5"
                    style={{ filter: "drop-shadow(0 0 6px rgba(255,157,99,0.5))" }}
                  />

                  {/* Data points */}
                  <circle cx="20" cy="75" fill="#FF9D63" r="2.5" />
                  <circle cx="40" cy="60" fill="#FF9D63" r="2.5" />
                  <circle cx="60" cy="80" fill="#FF9D63" r="2.5" />
                  <circle cx="80" cy="40" fill="#FF9D63" r="2.5" />
                </svg>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <MetricPanel
              icon="co2"
              label="Carbon Today"
              value={`${energyStats.carbon?.kgCo2e ?? "0.000"} kg`}
              detail={`${energyStats.carbon?.energyKwh ?? 0} kWh tracked`}
            />
            <MetricPanel
              icon="savings"
              label="Savings"
              value={`${energyStats.savings?.estimatedKwhSaved ?? 0} kWh`}
              detail={energyStats.savings?.evidence ?? "No completed automation savings yet."}
            />
            <MetricPanel
              icon="payments"
              label="Bill Forecast"
              value={`${energyStats.forecast?.monthEndCost ?? 0} ${energyStats.forecast?.currency ?? "BDT"}`}
              detail={energyStats.forecast?.confidence ?? "demo-estimate"}
            />
            <MetricPanel
              icon="health_and_safety"
              label="Maintenance"
              value={(maintenance?.status ?? "ok").toUpperCase()}
              detail={`${maintenance?.runtimeHours ?? 0} runtime hours`}
            />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-surface-panel backdrop-blur-xl p-4 rounded-xl border border-border-subtle">
              <h3 className="font-label-caps text-label-caps text-text-secondary mb-3">
                Power Rankings
              </h3>
              <div className="space-y-2">
                {(energyStats.rankings?.devices.slice(0, 5) ?? []).map((device) => (
                  <div key={device.deviceId} className="flex items-center justify-between gap-3 border border-border-subtle rounded-lg px-3 py-2">
                    <div>
                      <div className="font-body-sm text-body-sm text-text-primary">{device.label}</div>
                      <div className="font-label-caps text-label-caps text-text-secondary uppercase">{device.roomId}</div>
                    </div>
                    <div className="font-metric-lg text-metric-lg text-[#FF9D63]">{device.powerWatts}W</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-panel backdrop-blur-xl p-4 rounded-xl border border-border-subtle">
              <h3 className="font-label-caps text-label-caps text-text-secondary mb-3">
                Device History &amp; Recommendations
              </h3>
              <div className="space-y-2 mb-4">
                {(deviceHistory.length > 0 ? deviceHistory : []).map((item) => (
                  <div key={item.id} className="border border-border-subtle rounded-lg px-3 py-2">
                    <div className="font-body-sm text-body-sm text-text-primary">{item.message}</div>
                    <div className="font-label-caps text-label-caps text-text-secondary uppercase">
                      {new Date(item.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
                {deviceHistory.length === 0 && (
                  <div className="font-body-sm text-body-sm text-text-secondary border border-border-subtle rounded-lg px-3 py-2">
                    No device-specific history yet.
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {(maintenance?.recommendations.length ? maintenance.recommendations : ["No maintenance action required."]).map((item) => (
                  <span key={item} className="font-label-caps text-label-caps text-[#FF9D63] border border-[#FF9D63]/50 rounded-full px-3 py-1 uppercase">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </DashboardChrome>
  );
}

function MetricPanel({
  icon,
  label,
  value,
  detail,
}: {
  icon: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-surface-panel backdrop-blur-xl p-4 rounded-xl border border-border-subtle relative overflow-hidden">
      <span className="material-symbols-outlined absolute right-3 top-3 text-[#FF9D63] opacity-30">
        {icon}
      </span>
      <h3 className="font-label-caps text-label-caps text-text-secondary mb-1">{label}</h3>
      <div className="font-metric-lg text-metric-lg text-text-primary">{value}</div>
      <p className="font-body-sm text-body-sm text-text-secondary mt-1 line-clamp-2">{detail}</p>
    </div>
  );
}

export default DeviceAnalytics;
