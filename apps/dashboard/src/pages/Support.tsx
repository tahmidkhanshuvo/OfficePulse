import { GlassPanel, PublicPageShell } from "../components/PublicPageChrome";

type FaqItem = {
  q: string;
  a: string;
};

const FAQS: FaqItem[] = [
  {
    q: "How do I sign in to OfficePulse?",
    a: "Enter the administrator PIN on the login page. The session remains active until logout or the configured idle timeout expires.",
  },
  {
    q: "Where do I see live power and device status?",
    a: "The Overview page shows real-time draw per room and active devices. The Map page shows the top-down layout with light and fan states for each zone.",
  },
  {
    q: "How do alerts work?",
    a: "OfficePulse monitors after-hours occupancy, long-running all-device sessions, and vacant-room waste. Alerts can be resolved to turn devices off, snoozed for 2 minutes, or forgotten for 1 hour.",
  },
  {
    q: "Why is a device showing as OFF when I just turned it on?",
    a: "If the platform session is not verified, control writes are held back for re-authentication. Confirm the session is active and try the command again.",
  },
  {
    q: "Can multiple admins use OfficePulse at the same time?",
    a: "Yes. Active sessions are isolated by token, and command activity is recorded in the Logs page with the acting admin's identifier.",
  },
];

export function Support() {
  return (
    <PublicPageShell backFallback="#/login">
        <GlassPanel className="p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#FF9D63]/30 bg-[#FF9D63]/10 px-3 py-1 font-label-caps text-label-caps uppercase text-[#FF9D63]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#FF9D63]" />
                Help Center
              </div>
              <h1 className="mt-5 text-[34px] font-semibold leading-tight text-white sm:text-[44px]">
                Support
              </h1>
              <p className="mt-3 max-w-xl font-body-base text-body-base text-text-secondary">
                Quick help for sign-in, live telemetry, alerts, controls, and reports.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#/contact"
                className="inline-flex items-center gap-2 rounded-lg bg-[#FF9D63] px-4 py-3 font-body-sm text-body-sm font-semibold text-black transition-colors hover:bg-[#FFB07F]"
              >
                Contact Support
                <span className="material-symbols-outlined text-[18px]" style={{ color: "#000" }}>
                  arrow_forward
                </span>
              </a>
              <a
                href="#/login"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#111111]/70 px-4 py-3 font-body-sm text-body-sm font-semibold text-text-primary transition-colors hover:border-[#FF9D63]/50"
              >
                Login
              </a>
            </div>
          </div>
        </GlassPanel>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <a
            href="#/contact"
            className="rounded-xl border border-white/10 bg-[#111111]/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl transition-colors hover:border-[#FF9D63]/60"
          >
            <span className="material-symbols-outlined">support_agent</span>
            <span className="mt-3 block font-headline-md text-headline-md">Contact</span>
            <span className="mt-1 block font-body-sm text-body-sm text-text-secondary">Reach the maintainers.</span>
          </a>
          <a
            href="#/privacy"
            className="rounded-xl border border-white/10 bg-[#111111]/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl transition-colors hover:border-[#FF9D63]/60"
          >
            <span className="material-symbols-outlined">shield</span>
            <span className="mt-3 block font-headline-md text-headline-md">Privacy</span>
            <span className="mt-1 block font-body-sm text-body-sm text-text-secondary">Data and telemetry policy.</span>
          </a>
          <a
            href="#/terms"
            className="rounded-xl border border-white/10 bg-[#111111]/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl transition-colors hover:border-[#FF9D63]/60"
          >
            <span className="material-symbols-outlined">description</span>
            <span className="mt-3 block font-headline-md text-headline-md">Terms</span>
            <span className="mt-1 block font-body-sm text-body-sm text-text-secondary">Service terms.</span>
          </a>
        </section>

        <GlassPanel className="p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-3 border-b border-white/10 pb-4">
            <span className="material-symbols-outlined">help</span>
            <h2 className="font-headline-md text-headline-md text-text-primary">FAQ</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {FAQS.map((item) => (
              <details
                key={item.q}
                className="group rounded-lg border border-white/10 bg-[#111111]/70 p-4 transition-colors open:border-[#FF9D63]/40"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-body-base text-body-base font-semibold text-text-primary">
                  {item.q}
                  <span className="material-symbols-outlined text-[18px] transition-transform group-open:rotate-180">
                    expand_more
                  </span>
                </summary>
                <p className="mt-3 font-body-sm text-body-sm leading-relaxed text-text-secondary">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </GlassPanel>
    </PublicPageShell>
  );
}

export default Support;
