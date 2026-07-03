import { useState, type FormEvent } from "react";

export function AdminLogin() {
  const [adminId, setAdminId] = useState("");
  const [securityKey, setSecurityKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Placeholder: wire up to /api/auth/login once the API contract is finalized.
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center text-text-primary antialiased bg-bg-deep relative overflow-hidden">
      {/* Ambient Background Lighting */}
      <div className="absolute inset-0 pointer-events-none flex justify-center items-center z-0 opacity-20">
        <div className="w-[800px] h-[800px] bg-secondary-container rounded-full blur-[120px] mix-blend-screen opacity-10 animate-pulse" />
      </div>

      {/* Main Container */}
      <main className="w-full max-w-[420px] px-gutter z-10 relative flex-1 flex flex-col justify-center">
        {/* Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <picture>
            <source
              srcSet="https://i.imgur.com/13VMp4Q.webp"
              type="image/webp"
              onError={(e) => {
                (e.currentTarget.parentElement?.querySelector('img') as HTMLImageElement | null)?.setAttribute('src', 'https://i.imgur.com/13VMp4Q.jpg');
              }}
            />
            <img
              src="https://i.imgur.com/13VMp4Q.png"
              alt="OfficePulse"
              width={320}
              height={220}
              loading="eager"
              decoding="async"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src.endsWith('.png')) {
                  img.src = 'https://i.imgur.com/13VMp4Q.jpg';
                } else if (img.src.endsWith('.jpg')) {
                  img.src = 'https://i.imgur.com/13VMp4Q.jpeg';
                }
              }}
              className="w-[200px] h-auto mb-4 select-none"
              draggable={false}
            />
          </picture>

          <p className="font-label-caps text-label-caps text-text-secondary mt-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_#ffb3b3]" />
            SECURE PROTOCOL ACTIVE
          </p>
        </div>

        {/* Login Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-surface-panel backdrop-blur-[20px] border border-border-subtle rounded-xl p-8 flex flex-col gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
        >
          {/* Inner Glow */}
          <div className="absolute inset-0 pointer-events-none rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" />

          {/* Administrator ID */}
          <div className="flex flex-col gap-2">
            <label
              className="font-label-caps text-label-caps text-text-secondary uppercase"
              htmlFor="admin-id"
            >
              Administrator ID
            </label>
            <div className="relative gradient-border-glow rounded-lg transition-all duration-200">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px]">
                person
              </span>
              <input
                id="admin-id"
                name="admin-id"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Enter ID"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                className="w-full bg-transparent rounded-lg py-3 pl-10 pr-4 font-body-base text-body-base text-primary placeholder:text-text-secondary placeholder:opacity-60 focus:outline-none focus:ring-0 focus:border-transparent transition-colors"
              />
            </div>
          </div>

          {/* Security Key */}
          <div className="flex flex-col gap-2">
            <label
              className="font-label-caps text-label-caps text-text-secondary uppercase"
              htmlFor="security-key"
            >
              Security Key
            </label>
            <div className="relative gradient-border-glow rounded-lg transition-all duration-200">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px]">
                key
              </span>
              <input
                id="security-key"
                name="security-key"
                type={showKey ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={securityKey}
                onChange={(e) => setSecurityKey(e.target.value)}
                className="w-full bg-transparent border-border-subtle rounded-lg py-3 pl-10 pr-10 font-metric-lg text-metric-lg text-primary placeholder:text-surface-variant focus:outline-none focus:ring-0 focus:border-transparent transition-colors tracking-widest"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? "Hide security key" : "Show security key"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary transition-colors focus:outline-none"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showKey ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-4 mt-2">
            <button
              type="submit"
              className="w-full btn-gradient py-3 rounded-lg font-body-base text-body-base font-semibold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
            >
              Authenticate
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ color: "#000" }}
              >
                arrow_forward
              </span>
            </button>
            <div className="flex justify-between items-center font-body-sm text-body-sm text-text-secondary">
              <a className="hover:text-primary transition-colors" href="#">
                Forgot Credentials?
              </a>
              <a
                className="hover:text-primary transition-colors flex items-center gap-1"
                href="#"
              >
                <span className="material-symbols-outlined text-[14px]">
                  help
                </span>
                Support
              </a>
            </div>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="w-full flex flex-col md:flex-row justify-between items-center px-margin-desktop py-gutter text-center md:text-left z-10 bg-transparent absolute bottom-0">
        <p className="font-body-sm text-body-sm text-text-secondary opacity-80 hover:opacity-100 transition-opacity duration-200">
          © 2024 Eco-Flow Systems. All rights reserved.
        </p>
        <nav className="flex gap-4 mt-2 md:mt-0 font-label-caps text-label-caps text-text-secondary">
          <a
            className="hover:text-primary transition-colors duration-200 opacity-80 hover:opacity-100"
            href="#"
          >
            Privacy Policy
          </a>
          <a
            className="hover:text-primary transition-colors duration-200 opacity-80 hover:opacity-100"
            href="#"
          >
            Terms of Service
          </a>
          <a
            className="hover:text-primary transition-colors duration-200 opacity-80 hover:opacity-100"
            href="#"
          >
            Contact Support
          </a>
        </nav>
      </footer>
    </div>
  );
}

export default AdminLogin;
