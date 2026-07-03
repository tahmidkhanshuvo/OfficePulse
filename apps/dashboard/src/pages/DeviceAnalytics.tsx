import { DashboardChrome } from "../components/DashboardChrome";

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

export function DeviceAnalytics({ onExit }: DeviceAnalyticsProps) {
  return (
    <DashboardChrome active="analytics" onExit={onExit}>
      <main className="pt-20 md:pl-64 md:h-screen md:overflow-hidden flex flex-col">
        <div className="flex-1 md:min-h-0 p-4 md:p-8 lg:p-12 flex flex-col gap-8 md:overflow-y-auto custom-scrollbar">
          {/* Header Section */}
          <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-subtle pb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-headline-md text-headline-md text-text-primary">
                  Work Room 1 - Light 2
                </h1>
                <span className="bg-surface-panel text-text-primary border border-border-subtle px-3 py-1 rounded-full font-label-caps text-label-caps flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#FF9D63] animate-pulse shadow-[0_0_8px_#FF9D63]" />
                  ON
                </span>
              </div>
              <p className="font-body-base text-body-base text-text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                Current Draw: 15W
              </p>
            </div>
            <div className="text-right">
              <p className="font-body-sm text-body-sm text-text-secondary">Last toggled by</p>
              <p className="font-body-base text-body-base text-text-primary font-semibold">
                Nafisa Rahman
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
                6.5{" "}
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
                0.09{" "}
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
                {BAR_PCT.map((pct, i) => {
                  const isPeak = pct === Math.max(...BAR_PCT);
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
        </div>
      </main>
    </DashboardChrome>
  );
}

export default DeviceAnalytics;
