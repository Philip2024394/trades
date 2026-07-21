"use client";

// Case-study submission form.
//
// Networkers-member-facing form for submitting a real project for
// editorial feature. Posts to /api/case-studies/submit which fires a
// notification to the editorial inbox (no DB persistence yet — landed
// submissions become full published leaves after review + write-up).

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight, ClipboardList, ShieldCheck,
  CircleCheck, Loader2, AlertTriangle, Sparkles
} from "lucide-react";
import { SUBMISSION_CHECKLIST } from "../config";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export function SubmitForm() {
  const [merchantSlug,   setMerchantSlug]   = useState("");
  const [contactName,    setContactName]    = useState("");
  const [contactEmail,   setContactEmail]   = useState("");
  const [contactPhone,   setContactPhone]   = useState("");
  const [tradeSlug,      setTradeSlug]      = useState("");
  const [city,           setCity]           = useState("");
  const [projectTitle,   setProjectTitle]   = useState("");
  const [projectSummary, setProjectSummary] = useState("");
  const [finalCost,      setFinalCost]      = useState("");
  const [timeline,       setTimeline]       = useState("");
  const [wentWell,       setWentWell]       = useState("");
  const [wentWrong,      setWentWrong]      = useState("");
  const [photoLinks,     setPhotoLinks]     = useState("");
  const [homeownerConsent,   setHomeownerConsent]   = useState(false);
  const [publishConsent,     setPublishConsent]     = useState(false);
  const [invoiceShareable,   setInvoiceShareable]   = useState(false);
  const [submitting,     setSubmitting]     = useState(false);
  const [submitted,      setSubmitted]      = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  const valid =
    contactName.trim().length >= 2 &&
    /.+@.+\..+/.test(contactEmail) &&
    projectTitle.trim().length >= 6 &&
    projectSummary.trim().length >= 40 &&
    homeownerConsent && publishConsent && invoiceShareable;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/case-studies/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        merchant_slug:      merchantSlug,
        contact_name:       contactName,
        contact_email:      contactEmail,
        contact_phone:      contactPhone,
        trade_slug:         tradeSlug,
        city,
        project_title:      projectTitle,
        project_summary:    projectSummary,
        final_cost:         finalCost,
        timeline_summary:   timeline,
        went_well:          wentWell,
        went_wrong:         wentWrong,
        photo_links:        photoLinks,
        homeowner_consent:  homeownerConsent,
        publish_consent:    publishConsent,
        invoice_shareable:  invoiceShareable
      })
    });
    const json = await res.json().catch(() => ({ ok: false, error: "bad-response" }));
    setSubmitting(false);
    if (!json.ok) {
      setError(json.error || "submit-failed");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#FBF6EC]">
        <SeoSiteHeader/>
        <div className="mx-auto max-w-[720px] px-4 py-16 md:px-6">
          <div className="rounded-2xl border-2 bg-white p-8 shadow-sm md:p-10" style={{ borderColor: "#22C55E" }}>
            <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: "#DCFCE7" }}>
              <CircleCheck size={22} strokeWidth={2.6} className="text-green-700"/>
            </div>
            <h1 className="mt-4 text-[28px] font-black leading-tight text-neutral-900 md:text-[32px]">
              Submission received
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-neutral-700 md:text-[15px]">
              Our editorial team reviews every submission against the checklist. You'll hear back within 5-7 working days — either with a scheduled write-up date or with a specific gap we need you to fill.
            </p>
            <p className="mt-3 text-[13px] text-neutral-600">
              If your project is selected, we'll draft the write-up + share it for your review + your homeowner's review before publishing. You keep final approval.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/case-studies"
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm active:scale-[0.97]"
                style={{ backgroundColor: "#FFB300" }}
              >
                Back to case studies
                <ArrowUpRight size={12} strokeWidth={2.6}/>
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <div className="mx-auto max-w-[900px] px-4 py-8 md:px-6 md:py-12">
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/case-studies" className="hover:text-neutral-900">Case Studies</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">Submit</span>
        </nav>

        <header className="rounded-2xl border-2 p-6 md:p-8" style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-neutral-900"/>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-neutral-900">
              Free editorial feature · Networkers members only
            </p>
          </div>
          <h1 className="mt-2 text-[32px] font-black leading-tight text-neutral-900 md:text-[40px]">
            Submit a case study
          </h1>
          <p className="mt-3 text-[13.5px] leading-relaxed text-neutral-700">
            Real project. Real homeowner. Real photos. Real invoice. If it fits the checklist, we work with you to publish a full write-up — free PR + a permanent backlink to your Networkers trade profile.
          </p>
        </header>

        {/* Checklist */}
        <section className="mt-6 rounded-2xl border-2 bg-white p-5 shadow-sm md:p-6" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <div className="flex items-center gap-2">
            <ClipboardList size={14} className="text-neutral-700"/>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Before you submit — editorial checklist
            </p>
          </div>
          <ul className="mt-3 space-y-1.5">
            {SUBMISSION_CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[12.5px] text-neutral-800">
                <CircleCheck size={12} strokeWidth={2.4} className="mt-0.5 shrink-0 text-green-700"/>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Form */}
        <form
          onSubmit={submit}
          className="mt-6 rounded-2xl border-2 bg-white p-5 shadow-sm md:p-6"
          style={{ borderColor: "rgba(139,69,19,0.10)" }}
        >
          <Section title="About you">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Your Networkers profile slug (if you know it)">
                <input
                  value={merchantSlug}
                  onChange={(e) => setMerchantSlug(e.target.value)}
                  placeholder="e.g. oakwood-carpenter"
                  className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
              <Field label="Trade" required>
                <input
                  value={tradeSlug}
                  onChange={(e) => setTradeSlug(e.target.value)}
                  placeholder="e.g. carpenter"
                  className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
              <Field label="Your name" required>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="First + last"
                  className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
              <Field label="Email" required>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
              <Field label="Phone (optional)">
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="07..."
                  className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
              <Field label="City">
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Manchester"
                  className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
            </div>
          </Section>

          <Section title="The project">
            <div className="grid gap-4">
              <Field label="Project title" required>
                <input
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder='e.g. "Victorian kitchen extension + open-plan family room, Chorlton"'
                  className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
              <Field label="Project summary — 3-6 sentences" required>
                <textarea
                  value={projectSummary}
                  onChange={(e) => setProjectSummary(e.target.value)}
                  rows={5}
                  placeholder="What did you build? For whom? Any special constraints? Rough timeline?"
                  className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Final invoice total (£)">
                  <input
                    value={finalCost}
                    onChange={(e) => setFinalCost(e.target.value)}
                    placeholder="e.g. 48500"
                    className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] tabular-nums text-neutral-900"
                    style={{ borderColor: "rgba(139,69,19,0.20)" }}
                  />
                </Field>
                <Field label="Timeline summary">
                  <input
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    placeholder="e.g. 8 weeks Aug-Oct 2026"
                    className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-neutral-900"
                    style={{ borderColor: "rgba(139,69,19,0.20)" }}
                  />
                </Field>
              </div>
              <Field label="What went well (bullet list)">
                <textarea
                  value={wentWell}
                  onChange={(e) => setWentWell(e.target.value)}
                  rows={3}
                  placeholder="e.g. steel arrived Day 1, no weather delays, subs sequenced clean"
                  className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
              <Field label="What went wrong (be honest)">
                <textarea
                  value={wentWrong}
                  onChange={(e) => setWentWrong(e.target.value)}
                  rows={3}
                  placeholder="e.g. underestimated slate lead time, one variation cost £1,200"
                  className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
              <Field label="Photo links (Google Drive, Dropbox, WeTransfer)">
                <textarea
                  value={photoLinks}
                  onChange={(e) => setPhotoLinks(e.target.value)}
                  rows={2}
                  placeholder="Paste links to before + during + after photos"
                  className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
            </div>
          </Section>

          <Section title="Consents (all required)">
            <div className="space-y-3">
              <Checkbox
                label="I have written consent from the homeowner to publish this project (first name only or 'Anonymous')"
                checked={homeownerConsent}
                onChange={setHomeownerConsent}
                required
              />
              <Checkbox
                label="I consent to being featured on The Networkers with my trade profile linked"
                checked={publishConsent}
                onChange={setPublishConsent}
                required
              />
              <Checkbox
                label="I'm willing to share the invoice total in the write-up (we don't publish the invoice image itself)"
                checked={invoiceShareable}
                onChange={setInvoiceShareable}
                required
              />
            </div>
          </Section>

          {error && (
            <div className="mt-5 flex items-start gap-2 rounded-lg border-2 p-3" style={{ borderColor: "#EF4444", backgroundColor: "#FEF2F2" }}>
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-700"/>
              <p className="text-[12px] font-black text-red-900">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!valid || submitting}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-lg text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "#FFB300" }}
          >
            {submitting ? <><Loader2 size={14} className="animate-spin"/> Submitting</> : <><Sparkles size={14} strokeWidth={2.6}/> Submit for editorial review</>}
          </button>

          <p className="mt-3 flex items-center justify-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
            <ShieldCheck size={11}/> Every submission reviewed within 5-7 working days
          </p>
        </form>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t pt-5 first:mt-0 first:border-0 first:pt-0" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
      <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
        {label}
        {required && <span className="text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function Checkbox({ label, checked, onChange, required }: { label: string; checked: boolean; onChange: (v: boolean) => void; required?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border bg-white p-3 hover:bg-[#FBF6EC]" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required={required}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#FFB300]"
      />
      <span className="text-[12.5px] leading-snug text-neutral-800">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
    </label>
  );
}
