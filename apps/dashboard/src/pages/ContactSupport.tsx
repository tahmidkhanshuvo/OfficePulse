import { useState, type FormEvent, type ReactNode } from "react";
import { GlassPanel, PublicPageShell } from "../components/PublicPageChrome";

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

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <PublicPageShell>
      <GlassPanel className="p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF9D63]/30 bg-[#FF9D63]/10 px-3 py-1 font-label-caps text-label-caps uppercase text-[#FF9D63]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF9D63]" />
              Support
            </div>
            <h1 className="mt-5 text-[34px] font-semibold leading-tight text-white sm:text-[44px]">
              Contact Support
            </h1>
            <p className="mt-3 max-w-xl font-body-base text-body-base text-text-secondary">
              Send a message to the OfficePulse maintainers.
            </p>
          </div>
          <a
            href="#/support"
            className="inline-flex items-center gap-2 self-start rounded-lg border border-white/10 bg-[#111111]/70 px-4 py-3 font-body-sm text-body-sm font-semibold text-text-primary transition-colors hover:border-[#FF9D63]/50 lg:self-end"
          >
            Help Center
          </a>
        </div>
      </GlassPanel>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <GlassPanel className="p-5">
          <div className="flex h-full flex-col justify-between gap-8">
            <div>
              <span className="material-symbols-outlined text-[28px]">support_agent</span>
              <h2 className="mt-4 font-headline-md text-headline-md text-text-primary">
                Team If_it_works_it_works
              </h2>
              <p className="mt-2 font-body-base text-body-base text-text-secondary">
                We read support requests during active development.
              </p>
            </div>
            <div className="grid gap-3">
              <ContactLine icon="mail" label="Email" value="if-it-works-it-works@officepulse.local" />
              <ContactLine icon="schedule" label="Response" value="1-2 business days" />
              <ContactLine icon="shield" label="Access" value="Admin dashboard support" />
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          {submitted ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-[#FF9D63]" style={{ fontSize: "44px" }}>
                mark_email_read
              </span>
              <h2 className="mt-4 font-headline-md text-headline-md text-text-primary">
                Message received
              </h2>
              <p className="mt-2 max-w-sm font-body-base text-body-base text-text-secondary">
                Thanks for reaching out. The team will follow up soon.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setForm({ name: "", email: "", topic: "General Question", message: "" });
                }}
                className="mt-6 rounded-lg border border-[#FF9D63]/50 bg-[#FF9D63]/10 px-4 py-2 font-label-caps text-label-caps uppercase text-[#FF9D63] transition-colors hover:bg-[#FF9D63]/15"
              >
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="grid gap-4">
              <div>
                <h2 className="font-headline-md text-headline-md text-text-primary">Send a Message</h2>
                <p className="mt-1 font-body-sm text-body-sm text-text-secondary">
                  Describe the issue and include anything useful.
                </p>
              </div>
              <Field label="Your Name">
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Admin"
                  className="w-full rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-[#FF9D63]/70 focus:outline-none"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  placeholder="you@office.com"
                  className="w-full rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-[#FF9D63]/70 focus:outline-none"
                />
              </Field>
              <Field label="Topic">
                <select
                  value={form.topic}
                  onChange={(event) => setForm({ ...form, topic: event.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-sm text-text-primary focus:border-[#FF9D63]/70 focus:outline-none"
                >
                  <option className="bg-bg-deep">General Question</option>
                  <option className="bg-bg-deep">Bug Report</option>
                  <option className="bg-bg-deep">Feature Request</option>
                  <option className="bg-bg-deep">Account / Login Issue</option>
                  <option className="bg-bg-deep">Hardware / Device Issue</option>
                </select>
              </Field>
              <Field label="Message">
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                  placeholder="What can we help with?"
                  className="w-full resize-none rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-[#FF9D63]/70 focus:outline-none"
                />
              </Field>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#FF9D63] px-4 py-3 font-body-sm text-body-sm font-semibold text-black transition-colors hover:bg-[#FFB07F]"
              >
                Send Message
                <span className="material-symbols-outlined text-[18px]" style={{ color: "#000" }}>
                  send
                </span>
              </button>
            </form>
          )}
        </GlassPanel>
      </section>
    </PublicPageShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="font-label-caps text-label-caps uppercase text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

function ContactLine({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#111111]/70 p-3">
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      <div>
        <p className="font-label-caps text-label-caps uppercase text-text-secondary">{label}</p>
        <p className="mt-1 font-body-sm text-body-sm text-text-primary">{value}</p>
      </div>
    </div>
  );
}

export default ContactSupport;
