import { BrandMark } from "../components/BrandMark";

type FaqItem = {
  q: string;
  a: string;
};

const FAQS: FaqItem[] = [
  {
    q: "How do I sign in to OfficePulse?",
    a: "Open the dashboard and enter the Administrator ID and security key configured by your admin. The session remains active until logout or the configured idle timeout expires.",
  },
  {
    q: "Where do I see live power and device status?",
    a: "The Overview page shows real-time draw per room and active devices. The Map page shows the top-down layout with light and fan states for each zone.",
  },
  {
    q: "How do alerts work?",
    a: "OfficePulse monitors after-hours occupancy, long-running all-device sessions, and vacant-room waste. Alerts appear on the Overview page and can be acknowledged, snoozed, or resolved from the activity log.",
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
    <div className="min-h-screen flex flex-col text-text-primary antialiased bg-bg-deep relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none flex justify-center items-center z-0 opacity-20">
        <div className="w-[800px] h-[800px] bg-secondary-container rounded-full blur-[120px] mix-blend-screen opacity-10 animate-pulse" />
      </div>

      {/* Top bar */}
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

      {/* Content */}
      <main className="relative z-10 flex-1 w-full max-w-3xl mx-auto px-6 py-12 flex flex-col gap-8">
        <div>
          <span className="font-label-caps text-label-caps uppercase text-text-secondary">
            Help Center
          </span>
          <h1 className="font-headline-lg text-headline-lg text-text-primary mt-2">
            Support
          </h1>
          <p className="font-body-base text-body-base text-text-secondary mt-3">
            Quick answers for the most common questions about OfficePulse. If you
            need hands-on help, reach the team via the Contact Support page.
          </p>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <a
            href="#/contact"
            className="bg-surface-panel border border-border-subtle rounded-xl p-4 flex flex-col gap-2 hover:border-[#FF9D63]/60 transition-colors"
          >
            <span className="material-symbols-outlined">support_agent</span>
            <span className="font-headline-md text-headline-md">Contact</span>
            <span className="font-body-sm text-body-sm text-text-secondary">
              Reach the maintainers directly.
            </span>
          </a>
          <a
            href="#/privacy"
            className="bg-surface-panel border border-border-subtle rounded-xl p-4 flex flex-col gap-2 hover:border-[#FF9D63]/60 transition-colors"
          >
            <span className="material-symbols-outlined">shield</span>
            <span className="font-headline-md text-headline-md">Privacy</span>
            <span className="font-body-sm text-body-sm text-text-secondary">
              Read the privacy policy.
            </span>
          </a>
          <a
            href="#/terms"
            className="bg-surface-panel border border-border-subtle rounded-xl p-4 flex flex-col gap-2 hover:border-[#FF9D63]/60 transition-colors"
          >
            <span className="material-symbols-outlined">description</span>
            <span className="font-headline-md text-headline-md">Terms</span>
            <span className="font-body-sm text-body-sm text-text-secondary">
              Read the terms of service.
            </span>
          </a>
        </div>

        {/* FAQ */}
        <section className="flex flex-col gap-4">
          <h2 className="font-headline-md text-headline-md text-text-primary border-b border-border-subtle pb-3">
            Frequently Asked Questions
          </h2>
          <ul className="flex flex-col gap-3">
            {FAQS.map((item) => (
              <li
                key={item.q}
                className="bg-surface-panel border border-border-subtle rounded-xl p-5"
              >
                <p className="font-headline-md text-headline-md text-text-primary">
                  {item.q}
                </p>
                <p className="font-body-base text-body-base text-text-secondary mt-2 leading-relaxed">
                  {item.a}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="relative z-10 w-full flex flex-col md:flex-row justify-between items-center px-margin-desktop py-6 border-t border-border-subtle">
        <p className="font-body-sm text-body-sm text-text-secondary">
          © 2026 OfficePulse. Developed by Team If_it_works_it_works.
        </p>
        <nav className="flex gap-4 mt-2 md:mt-0 font-label-caps text-label-caps text-text-secondary">
          <a className="hover:text-text-primary transition-colors" href="#/privacy">
            Privacy Policy
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

export default Support;