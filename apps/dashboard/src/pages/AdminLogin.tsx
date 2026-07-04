import { useState, type FormEvent } from "react";
import { BrandMark } from "../components/BrandMark";
import { verifyControlPin, verifyPlatformPin } from "../lib/api";

export function AdminLogin() {
  const [securityKey, setSecurityKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const pin = securityKey.trim();
      await verifyPlatformPin(pin);
      await verifyControlPin(pin);
      window.location.hash = "#/overview";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to authenticate.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-bg-deep text-text-primary antialiased">
      <main
        className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(135deg, rgba(255,157,99,0.13), transparent 32%, rgba(0,0,0,0.35))",
          backgroundSize: "56px 56px, 56px 56px, 100% 100%"
        }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-[#FF9D63]/40" />
        <div className="absolute inset-y-0 left-0 hidden w-px bg-white/10 lg:block" />
        <div className="absolute inset-y-0 right-0 hidden w-px bg-white/10 lg:block" />

        <section className="relative w-full max-w-5xl rounded-xl border border-white/10 bg-black/40 shadow-[0_28px_110px_rgba(0,0,0,0.72)] backdrop-blur-2xl">
          <div className="grid min-h-[560px] grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex flex-col justify-between border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
              <div>
                <BrandMark className="h-16 w-auto" width={190} height={130} />
                <div className="mt-12 max-w-xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#FF9D63]/30 bg-[#FF9D63]/10 px-3 py-1 font-label-caps text-label-caps uppercase text-[#FF9D63]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FF9D63]" />
                    Admin Console
                  </div>
                  <h1 className="mt-5 max-w-md text-[34px] font-semibold leading-[1.08] text-white sm:text-[44px]">
                    OfficePulse control.
                  </h1>
                  <p className="mt-4 max-w-sm font-body-base text-body-base text-text-secondary">
                    Live office systems, protected behind one PIN.
                  </p>
                </div>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-3 lg:max-w-xl">
                <StatusTile icon="bolt" value="Live" tone="orange" />
                <StatusTile icon="shield" value="Locked" tone="neutral" />
                <StatusTile icon="monitoring" value="Online" tone="green" />
              </div>
            </div>

            <div className="flex items-center justify-center p-6 sm:p-8 lg:p-10">
              <div className="w-full max-w-md">
                <div className="mb-4 rounded-xl border border-white/10 bg-[#111111]/65 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="mt-1 font-body-base text-body-base font-semibold text-text-primary">
                        Secure session
                      </p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#FF9D63]/30 bg-[#FF9D63]/10">
                      <span className="material-symbols-outlined text-[20px]">lock</span>
                    </div>
                  </div>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="rounded-xl border border-white/10 bg-[#111111]/75 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
                >
                  <div className="mb-6">
                    <h2 className="font-headline-md text-headline-md text-text-primary">
                      Sign in
                    </h2>
                    <p className="mt-2 font-body-sm text-body-sm text-text-secondary">
                      Enter administrator PIN.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="font-label-caps text-label-caps uppercase text-text-secondary" htmlFor="security-key">
                      Administrator PIN
                    </label>
                    <div className="relative rounded-lg border border-white/15 bg-black/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors focus-within:border-[#FF9D63]/80">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px]">
                        key
                      </span>
                      <input
                        id="security-key"
                        name="security-key"
                        type={showKey ? "text" : "password"}
                        inputMode="numeric"
                        autoComplete="current-password"
                        placeholder="Enter PIN"
                        value={securityKey}
                        onChange={(event) => setSecurityKey(event.target.value)}
                        className="w-full rounded-lg bg-transparent py-3 pl-10 pr-11 font-metric-lg text-metric-lg text-text-primary placeholder:text-text-secondary focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((value) => !value)}
                        aria-label={showKey ? "Hide PIN" : "Show PIN"}
                        className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center text-text-secondary transition-colors hover:text-text-primary"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showKey ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p className="mt-4 rounded-lg border border-[#FF9D63]/40 bg-[#FF9D63]/10 px-3 py-2 font-body-sm text-body-sm text-[#FF9D63]">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || securityKey.trim().length === 0}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF9D63] py-3 font-body-base text-body-base font-semibold text-black shadow-[0_14px_32px_rgba(255,157,99,0.18)] transition-all hover:bg-[#FFB07F] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? "Authenticating" : "Enter Dashboard"}
                    <span className="material-symbols-outlined text-[18px]" style={{ color: "#000" }}>
                      arrow_forward
                    </span>
                  </button>

                  <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 font-body-sm text-body-sm text-text-secondary">
                    <span>Protected controls</span>
                    <a href="#/support" className="text-[#FF9D63] transition-colors hover:text-[#FFB07F]">
                      Support
                    </a>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatusTile({
  icon,
  value,
  tone
}: {
  icon: string;
  value: string;
  tone: "orange" | "green" | "neutral";
}) {
  const toneClass =
    tone === "orange"
      ? "border-[#FF9D63]/30 bg-[#FF9D63]/10 text-[#FF9D63]"
      : tone === "green"
        ? "border-[#FF9D63]/25 bg-[#FF9D63]/10 text-[#FFB07F]"
        : "border-white/10 bg-black/25 text-text-primary";

  return (
    <div className="rounded-lg border border-white/10 bg-[#111111]/65 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl">
      <div className="flex items-center justify-center gap-2">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${toneClass}`}>
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </div>
        <div className="truncate font-body-sm text-body-sm font-semibold text-text-primary">{value}</div>
      </div>
    </div>
  );
}

export default AdminLogin;
