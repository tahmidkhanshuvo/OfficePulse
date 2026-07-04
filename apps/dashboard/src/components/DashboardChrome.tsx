import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import type { Alert } from "../../../../packages/contracts/src";
import { useOfficeSnapshot } from "../hooks/useOfficeSnapshot";
import { getAlerts, updateAlert, withControlRetry } from "../lib/api";
import { formatKwh, formatWatts } from "../lib/format";
import { BrandMark } from "./BrandMark";

type Section = "overview" | "map" | "analytics" | "simulations" | "logs" | "settings";

export type DashboardChromeProps = {
  onExit?: () => void;
  /** Which sidebar entry is active. */
  active?: Section;
  /** Top nav center content (defaults to the metric chips). */
  topNavCenter?: ReactNode;
  children: ReactNode;
};

function Icon({ name, fill = false }: { name: string; fill?: boolean }) {
  return (
    <span className={`material-symbols-outlined${fill ? " fill" : ""}`} data-icon={name}>
      {name}
    </span>
  );
}

function iconStyle(active: boolean): CSSProperties {
  return active ? { color: "#fff" } : { color: "var(--text-secondary, #888)" };
}

const SIDEBAR_ITEMS: { id: Section; label: string; icon: string; href: string }[] = [
  { id: "overview", label: "Dashboard Overview", icon: "dashboard", href: "#/overview" },
  { id: "map", label: "Interactive Map", icon: "map", href: "#/map" },
  { id: "analytics", label: "Device Analytics", icon: "analytics", href: "#/analytics" },
  { id: "simulations", label: "Simulations", icon: "science", href: "#/simulations" },
];

const FOOTER_ITEMS: { id: Section; label: string; icon: string; href: string }[] = [
  { id: "logs", label: "System Logs", icon: "history", href: "#/logs" },
  { id: "settings", label: "Settings", icon: "settings", href: "#/settings" },
];

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="font-label-caps text-label-caps text-text-secondary uppercase">
        {label}
      </span>
      <span
        className="font-metric-lg text-metric-lg gradient-sunset"
        style={{ backgroundImage: "var(--gradient-sunset)" }}
      >
        {value}
      </span>
    </div>
  );
}

