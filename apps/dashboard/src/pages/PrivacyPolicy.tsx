import { GlassPanel, PublicPageShell } from "../components/PublicPageChrome";

type Section = {
  title: string;
  body: string;
};

const SECTIONS: Section[] = [
  {
    title: "Information We Collect",
    body: "OfficePulse collects platform session identifiers, device telemetry, occupancy events, and command activity logs. Assistant prompts are used only to answer the current request.",
  },
  {
    title: "How We Use Information",
    body: "Collected data renders the live dashboard, drives automation rules, surfaces alerts, and produces energy reports.",
  },
  {
    title: "Data Storage and Retention",
    body: "Telemetry and command history are retained according to the active deployment settings. Administrators can request export or deletion from support.",
  },
  {
    title: "Sharing",
    body: "OfficePulse does not sell data. Optional integrations only receive the minimum payload needed to deliver a requested alert.",
  },
  {
    title: "Security",
    body: "Browser reads require a platform PIN session. Control writes require recent verification. Internal telemetry endpoints authenticate with service tokens.",
  },
  {
    title: "Your Choices",
    body: "You can sign out at any time to invalidate the active session. Contact the maintainers for audit data requests.",
  },
];

export function PrivacyPolicy() {
  return (
    <PublicPageShell>
      <GlassPanel className="p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF9D63]/30 bg-[#FF9D63]/10 px-3 py-1 font-label-caps text-label-caps uppercase text-[#FF9D63]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF9D63]" />
              Legal
            </div>
            <h1 className="mt-5 text-[34px] font-semibold leading-tight text-white sm:text-[44px]">
              Privacy Policy
            </h1>
            <p className="mt-3 max-w-xl font-body-base text-body-base text-text-secondary">
              Last updated January 2026.
            </p>
          </div>
          <a
            href="#/contact"
            className="inline-flex items-center gap-2 self-start rounded-lg border border-white/10 bg-[#111111]/70 px-4 py-3 font-body-sm text-body-sm font-semibold text-text-primary transition-colors hover:border-[#FF9D63]/50 lg:self-end"
          >
            Contact
          </a>
        </div>
      </GlassPanel>

      <GlassPanel className="p-4 sm:p-6">
        <div className="grid gap-3">
          {SECTIONS.map((section) => (
            <article key={section.title} className="rounded-lg border border-white/10 bg-[#111111]/70 p-4">
              <h2 className="font-headline-md text-headline-md text-text-primary">{section.title}</h2>
              <p className="mt-3 font-body-base text-body-base leading-relaxed text-text-secondary">
                {section.body}
              </p>
            </article>
          ))}
        </div>
      </GlassPanel>
    </PublicPageShell>
  );
}

export default PrivacyPolicy;
