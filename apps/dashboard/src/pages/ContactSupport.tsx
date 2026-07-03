import { useState } from "react";
import { BrandMark } from "../components/BrandMark";

type FormState = {
  name: string;
  email: string;
  topic: string;
  message: string;
};

export function ContactSupport() {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    topic: "General Question",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Demo-only: acknowledge receipt locally. Real wire-up posts to /api/support.
    setSubmitted(true);
  };

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

      <main className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Contact card */}
        <section className="flex flex-col gap-6">
          <div>
            <span className="font-label-caps text-label-caps uppercase text-text-secondary">
              Get in Touch
            </span>
            <h1 className="font-headline-lg text-headline-lg text-text-primary mt-2">
              Contact Support
            </h1>
            <p className="font-body-base text-body-base text-text-secondary mt-3">
              OfficePulse is built and maintained by an independent student
              team. Use any of the channels below — we read everything.
            </p>
          </div>

          <div className="bg-surface-panel border border-border-subtle rounded-xl p-5 flex flex-col gap-4">
            <div>
              <p className="font-label-caps text-label-caps uppercase text-text-secondary">
                Maintained by
              </p>
              <p className="font-headline-md text-headline-md text-text-primary mt-1">
                Team If_it_works_it_works
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined">mail</span>
                <div>
                  <p className="font-label-caps text-label-caps uppercase text-text-secondary">
                    Email
                  </p>
                  <a
                    href="mailto:if-it-works-it-works@officepulse.local"
                    className="font-body-base text-body-base text-text-primary hover:text-[#FF9D63] transition-colors"
                  >
                    if-it-works-it-works@officepulse.local
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined">chat</span>
                <div>
                  <p className="font-label-caps text-label-caps uppercase text-text-secondary">
                    Discord
                  </p>
                  <p className="font-body-base text-body-base text-text-primary">
                    OfficePulse Help Server — invite shared on request
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined">schedule</span>
                <div>
                  <p className="font-label-caps text-label-caps uppercase text-text-secondary">
                    Response Time
                  </p>
                  <p className="font-body-base text-body-base text-text-primary">
                    Within 1–2 business days during active development
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Form */}
        <section className="bg-surface-panel backdrop-blur-[20px] border border-border-subtle rounded-xl p-6 flex flex-col gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" />
          <div className="relative z-10 flex flex-col gap-1">
            <h2 className="font-headline-md text-headline-md text-text-primary">
              Send a Message
            </h2>
            <p className="font-body-sm text-body-sm text-text-secondary">
              Describe what's going on and we'll follow up over email.
            </p>
          </div>

          {submitted ? (
            <div className="relative z-10 flex flex-col items-center text-center gap-3 py-10">
              <span className="material-symbols-outlined text-[#FF9D63]" style={{ fontSize: "40px" }}>
                mark_email_read
              </span>
              <p className="font-headline-md text-headline-md text-text-primary">
                Message received
              </p>
              <p className="font-body-base text-body-base text-text-secondary max-w-sm">
                Thanks for reaching out — Team If_it_works_it_works will get back
                to you within a couple of days.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setForm({ name: "", email: "", topic: "General Question", message: "" });
                }}
                className="font-label-caps text-label-caps uppercase text-[#FF9D63] hover:underline"
              >
                Send another →
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="relative z-10 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="contact-name"
                  className="font-label-caps text-label-caps uppercase text-text-secondary"
                >
                  Your Name
                </label>
                <input
                  id="contact-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Admin"
                  className="bg-transparent border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary placeholder:opacity-60 focus:outline-none focus:border-[#FF9D63]/60"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="contact-email"
                  className="font-label-caps text-label-caps uppercase text-text-secondary"
                >
                  Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@office.com"
                  className="bg-transparent border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary placeholder:opacity-60 focus:outline-none focus:border-[#FF9D63]/60"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="contact-topic"
                  className="font-label-caps text-label-caps uppercase text-text-secondary"
                >
                  Topic
                </label>
                <select
                  id="contact-topic"
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  className="bg-transparent border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-[#FF9D63]/60"
                >
                  <option className="bg-bg-deep">General Question</option>
                  <option className="bg-bg-deep">Bug Report</option>
                  <option className="bg-bg-deep">Feature Request</option>
                  <option className="bg-bg-deep">Account / Login Issue</option>
                  <option className="bg-bg-deep">Hardware / Device Issue</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="contact-message"
                  className="font-label-caps text-label-caps uppercase text-text-secondary"
                >
                  Message
                </label>
                <textarea
                  id="contact-message"
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="What can we help with?"
                  className="bg-transparent border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary placeholder:opacity-60 focus:outline-none focus:border-[#FF9D63]/60 resize-none custom-scrollbar"
                />
              </div>
              <button
                type="submit"
                className="btn-gradient font-label-caps text-label-caps uppercase rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                Send Message
                <span className="material-symbols-outlined text-[18px]" style={{ color: "#000" }}>
                  send
                </span>
              </button>
            </form>
          )}
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
          <a className="hover:text-text-primary transition-colors" href="#/terms">
            Terms of Service
          </a>
        </nav>
      </footer>
    </div>
  );
}

export default ContactSupport;