export function DashboardChrome({
  onExit,
  active = "overview",
  topNavCenter,
  children,
}: DashboardChromeProps) {
  const { snapshot } = useOfficeSnapshot();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const activeAlerts = alerts.filter((alert) => alert.status === "active");

  useEffect(() => {
    const refreshAlerts = () => {
      getAlerts()
        .then((next) => setAlerts(next.alerts))
        .catch(() => setAlerts([]));
    };
    refreshAlerts();
    const timer = window.setInterval(refreshAlerts, 15000);
    window.addEventListener("focus", refreshAlerts);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshAlerts);
    };
  }, []);

  useEffect(() => {
    if (snapshot?.alerts) setAlerts(snapshot.alerts);
  }, [snapshot?.alerts]);

  const handleAlertAction = async (alertId: string, action: "resolve" | "snooze" | "forget") => {
    const updated = await withControlRetry(() => updateAlert(alertId, action));
    setAlerts((current) =>
      current.map((alert) =>
        alert.id === alertId
          ? { ...alert, ...updated }
          : alert,
      ),
    );
  };
  const center =
    topNavCenter ?? (
      <>
        <MetricChip label="Total Office Power" value={snapshot ? formatWatts(snapshot.energy.totalPowerWatts) : "450W"} />
        <div className="h-8 w-px bg-border-subtle" />
        <MetricChip label="Today" value={snapshot ? formatKwh(snapshot.energy.todayKwh) : "12.4 kWh"} />
      </>
    );

  return (
    <div className="min-h-screen bg-bg-deep text-text-primary antialiased font-body-base text-body-base overflow-x-hidden">
      {/* TopNavBar */}
      <nav
        role="navigation"
        className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 h-20 bg-surface-panel border-b border-border-subtle backdrop-blur-[20px]"
      >
        <div className="flex items-center gap-4">
          <a href="#/overview" aria-label="OfficePulse home" className="flex items-center">
            <BrandMark className="h-10 w-auto select-none" width={160} height={110} />
          </a>
          <span className="hidden md:inline-flex font-label-caps text-label-caps text-text-secondary uppercase border border-border-subtle bg-surface-panel rounded-full px-2 py-0.5">
            Admin Console
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8">{center}</div>

        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-1 px-3 py-1 bg-surface-panel rounded-full border border-border-subtle">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            <span className="font-label-caps text-label-caps text-text-secondary uppercase">
              ONLINE
            </span>
          </div>
          <div className="relative flex gap-3">
            <button
              type="button"
              aria-label="Alerts"
              title="Alerts"
              onClick={() => setAlertsOpen((open) => !open)}
              className="relative p-1 text-text-secondary hover:text-text-primary transition-colors duration-200 active:scale-95"
            >
              <Icon name="notifications" />
              {activeAlerts.length > 0 && (
                <span className="absolute -right-1 -top-1 min-w-4 h-4 rounded-full bg-[#FF9D63] text-black text-[10px] leading-4 text-center font-label-caps">
                  {activeAlerts.length}
                </span>
              )}
            </button>
            <a
              href="#/overview"
              aria-label="Overview"
              title="Overview"
              className="p-1 text-text-secondary hover:text-text-primary transition-colors duration-200 active:scale-95"
            >
              <Icon name="bolt" />
            </a>
            <a
              href="#/analytics"
              aria-label="Analytics"
              title="Analytics"
              className="p-1 text-text-secondary hover:text-text-primary transition-colors duration-200 active:scale-95"
            >
              <Icon name="query_stats" />
            </a>
            <a
              href="#/map"
              aria-label="Map"
              title="Map"
              className="p-1 text-text-secondary hover:text-text-primary transition-colors duration-200 active:scale-95"
            >
              <Icon name="sensors" />
            </a>
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                aria-label="Sign out"
                className="p-1 text-text-secondary hover:text-text-primary transition-colors duration-200 active:scale-95"
              >
                <Icon name="logout" />
              </button>
            )}
            {alertsOpen && (
              <div className="absolute right-0 top-10 z-50 w-[min(360px,calc(100vw-32px))] rounded-xl border border-white/10 bg-black/75 backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                  <div>
                    <h3 className="font-headline-md text-[18px] leading-6 text-text-primary">Alerts</h3>
                    <p className="font-label-caps text-label-caps text-text-secondary uppercase">
                      {activeAlerts.length} active
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAlertsOpen(false)}
                    className="h-8 w-8 rounded-full border border-border-subtle text-text-secondary hover:text-text-primary"
                    aria-label="Close alerts"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto custom-scrollbar p-3 space-y-3">
                  {activeAlerts.length === 0 && (
                    <div className="rounded-lg border border-border-subtle bg-white/[0.03] px-3 py-4 font-body-sm text-body-sm text-text-secondary">
                      No active alerts.
                    </div>
                  )}
                  {activeAlerts.map((alert) => (
                    <div key={alert.id} className="rounded-lg border border-[#FF9D63]/25 bg-[#FF9D63]/10 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-label-caps text-label-caps text-text-primary uppercase break-words">
                            {alert.title}
                          </div>
                          <p className="mt-1 font-body-sm text-body-sm text-text-secondary">
                            {alert.message}
                          </p>
                        </div>
                        <span className="rounded-full border border-[#FF9D63]/50 px-2 py-0.5 font-label-caps text-[9px] uppercase text-[#FF9D63]">
                          {alert.severity}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => handleAlertAction(alert.id, "snooze")}
                          className="rounded border border-[#FF9D63]/60 px-2 py-1.5 font-label-caps text-[10px] uppercase text-[#FF9D63] hover:bg-[#FF9D63]/10"
                        >
                          Snooze
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAlertAction(alert.id, "forget")}
                          className="rounded border border-border-subtle px-2 py-1.5 font-label-caps text-[10px] uppercase text-text-secondary hover:text-[#FF9D63]"
                        >
                          Forget
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAlertAction(alert.id, "resolve")}
                          className="rounded bg-[#FF9D63] px-2 py-1.5 font-label-caps text-[10px] uppercase text-black hover:opacity-90"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* SideNav (Desktop) */}
      <aside className="fixed left-0 top-20 h-[calc(100vh-80px)] z-40 hidden md:flex flex-col py-4 bg-surface-panel border-r border-border-subtle w-64">
        <div className="px-4 mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-8 w-8 rounded-full bg-surface-panel flex items-center justify-center border border-border-subtle">
              <span className="material-symbols-outlined text-[16px]">
                admin_panel_settings
              </span>
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md text-text-primary">
                Admin Console
              </h2>
              <p className="font-label-caps text-label-caps text-text-secondary uppercase">
                Vigilant Mode Active
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-1 px-2">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = active === item.id;
            return (
              <a
                key={item.id}
                href={item.href}
                className={
                  isActive
                    ? "text-text-primary bg-surface-panel border border-border-subtle px-4 py-2 flex items-center gap-4 rounded-lg hover:bg-white/10 transition-all active:translate-x-1 duration-200"
                    : "text-text-secondary px-4 py-2 flex items-center gap-4 rounded-lg hover:bg-surface-panel hover:text-text-primary transition-all active:translate-x-1 duration-200"
                }
              >
                <span style={iconStyle(isActive)}>
                  <Icon name={item.icon} fill={isActive} />
                </span>
                <span className="font-label-caps text-label-caps uppercase">{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-1 px-2 pt-4 border-t border-border-subtle">
          {FOOTER_ITEMS.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className="text-text-secondary px-4 py-2 flex items-center gap-4 rounded-lg hover:bg-surface-panel hover:text-text-primary transition-all active:translate-x-1 duration-200"
            >
              <Icon name={item.icon} />
              <span className="font-label-caps text-label-caps uppercase">{item.label}</span>
            </a>
          ))}
        </div>
      </aside>

      {/* Page content (provided by caller) */}
      {children}
    </div>
  );
}

export default DashboardChrome;
