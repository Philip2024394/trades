"use client";

// General support ticket form. Reports every non-DMCA category:
// content report / privacy request / account / billing / general.

import { useState } from "react";
import { Check, Loader2, Send } from "lucide-react";

const BRAND_BLACK = "#0A0A0A";
const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN = "#166534";
const RED = "#B91C1C";

const MIN_DESCRIPTION = 40;
const MAX_DESCRIPTION = 6000;

const KIND_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "general",         label: "General question" },
  { value: "account",         label: "Account issue" },
  { value: "billing",         label: "Billing / subscription" },
  { value: "content_report",  label: "Report content" },
  { value: "privacy_request", label: "Privacy / data request (GDPR)" },
  { value: "ip_infringement", label: "IP claim (non-DMCA)" },
  { value: "defamation",      label: "Defamation / false statement" }
];

const ERROR_COPY: Record<string, string> = {
  "name-too-short":        "Please add your name.",
  "invalid-email":         "Please add a valid email address.",
  "subject-too-short":     "Please summarise your issue in the subject.",
  "description-too-short": `Please describe the issue in at least ${MIN_DESCRIPTION} characters.`,
  "description-too-long":  "Description is too long — please trim.",
  "consent-required":      "Please tick the consent box.",
  "rate-limited":          "Too many submissions from your IP. Try again in an hour.",
  "db-insert-failed":      "Something went wrong on our end. Try again.",
  "network-error":         "Network error. Check your connection and try again."
};

export function SupportTicketForm() {
  const [kind, setKind] = useState("general");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setErrorKey(null);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("reporterName", name.trim());
    fd.set("reporterEmail", email.trim());
    fd.set("subject", subject.trim());
    fd.set("description", description.trim());
    if (targetUrl.trim()) fd.set("targetUrl", targetUrl.trim());
    fd.set("consented", consented ? "true" : "false");
    try {
      const res = await fetch("/api/support/tickets", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setErrorKey(typeof data.error === "string" ? data.error : "network-error");
        return;
      }
      setSubmittedId(data.ticketId ?? null);
    } catch {
      setErrorKey("network-error");
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedId) {
    return (
      <div className="mt-6 rounded-2xl border p-5 text-center" style={{ borderColor: `${BRAND_GREEN}55`, backgroundColor: "rgba(22,101,52,0.05)" }}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: `${BRAND_GREEN}18` }}>
          <Check size={22} strokeWidth={2.6} style={{ color: BRAND_GREEN }}/>
        </div>
        <h3 className="mt-2 text-[18px] font-black text-neutral-900">Ticket received.</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-700">
          We&apos;ll reply to <strong>{email}</strong>. Ref: <span className="font-mono text-[11px]">{submittedId.slice(0, 8)}</span>.
        </p>
      </div>
    );
  }

  const canSubmit =
    !submitting &&
    name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    subject.trim().length >= 4 &&
    description.trim().length >= MIN_DESCRIPTION &&
    consented;

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mt-6 flex flex-col gap-3">
      <label className="block">
        <div className="mb-1 text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-600">Category</div>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
          {KIND_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <div className="mb-1 text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-600">Your name <span style={{ color: RED }}>*</span></div>
          <input type="text" value={name} onChange={(e) => setName(e.target.value.slice(0, 120))} placeholder="Sam Wright" className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2" style={{ borderColor: "rgba(139,69,19,0.15)" }}/>
        </label>
        <label className="block">
          <div className="mb-1 text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-600">Email <span style={{ color: RED }}>*</span></div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value.slice(0, 200))} placeholder="sam@example.com" className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2" style={{ borderColor: "rgba(139,69,19,0.15)" }}/>
        </label>
      </div>

      <label className="block">
        <div className="mb-1 text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-600">Subject <span style={{ color: RED }}>*</span></div>
        <input type="text" value={subject} onChange={(e) => setSubject(e.target.value.slice(0, 200))} placeholder="Short summary" className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2" style={{ borderColor: "rgba(139,69,19,0.15)" }}/>
      </label>

      <label className="block">
        <div className="mb-1 text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-600">
          Related URL <span className="text-neutral-400">(optional)</span>
        </div>
        <input type="url" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value.slice(0, 500))} placeholder="https://thenetworkers.app/..." className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2" style={{ borderColor: "rgba(139,69,19,0.15)" }}/>
      </label>

      <label className="block">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-600">Description <span style={{ color: RED }}>*</span></span>
          <span className="text-[10px] text-neutral-400">{description.trim().length}/{MAX_DESCRIPTION} · min {MIN_DESCRIPTION}</span>
        </div>
        <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))} rows={6} placeholder="Please describe your issue in detail." className="w-full resize-none rounded-lg border bg-white px-3 py-2.5 text-[13px] leading-relaxed focus:outline-none focus:ring-2" style={{ borderColor: "rgba(139,69,19,0.15)" }}/>
      </label>

      <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-[11.5px] leading-snug text-neutral-800" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
        <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} className="mt-0.5 h-4 w-4 flex-shrink-0"/>
        <span>I&apos;m happy for Thenetworkers to email me about this ticket.</span>
      </label>

      {errorKey && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-black" style={{ color: RED }}>
          {ERROR_COPY[errorKey] ?? "Something went wrong."}
        </div>
      )}

      <button type="submit" disabled={!canSubmit} className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-3 text-[12px] font-black uppercase tracking-wider text-white shadow-md transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: canSubmit ? BRAND_BLACK : "#525252", color: canSubmit ? BRAND_YELLOW : "#e5e5e5" }}>
        {submitting ? <Loader2 size={13} className="animate-spin"/> : <Send size={13} strokeWidth={2.6}/>}
        {submitting ? "Sending…" : "Submit ticket"}
      </button>
    </form>
  );
}
