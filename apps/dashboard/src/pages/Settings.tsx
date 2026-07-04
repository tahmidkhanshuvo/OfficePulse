import { useEffect, useState } from "react";
import type { ReportRequest } from "../../../../packages/contracts/src";
import { DashboardChrome } from "../components/DashboardChrome";
import {
  createReport,
  getReports,
  getSettings,
  getSystemComponents,
  reportDownloadUrl,
  withControlRetry,
} from "../lib/api";

type SettingsProps = {
  onExit?: () => void;
};

type SettingsSection = "profile" | "authentication" | "preferences" | "security" | "reports" | "system";

const SUBNAV: { id: SettingsSection; label: string; icon: string }[] = [
  { id: "profile", label: "Profile", icon: "person" },
  { id: "authentication", label: "Authentication", icon: "security" },
  { id: "preferences", label: "Preferences", icon: "tune" },
  { id: "security", label: "Security", icon: "shield_lock" },
  { id: "reports", label: "Reports", icon: "description" },
  { id: "system", label: "System", icon: "monitor_heart" },
];

export function Settings({ onExit }: SettingsProps) {
  const [section, setSection] = useState<SettingsSection>("profile");

  // Profile state
  const [fullName, setFullName] = useState("System Admin");
  const [email, setEmail] = useState("admin@eco-flow.pro");
  const [phone, setPhone] = useState("+44 20 7946 0123");
  const [location, setLocation] = useState("London, UK");
  const [department, setDepartment] = useState("Operations");

  // Authentication state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [twoFactor, setTwoFactor] = useState(false);

  // Preferences state
  const [autoDim, setAutoDim] = useState(true);
  const [scheduleOverrides, setScheduleOverrides] = useState(true);
  const [sensorAlerts, setSensorAlerts] = useState(true);
  const [nightMode, setNightMode] = useState(false);

  // Security state
  const [sessionTimeout, setSessionTimeout] = useState("30");
  const [pinRequired, setPinRequired] = useState(true);
  const [auditLog, setAuditLog] = useState(true);
  const [officeSettings, setOfficeSettings] = useState<Awaited<ReturnType<typeof getSettings>> | null>(null);
  const [reports, setReports] = useState<ReportRequest[]>([]);
  const [components, setComponents] = useState<Array<{ id: string; status: string; lastSeenAt: string }>>([]);
  const [busyReport, setBusyReport] = useState<"csv" | "pdf" | null>(null);

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

  const handleCreateReport = async (format: "csv" | "pdf") => {
    setBusyReport(format);
    try {
      const report = await withControlRetry(() => createReport(format));
      setReports((prev) => [report, ...prev.filter((item) => item.id !== report.id)]);
    } finally {
      setBusyReport(null);
    }
  };

  return (
    <DashboardChrome active="settings" onExit={onExit}>
      <main className="pt-20 md:pl-64 md:h-screen md:overflow-hidden flex flex-col">
        <div className="flex-1 md:min-h-0 p-4 md:p-8 flex flex-col gap-8 md:overflow-y-auto custom-scrollbar">
          {/* Header — matches Overview / Map / DeviceAnalytics / Logs */}
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-subtle pb-4 shrink-0">
            <div>
              <h1 className="font-headline-md text-headline-md text-text-primary">
                Settings
              </h1>
              <p className="font-body-base text-body-base text-text-secondary mt-1">
                Manage your account and preferences.
              </p>
            </div>
          </header>

          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Sub-navigation */}
            <aside className="w-full lg:w-56 flex-shrink-0 lg:sticky lg:top-4">
              <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 custom-scrollbar">
                {SUBNAV.map((item) => {
                  const isActive = section === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSection(item.id)}
                      className={
                        isActive
                          ? "whitespace-nowrap px-3 py-2 bg-surface-panel border border-border-subtle rounded-lg text-text-primary font-label-caps text-label-caps uppercase flex items-center gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] border-l-2 border-l-[#FF9D63]"
                          : "whitespace-nowrap px-3 py-2 hover:bg-surface-panel border border-transparent rounded-lg text-text-secondary hover:text-text-primary font-label-caps text-label-caps uppercase flex items-center gap-2 transition-all"
                      }
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {item.icon}
                      </span>
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Content */}
            <div className="flex-1 w-full flex flex-col gap-8">
              {section === "profile" && (
                <section className="bg-surface-panel backdrop-blur-xl border border-border-subtle rounded-xl p-6">
                  <h3 className="font-headline-md text-headline-md text-text-primary mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#FF9D63]">
                      person
                    </span>
                    Profile Information
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-8 mb-6">
                    <div className="flex-shrink-0 flex flex-col items-center gap-3">
                      <div className="w-24 h-24 rounded-full bg-bg-deep border border-border-subtle relative overflow-hidden group flex items-center justify-center">
                        <span className="material-symbols-outlined text-[48px] text-text-secondary">
                          person
                        </span>
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          <span className="material-symbols-outlined text-white">upload</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="font-label-caps text-label-caps text-text-secondary hover:text-text-primary transition-colors border border-border-subtle px-3 py-1 rounded-full uppercase"
                      >
                        Change
                      </button>
                    </div>
                    <div className="flex-1 flex flex-col gap-4">
                      <FieldInput
                        label="Full Name"
                        value={fullName}
                        onChange={setFullName}
                      />
                      <FieldInput
                        label="Role"
                        value="Operations Manager"
                        onChange={() => {}}
                        readOnly
                      />
                      <FieldInput
                        label="Email Address"
                        type="email"
                        value={email}
                        onChange={setEmail}
                      />
                      <FieldInput
                        label="Phone Number"
                        type="tel"
                        value={phone}
                        onChange={setPhone}
                      />
                      <FieldInput
                        label="Location"
                        value={location}
                        onChange={setLocation}
                      />
                      <FieldInput
                        label="Department / Team"
                        value={department}
                        onChange={setDepartment}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
                    <button
                      type="button"
                      className="font-label-caps text-label-caps text-text-secondary hover:text-text-primary uppercase border border-border-subtle px-4 py-2 rounded-full transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // Placeholder: wire to /api/auth/profile once the API contract is finalized.
                      }}
                      className="font-label-caps text-label-caps uppercase px-4 py-2 rounded-full bg-[#FF9D63] text-black hover:bg-[#FFB07F] transition-colors"
                    >
                      Save Changes
                    </button>
                  </div>
                </section>
              )}

              {section === "authentication" && (
                <section className="bg-surface-panel backdrop-blur-xl border border-border-subtle rounded-xl p-6">
                  <h3 className="font-headline-md text-headline-md text-text-primary mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#FF9D63]">
                      security
                    </span>
                    Authentication &amp; Security
                  </h3>
                  <div className="flex flex-col gap-6 max-w-md">
                    <FieldInput
                      label="Current Password"
                      type="password"
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={setCurrentPassword}
                    />
                    <FieldInput
                      label="New Password"
                      type="password"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={setNewPassword}
                    />
                    <FieldInput
                      label="Confirm New Password"
                      type="password"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                    />
                    <ToggleRow
                      title="Two-Factor Authentication (2FA)"
                      description="Add an extra layer of security to your account."
                      checked={twoFactor}
                      onChange={setTwoFactor}
                    />
                    <div className="pt-2">
                      <button
                        type="button"
                        className="font-label-caps text-label-caps uppercase px-4 py-2 rounded-full bg-[#FF9D63] text-black hover:bg-[#FFB07F] transition-colors"
                      >
                        Update Security Settings
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {section === "preferences" && (
                <section className="bg-surface-panel backdrop-blur-xl border border-border-subtle rounded-xl p-6">
                  <h3 className="font-headline-md text-headline-md text-text-primary mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#FF9D63]">
                      tune
                    </span>
                    Preferences
                  </h3>
                  <div className="flex flex-col divide-y divide-border-subtle">
                    <ToggleRow
                      title="Auto-dim after hours"
                      description={`Reduce brightness after office close${officeSettings ? ` (${officeSettings.officeCloseTime})` : ""}.`}
                      checked={autoDim}
                      onChange={setAutoDim}
                    />
                    <ToggleRow
                      title="Allow schedule overrides"
                      description="Permit authorized users to override scheduled states."
                      checked={scheduleOverrides}
                      onChange={setScheduleOverrides}
                    />
                    <ToggleRow
                      title="Sensor alerts"
                      description="Receive alerts when CO₂, motion, or occupancy thresholds change."
                      checked={sensorAlerts}
                      onChange={setSensorAlerts}
                    />
                    <ToggleRow
                      title="Night mode"
                      description={`Mute non-critical notifications outside ${officeSettings?.officeOpenTime ?? "09:00"}-${officeSettings?.officeCloseTime ?? "17:00"}.`}
                      checked={nightMode}
                      onChange={setNightMode}
                    />
                  </div>
                </section>
              )}

              {section === "security" && (
                <section className="bg-surface-panel backdrop-blur-xl border border-border-subtle rounded-xl p-6">
                  <h3 className="font-headline-md text-headline-md text-text-primary mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#FF9D63]">
                      shield_lock
                    </span>
                    Security
                  </h3>
                  <div className="flex flex-col gap-6 max-w-md">
                    <div>
                      <label className="block font-label-caps text-label-caps text-text-secondary mb-1.5 uppercase">
                        Session timeout (minutes)
                      </label>
                      <select
                        value={sessionTimeout}
                        onChange={(e) => setSessionTimeout(e.target.value)}
                        className="w-full bg-transparent border border-border-subtle rounded-md px-3 py-2 font-body-base text-body-base text-text-primary focus:outline-none focus:border-[#FF9D63] transition-colors"
                      >
                        <option value="15" className="bg-bg-deep">15</option>
                        <option value="30" className="bg-bg-deep">30</option>
                        <option value="60" className="bg-bg-deep">60</option>
                        <option value="120" className="bg-bg-deep">120</option>
                      </select>
                    </div>
                    <ToggleRow
                      title="PIN required on control actions"
                      description="Require re-authentication before toggling lights or fans from the dashboard."
                      checked={pinRequired}
                      onChange={setPinRequired}
                    />
                    <ToggleRow
                      title="Audit logging"
                      description="Record every admin action to the system activity log."
                      checked={auditLog}
                      onChange={setAuditLog}
                    />
                  </div>
                </section>
              )}

              {section === "reports" && (
                <section className="bg-surface-panel backdrop-blur-xl border border-border-subtle rounded-xl p-6">
                  <h3 className="font-headline-md text-headline-md text-text-primary mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#FF9D63]">
                      description
                    </span>
                    Reports
                  </h3>
                  <div className="flex flex-wrap gap-3 mb-6">
                    <button
                      type="button"
                      disabled={busyReport === "csv"}
                      onClick={() => handleCreateReport("csv")}
                      className="font-label-caps text-label-caps uppercase px-4 py-2 rounded-full bg-[#FF9D63] text-black hover:bg-[#FFB07F] transition-colors disabled:opacity-50"
                    >
                      Create CSV
                    </button>
                    <button
                      type="button"
                      disabled={busyReport === "pdf"}
                      onClick={() => handleCreateReport("pdf")}
                      className="font-label-caps text-label-caps uppercase px-4 py-2 rounded-full bg-surface-panel border border-[#FF9D63] text-[#FF9D63] hover:bg-[#FF9D63]/10 transition-colors disabled:opacity-50"
                    >
                      Create PDF
                    </button>
                    <a
                      href={reportDownloadUrl("csv")}
                      className="font-label-caps text-label-caps uppercase px-4 py-2 rounded-full border border-border-subtle text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Download CSV
                    </a>
                    <a
                      href={reportDownloadUrl("pdf")}
                      className="font-label-caps text-label-caps uppercase px-4 py-2 rounded-full border border-border-subtle text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Download PDF
                    </a>
                  </div>
                  <div className="flex flex-col gap-3">
                    {reports.length === 0 && (
                      <div className="font-body-sm text-body-sm text-text-secondary border border-border-subtle rounded-lg px-3 py-3">
                        No generated reports yet.
                      </div>
                    )}
                    {reports.map((report) => (
                      <div key={report.id} className="border border-border-subtle rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="font-body-base text-body-base text-text-primary">
                            {report.format.toUpperCase()} report
                          </div>
                          <div className="font-label-caps text-label-caps text-text-secondary uppercase">
                            {report.status} • {new Date(report.requestedAt).toLocaleString()}
                          </div>
                        </div>
                        <span className="font-label-caps text-label-caps text-[#FF9D63] border border-[#FF9D63]/50 rounded-full px-3 py-1 uppercase">
                          {report.id.slice(0, 12)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {section === "system" && (
                <section className="bg-surface-panel backdrop-blur-xl border border-border-subtle rounded-xl p-6">
                  <h3 className="font-headline-md text-headline-md text-text-primary mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#FF9D63]">
                      monitor_heart
                    </span>
                    System Health
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {components.map((component) => (
                      <div key={component.id} className="border border-border-subtle rounded-lg p-4 bg-surface-panel">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <span className="font-label-caps text-label-caps text-text-secondary uppercase">
                            {component.id}
                          </span>
                          <span className="h-2 w-2 rounded-full bg-[#FF9D63] animate-pulse" />
                        </div>
                        <div className="font-metric-lg text-metric-lg text-text-primary uppercase">
                          {component.status}
                        </div>
                        <div className="font-body-sm text-body-sm text-text-secondary mt-1">
                          Last seen {new Date(component.lastSeenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    ))}
                    {components.length === 0 && (
                      <div className="font-body-sm text-body-sm text-text-secondary border border-border-subtle rounded-lg px-3 py-3 md:col-span-3">
                        System status is unavailable.
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </main>
    </DashboardChrome>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="block font-label-caps text-label-caps text-text-secondary mb-1.5 uppercase">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className={
          readOnly
            ? "w-full bg-transparent border border-border-subtle rounded-md px-3 py-2 font-body-base text-body-base text-text-secondary focus:outline-none transition-colors"
            : "w-full bg-transparent border border-border-subtle rounded-md px-3 py-2 font-body-base text-body-base text-text-primary placeholder:text-surface-variant focus:outline-none focus:border-[#FF9D63] transition-colors"
        }
      />
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex flex-col gap-1">
        <span className="font-body-base text-body-base text-text-primary">
          {title}
        </span>
        <span className="font-body-sm text-body-sm text-text-secondary">
          {description}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={
          checked
            ? "relative inline-flex h-6 w-11 items-center rounded-full bg-[#FF9D63] border border-[#FF9D63] transition-colors focus:outline-none"
            : "relative inline-flex h-6 w-11 items-center rounded-full bg-surface-panel border border-border-subtle transition-colors focus:outline-none"
        }
      >
        <span
          className={
            checked
              ? "inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6"
              : "inline-block h-4 w-4 transform rounded-full bg-text-secondary transition-transform translate-x-1"
          }
        />
      </button>
    </div>
  );
}

export default Settings;
