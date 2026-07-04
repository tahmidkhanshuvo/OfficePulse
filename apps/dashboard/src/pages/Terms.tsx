import { GlassPanel, PublicPageShell } from "../components/PublicPageChrome";

type Section = {
  title: string;
  body: string;
};

const SECTIONS: Section[] = [
  {
    title: "Acceptance of Terms",
    body: "By accessing OfficePulse, you agree to these Terms of Service. If you do not agree, do not use the dashboard or related services.",
  },
  {
    title: "Use of the Service",
    body: "OfficePulse is for authorized administrators monitoring and controlling office infrastructure. Do not bypass authentication or interfere with other sessions.",
  },
  {
    title: "Account Responsibility",
    body: "Administrators are responsible for keeping PINs, credentials, and sessions secure. Valid session activity is treated as authorized activity.",
  },
  {
    title: "Service Availability",
    body: "OfficePulse is provided as-is. We work to keep the dashboard responsive, but uninterrupted access is not guaranteed.",
  },
  {
    title: "Limitation of Liability",
    body: "OfficePulse and its maintainers are not liable for indirect or consequential damages arising from dashboard use.",
  },
  {
    title: "Changes to Terms",
    body: "We may update these terms as OfficePulse evolves. Continued use after updates means acceptance of the revised terms.",
  },
];

export function Terms() {
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
              Terms of Service
            </h1>
            <p className="mt-3 max-w-xl font-body-base text-body-base text-text-secondary">
              Last updated January 2026.
            </p>
          </div>
          <a
            href="#/privacy"
            className="inline-flex items-center gap-2 self-start rounded-lg border border-white/10 bg-[#111111]/70 px-4 py-3 font-body-sm text-body-sm font-semibold text-text-primary transition-colors hover:border-[#FF9D63]/50 lg:self-end"
          >
            Privacy
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

export default Terms;
