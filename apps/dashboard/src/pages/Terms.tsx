import { BrandMark } from "../components/BrandMark";

type Section = {
  title: string;
  body: string;
};

const SECTIONS: Section[] = [
  {
    title: "Acceptance of Terms",
    body: "By accessing OfficePulse, you agree to these Terms of Service. If you do not agree, do not use the dashboard or any related services.",
  },
  {
    title: "Use of the Service",
    body: "OfficePulse is provided to authorized administrators for monitoring and controlling office infrastructure. You agree not to attempt to bypass authentication, interfere with other sessions, or republish telemetry without permission.",
  },
  {
    title: "Account Responsibility",
    body: "Administrators are responsible for keeping their session tokens, PIN, and credentials secure. OfficePulse is not liable for actions taken under a valid session.",
  },
  {
    title: "Service Availability",
    body: "OfficePulse is provided as-is. We work to keep the dashboard responsive, but we do not guarantee uninterrupted access. Maintenance windows are announced in advance when possible.",
  },
  {
    title: "Limitation of Liability",
    body: "To the maximum extent permitted by law, OfficePulse and its maintainers are not liable for indirect or consequential damages arising from the use of the dashboard, including loss of data or device state.",
  },
  {
    title: "Changes to Terms",
    body: "We may update these terms as OfficePulse evolves. Continued use after changes are posted constitutes acceptance of the revised terms. The last-updated date below reflects the current version.",
  },
];

export function Terms() {
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
            Terms of Service
          </h1>
          <p className="font-body-base text-body-base text-text-secondary mt-3">
            Last updated January 2026. Please read these terms carefully before
            using OfficePulse.
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
      </main>

      <footer className="relative z-10 w-full flex flex-col md:flex-row justify-between items-center px-margin-desktop py-6 border-t border-border-subtle">
        <p className="font-body-sm text-body-sm text-text-secondary">
          © 2026 OfficePulse. Developed by Team If_it_works_it_works.
        </p>
        <nav className="flex gap-4 mt-2 md:mt-0 font-label-caps text-label-caps text-text-secondary">
          <a className="hover:text-text-primary transition-colors" href="#/support">
            Support
          </a>
          <a className="hover:text-text-primary transition-colors" href="#/privacy">
            Privacy Policy
          </a>
          <a className="hover:text-text-primary transition-colors" href="#/contact">
            Contact Support
          </a>
        </nav>
      </footer>
    </div>
  );
}

export default Terms;