import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ReportRequest } from "../../../../packages/contracts/src";
import { DashboardChrome } from "../components/DashboardChrome";
import {
  createReport,
  downloadReport,
  getReports,
  getSettings,
  getSystemComponents,
  withControlRetry,
} from "../lib/api";

type SettingsProps = {
  onExit?: () => void;
};

type OfficeSettings = Awaited<ReturnType<typeof getSettings>>;
type ComponentStatus = { id: string; status: string; lastSeenAt: string };

export function Settings({ onExit }: SettingsProps) {
  const [officeSettings, setOfficeSettings] = useState<OfficeSettings | null>(null);
  const [reports, setReports] = useState<ReportRequest[]>([]);
  const [components, setComponents] = useState<ComponentStatus[]>([]);
  const [busyReport, setBusyReport] = useState<"csv" | "pdf" | null>(null);
  const [busyDownload, setBusyDownload] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then(setOfficeSettings)
      .catch(() => setOfficeSettings(null));
    getReports()
      .then((next) => setReports(next.reports))
      .catch(() => setReports([]));
    getSystemComponents()
      .then((next) => setComponents(next.components))
      .catch(() => setComponents([]));
  }, []);

  const healthSummary = useMemo(() => {
    if (components.length === 0) return "Unknown";
    return components.every((component) => /healthy|ok|configured|ready/i.test(component.status))
      ? "Operational"
      : "Review";
  }, [components]);

  const handleCreateReport = async (format: "csv" | "pdf") => {
    setBusyReport(format);
    setMessage(null);
    try {
      const report = await withControlRetry(() => createReport(format));
      setReports((prev) => [report, ...prev.filter((item) => item.id !== report.id)]);
      setMessage(`${format.toUpperCase()} report created.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Unable to create report.");
    } finally {
      setBusyReport(null);
    }
  };

  const handleDownloadReport = async (report: ReportRequest) => {
    setBusyDownload(report.id);
    setMessage(null);
    try {
      await downloadReport(report.format, report.id);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Unable to download report.");
    } finally {
      setBusyDownload(null);
    }
  };

  return (
    <DashboardChrome active="settings" onExit={onExit}>
      <main className="pt-20 md:pl-64 md:h-screen md:overflow-hidden flex flex-col">
        <div className="flex-1 md:min-h-0 p-4 md:p-8 flex flex-col gap-6 md:overflow-y-auto custom-scrollbar">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-subtle pb-4 shrink-0">
            <div>
              <h1 className="font-headline-md text-headline-md text-text-primary">Settings</h1>
              <p className="font-body-base text-body-base text-text-secondary mt-1">
                Operational configuration, reports, and system health.
              </p>
            </div>
            <span className="self-start md:self-auto font-label-caps text-label-caps text-[#FF9D63] border border-[#FF9D63]/50 rounded-full px-3 py-1 uppercase">
              {healthSummary}
            </span>
          </header>

          {message && (
            <div className="rounded-lg border border-[#FF9D63]/40 bg-[#FF9D63]/10 px-3 py-2 font-body-sm text-body-sm text-[#FF9D63]">
              {message}
            </div>
          )}

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <InfoCard
              icon="schedule"
              label="Office Hours"
              value={`${officeSettings?.officeOpenTime ?? "09:00"}-${officeSettings?.officeCloseTime ?? "17:00"}`}
              detail={officeSettings?.timezone ?? "Asia/Dhaka"}
            />
            <InfoCard
              icon="payments"
              label="Tariff"
              value={`Tk ${officeSettings?.tariffPerKwh?.toFixed(2) ?? "12.00"}`}
              detail="per kWh"
            />
            <InfoCard
              icon="co2"
              label="Carbon Factor"
              value={`${officeSettings?.carbonKgPerKwh?.toFixed(2) ?? "0.62"} kg`}
              detail="CO2e per kWh"
            />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
            <Panel
              icon="description"
              title="Reports"
              action={
                <div className="flex gap-2">
                  <ActionButton
                    label="CSV"
                    icon="table_view"
                    busy={busyReport === "csv"}
                    onClick={() => handleCreateReport("csv")}
                  />
                  <ActionButton
                    label="PDF"
                    icon="picture_as_pdf"
                    variant="outline"
                    busy={busyReport === "pdf"}
                    onClick={() => handleCreateReport("pdf")}
                  />
                </div>
              }
            >
              <div className="flex flex-col gap-2">
                {reports.length === 0 && (
                  <EmptyState text="No generated reports yet." />
                )}
                {reports.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => handleDownloadReport(report)}
                    disabled={busyDownload === report.id}
                    className="w-full rounded-lg border border-border-subtle bg-black/20 px-3 py-3 flex items-center justify-between gap-3 text-left hover:border-[#FF9D63]/50 transition-colors disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block font-body-base text-body-base text-text-primary">
                        {report.format.toUpperCase()} report
                      </span>
                      <span className="block font-label-caps text-label-caps text-text-secondary uppercase truncate">
                        {report.status} - {new Date(report.requestedAt).toLocaleString()}
                      </span>
                    </span>
                    <span className="h-8 w-8 rounded-full border border-border-subtle flex items-center justify-center text-[#FF9D63] shrink-0">
                      <span className="material-symbols-outlined text-[18px]">download</span>
                    </span>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel icon="monitor_heart" title="System Health">
              <div className="grid grid-cols-1 gap-2">
                {components.length === 0 && <EmptyState text="System status is unavailable." />}
                {components.map((component) => (
                  <div key={component.id} className="rounded-lg border border-border-subtle bg-black/20 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-label-caps text-label-caps text-text-secondary uppercase">
                        {component.id}
                      </span>
                      <span className="h-2 w-2 rounded-full bg-[#FF9D63]" />
                    </div>
                    <div className="mt-2 font-headline-md text-headline-md text-text-primary uppercase">
                      {component.status}
                    </div>
                    <div className="mt-1 font-body-sm text-body-sm text-text-secondary">
                      Last seen {new Date(component.lastSeenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        </div>
      </main>
    </DashboardChrome>
  );
}

function InfoCard({ icon, label, value, detail }: { icon: string; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="material-symbols-outlined text-[#FF9D63]">{icon}</span>
        <span className="font-label-caps text-label-caps text-text-secondary uppercase">{label}</span>
      </div>
      <div className="mt-4 font-metric-lg text-metric-lg text-text-primary">{value}</div>
      <div className="mt-1 font-body-sm text-body-sm text-text-secondary">{detail}</div>
    </div>
  );
}

function Panel({
  icon,
  title,
  action,
  children,
}: {
  icon: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface-panel p-4">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-3 mb-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[#FF9D63]">{icon}</span>
          <h2 className="font-headline-md text-headline-md text-text-primary">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ActionButton({
  label,
  icon,
  variant = "solid",
  busy,
  onClick,
}: {
  label: string;
  icon: string;
  variant?: "solid" | "outline";
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={
        variant === "solid"
          ? "inline-flex items-center gap-2 rounded-lg bg-[#FF9D63] px-3 py-2 font-label-caps text-label-caps uppercase text-black disabled:opacity-50"
          : "inline-flex items-center gap-2 rounded-lg border border-[#FF9D63]/60 px-3 py-2 font-label-caps text-label-caps uppercase text-[#FF9D63] hover:bg-[#FF9D63]/10 disabled:opacity-50"
      }
    >
      <span className="material-symbols-outlined text-[16px]" style={{ color: variant === "solid" ? "#000" : "#FF9D63" }}>
        {busy ? "progress_activity" : icon}
      </span>
      {label}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-black/20 px-3 py-4 font-body-sm text-body-sm text-text-secondary">
      {text}
    </div>
  );
}

export default Settings;
