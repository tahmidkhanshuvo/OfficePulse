import { BrandMark } from "../components/BrandMark";

type Section = {
  title: string;
  body: string;
};

const SECTIONS: Section[] = [
  {
    title: "Information We Collect",
    body: "OfficePulse collects platform session identifiers, device telemetry (state changes, power draw, occupancy events), and command activity logs. Voice transcripts from the in-dashboard assistant are processed locally for transcription only and are not stored on our servers.",
  },
  {
    title: "How We Use Information",
    body: "Collected data is used to render the live dashboard, drive automation rules, surface alerts, and produce energy reports. Aggregated metrics may be used to improve OfficePulse's default scheduling heuristics.",
  },
  {
    title: "Data Storage and Retention",
    body: "Telemetry and command history are retained for 30 days by default. Administrators can request earlier purge from the Settings page once durable persistence is enabled in their deployment.",
  },
  {
    title: "Sharing",
    body: "OfficePulse does not sell or share your data with third parties. Optional integrations (such as Discord notifications) only receive the minimum payload required to deliver the requested alert.",
  },
  {
    title: "Security",
    body: "Browser-facing reads are protected by a platform PIN session. Control writes require recent re-verification. Internal telemetry endpoints authenticate with HMAC service tokens.",
  },
  {
    title: "Your Choices",
    body: "You can sign out at any time to invalidate the active session. Contact the maintainers to request export or deletion of audit data associated with your administrator account.",
  },
];

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col text-text-primary antialiased bg-bg-deep relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none flex justify-center items-center z-0 opacity-20">
        <div className="w-[800px] h-[800px] bg-secondary-container rounded-full blur-[120px] mix-blend-screen opacity-10 animate-pulse" />
      </div>

      <header className="relative z-10 w-full flex items-center justify-between px-margin-desktop py-6 border-b border-border-subtle">
        <a href="#/login" className="flex items-center gap-3">
          <BrandMark />
          <span className="font-headline-md text-headline-md">OfficePulse</span>
        </a>
        <a
          href="#/login"
          className="font-label-caps text-label-caps uppercase text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Login
        </a>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-3xl mx-auto px-6 py-12 flex flex-col gap-8">
        <div>
          <span className="font-label-caps text-label-caps uppercase text-text-secondary">
            Legal
          </span>
          <h1 className="font-headline-lg text-headline-lg text-text-primary mt-2">
            Privacy Policy
          </h1>
          <p className="font-body-base text-body-base text-text-secondary mt-3">
            Last updated January 2026. This policy describes how OfficePulse
            handles data collected through the dashboard and supporting services.
          </p>
        </div>

        <section className="flex flex-col gap-6">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 className="font-headline-md text-headline-md text-text-primary border-b border-border-subtle pb-2">
                {s.title}
              </h2>
              <p className="font-body-base text-body-base text-text-secondary mt-3 leading-relaxed">
                {s.body}
              </p>
            </div>
          ))}
        </section>

        <div className="bg-surface-panel border border-border-subtle rounded-xl p-6 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined">contact_support</span>
            <p className="font-headline-md text-headline-md">Questions about this policy?</p>
          </div>
          <p className="font-body-base text-body-base text-text-secondary">
            Reach the maintainers through the Contact Support page.
          </p>
          <a
            href="#/contact"
            className="self-start font-label-caps text-label-caps uppercase text-[#FF9D63] hover:underline"
          >
            Open Contact Support →
          </a>
        </div>
      </main>

      <footer className="relative z-10 w-full flex flex-col md:flex-row justify-between items-center px-margin-desktop py-6 border-t border-border-subtle">
        <p className="font-body-sm text-body-sm text-text-secondary">
          © 2026 OfficePulse. Developed by Team If_it_works_it_works.
        </p>
        <nav className="flex gap-4 mt-2 md:mt-0 font-label-caps text-label-caps text-text-secondary">
          <a className="hover:text-text-primary transition-colors" href="#/support">
            Support
          </a>
          <a className="hover:text-text-primary transition-colors" href="#/terms">
            Terms of Service
          </a>
          <a className="hover:text-text-primary transition-colors" href="#/contact">
            Contact Support
          </a>
        </nav>
      </footer>
    </div>
  );
}

export default PrivacyPolicy;