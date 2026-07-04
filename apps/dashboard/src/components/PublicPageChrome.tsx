import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";

type PublicPageShellProps = {
  children: ReactNode;
  backFallback?: string;
  maxWidth?: string;
};

export function PublicPageShell({
  children,
  backFallback = "#/support",
  maxWidth = "max-w-6xl"
}: PublicPageShellProps) {
  return (
    <div className="min-h-screen bg-bg-deep text-text-primary antialiased">
      <div
        className="flex min-h-screen flex-col"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(135deg, rgba(255,157,99,0.12), transparent 32%, rgba(0,0,0,0.35))",
          backgroundSize: "56px 56px, 56px 56px, 100% 100%"
        }}
      >
        <PublicHeader backFallback={backFallback} />
        <main className={`mx-auto flex w-full ${maxWidth} flex-1 flex-col gap-6 px-4 py-8 sm:px-8 lg:py-12`}>
          {children}
        </main>
        <PublicFooter />
      </div>
    </div>
  );
}

function PublicHeader({ backFallback }: { backFallback: string }) {
  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.hash = backFallback.replace(/^#/, "");
  };

  return (
    <header className="w-full border-b border-white/10 bg-black/45 px-4 py-4 backdrop-blur-2xl sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <a href="#/login" className="flex items-center gap-3">
          <BrandMark className="h-10 w-auto" width={160} height={110} />
          <span className="hidden font-headline-md text-headline-md sm:inline">OfficePulse</span>
        </a>
        <div className="flex items-center gap-2">
          <a
            href="#/support"
            className="hidden rounded-lg border border-white/10 bg-[#111111]/70 px-3 py-2 font-label-caps text-label-caps uppercase text-text-secondary transition-colors hover:border-[#FF9D63]/50 hover:text-text-primary sm:inline-flex"
          >
            Help
          </a>
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#111111]/70 px-3 py-2 font-label-caps text-label-caps uppercase text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:border-[#FF9D63]/50 hover:text-[#FF9D63]"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back
          </button>
        </div>
      </div>
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className="w-full border-t border-white/10 bg-black/45 px-4 py-5 backdrop-blur-2xl sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 md:flex-row">
        <p className="font-body-sm text-body-sm text-text-secondary">
          © 2026 OfficePulse. Team If_it_works_it_works.
        </p>
        <nav className="flex gap-4 font-label-caps text-label-caps text-text-secondary">
          <a className="transition-colors hover:text-text-primary" href="#/support">
            Support
          </a>
          <a className="transition-colors hover:text-text-primary" href="#/privacy">
            Privacy
          </a>
          <a className="transition-colors hover:text-text-primary" href="#/terms">
            Terms
          </a>
          <a className="transition-colors hover:text-text-primary" href="#/contact">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}

export function GlassPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-xl border border-white/10 bg-black/40 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl ${className}`}
    >
      {children}
    </section>
  );
}
