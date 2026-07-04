import { type ReactNode, type CSSProperties } from "react";
import { BrandMark } from "./BrandMark";
import { useOfficeSnapshot } from "../hooks/useOfficeSnapshot";

type Section = "overview" | "map" | "analytics" | "logs" | "settings";

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
  const center =
    topNavCenter ?? (
      <>
        <MetricChip label="Total Office Power" value={snapshot ? `${snapshot.energy.totalPowerWatts}W` : "450W"} />
        <div className="h-8 w-px bg-border-subtle" />
        <MetricChip label="Today" value={snapshot ? `${snapshot.energy.todayKwh} kWh` : "12.4 kWh"} />
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
          <div className="flex gap-3">
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
