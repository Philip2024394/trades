"use client";

// Report Content button — flag icon that opens a small modal, lets
// the viewer pick a reason + describe, submits a support ticket
// against a specific piece of content. Reasons that map to CSAM /
// sexual_content trigger IMMEDIATE auto-hide of the reported
// content via /api/support/tickets (see supportTickets.insertTicket).
//
// Wire on any user-content surface: Site Interest cards, canteen
// feed posts, image submissions, canteen page hero, etc.

import { useCallback, useEffect, useState } from "react";
import { Flag, Check, Loader2, X, AlertTriangle } from "lucide-react";
import type { TicketKind, TicketTargetKind } from "@/lib/supportTickets";

const BRAND_BLACK = "#0A0A0A";
const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN = "#166534";
const RED = "#B91C1C";

const MIN_DESCRIPTION = 40;

type ReasonOption = {
  kind: TicketKind;
  label: string;
  hint: string;
  autoHides: boolean;
};

const REASONS: ReasonOption[] = [
  { kind: "csam_report",     label: "Child sexual abuse material (CSAM)",  hint: "Immediately auto-hidden + reported to authorities.", autoHides: true },
  { kind: "sexual_content",  label: "Sexual or nudity content",             hint: "Immediately auto-hidden pending review.",           autoHides: true },
  { kind: "ip_infringement", label: "Copyright / trademark infringement",   hint: "For formal DMCA use the takedown form.",            autoHides: false },
  { kind: "defamation",      label: "Defamation / false statement",         hint: "Reviewed within 24 hours.",                         autoHides: false },
  { kind: "content_report",  label: "Off-topic / harassment / spam",        hint: "Reviewed within 48 hours.",                         autoHides: false }
];

const ERROR_COPY: Record<string, string> = {
  "name-too-short":        "Please add your name.",
  "invalid-email":         "Please add a valid email.",
  "subject-too-short":     "Please add a short subject.",
  "description-too-short": `Please describe the issue in at least ${MIN_DESCRIPTION} characters.`,
  "consent-required":      "Please tick the consent box.",
  "rate-limited":          "Too many reports from your IP. Try again later.",
  "db-insert-failed":      "Something went wrong. Try again.",
  "network-error":         "Network error. Check your connection."
};

export type ReportContentContext = {
  targetKind: TicketTargetKind;
  targetId: string;
  targetUrl?: string;
  targetLabel?: string; // human-readable, e.g. "post by Mike Watson" or "image of loft ladder"
};

export function ReportContentButton({
  context,
  variant = "icon"
}: {
  context: ReportContentContext;
  variant?: "icon" | "text";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "text"
            ? "inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 hover:text-red-700"
            : "inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-red-700"
        }
        aria-label="Report content"
        title="Report this content"
      >
        <Flag size={variant === "text" ? 11 : 12} strokeWidth={2.4}/>
        {variant === "text" && "Report"}
      </button>
      {open && <ReportContentModal context={context} onClose={() => setOpen(false)}/>}
    </>
  );
}

/** Exported so consumers with their own trigger (e.g. a menu item
 *  inside a card's 3-dots dropdown) can render the modal directly
 *  and manage open/close themselves. Same behaviour as the icon
 *  button's internal modal. */
export function ReportContentModal({
  context,
  onClose
}: {
  context: ReportContentContext;
  onClose: () => void;
}) {
  const [reasonKind, setReasonKind] = useState<TicketKind>("content_report");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const selectedReason = REASONS.find((r) => r.kind === reasonKind) ?? REASONS[0];

  const submit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorKey(null);
    const fd = new FormData();
    fd.set("kind", reasonKind);
    fd.set("reporterName", name.trim());
    fd.set("reporterEmail", email.trim());
    fd.set("subject", `[${reasonKind}] ${context.targetLabel ?? context.targetKind}`);
    fd.set("description", description.trim());
    fd.set("targetKind", context.targetKind);
    fd.set("targetId", context.targetId);
    if (context.targetUrl) fd.set("targetUrl", context.targetUrl);
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
  }, [submitting, reasonKind, name, email, description, consented, context]);

  const canSubmit =
    !submitting &&
    name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    description.trim().length >= MIN_DESCRIPTION &&
    consented;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6"
      style={{ backgroundColor: "rgba(10,10,10,0.80)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between px-5 py-2.5 sm:px-6" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }} aria-hidden>
              <Flag size={12} strokeWidth={2.6}/>
            </span>
            <span className="text-[11px] font-black uppercase tracking-[0.18em]">Report content</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-black/10">
            <X size={15} strokeWidth={2.6}/>
          </button>
        </div>
        <div className="p-5 sm:p-6">
          {submittedId ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: `${BRAND_GREEN}18` }}>
                <Check size={22} strokeWidth={2.6} style={{ color: BRAND_GREEN }}/>
              </div>
              <h3 className="mt-2 text-[17px] font-black text-neutral-900">Report received.</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-700">
                {selectedReason.autoHides
                  ? "Content has been hidden pending review."
                  : "Reviewed within our SLA and actioned if it breaches our terms."}
                {" "}Ref: <span className="font-mono text-[10px]">{submittedId.slice(0, 8)}</span>.
              </p>
              <button type="button" onClick={onClose} className="mt-3 inline-flex rounded-full border px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-neutral-800 hover:bg-neutral-50" style={{ borderColor: "rgba(139,69,19,0.15)" }}>Close</button>
            </div>
          ) : (
            <>
              <p className="text-[12.5px] leading-snug text-neutral-700">
                Reporting: <strong>{context.targetLabel ?? context.targetKind}</strong>.
              </p>

              <div className="mt-3">
                <div className="text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-600">Why are you reporting?</div>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {REASONS.map((r) => (
                    <li key={r.kind}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-2 hover:bg-neutral-50" style={{ borderColor: reasonKind === r.kind ? BRAND_BLACK : "rgba(139,69,19,0.15)" }}>
                        <input type="radio" name="reason" value={r.kind} checked={reasonKind === r.kind} onChange={() => setReasonKind(r.kind)} className="mt-0.5 h-4 w-4 flex-shrink-0"/>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[12px] font-black text-neutral-900">
                            {r.label}
                            {r.autoHides && <span className="inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[8.5px] font-black uppercase tracking-wider" style={{ backgroundColor: RED, color: "#FFFFFF" }}><AlertTriangle size={8}/>Auto-hides</span>}
                          </div>
                          <div className="text-[10.5px] text-neutral-500">{r.hint}</div>
                        </div>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-600">Your name <span style={{ color: RED }}>*</span></div>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value.slice(0, 120))} className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2" style={{ borderColor: "rgba(139,69,19,0.15)" }}/>
                </label>
                <label className="block">
                  <div className="mb-1 text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-600">Email <span style={{ color: RED }}>*</span></div>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value.slice(0, 200))} className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2" style={{ borderColor: "rgba(139,69,19,0.15)" }}/>
                </label>
              </div>

              <label className="mt-3 block">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-600">Describe the problem <span style={{ color: RED }}>*</span></span>
                  <span className="text-[10px] text-neutral-400">{description.trim().length}/{MIN_DESCRIPTION * 20} · min {MIN_DESCRIPTION}</span>
                </div>
                <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, MIN_DESCRIPTION * 20))} rows={4} placeholder="Explain what's wrong. The more specific the better." className="w-full resize-none rounded-lg border bg-white px-3 py-2 text-[13px] leading-snug focus:outline-none focus:ring-2" style={{ borderColor: "rgba(139,69,19,0.15)" }}/>
              </label>

              <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-[11.5px] leading-snug text-neutral-800" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
                <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} className="mt-0.5 h-4 w-4 flex-shrink-0"/>
                <span>I&apos;m happy for Thenetworkers to email me about this report.</span>
              </label>

              {errorKey && (
                <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-black" style={{ color: RED }}>
                  {ERROR_COPY[errorKey] ?? "Something went wrong."}
                </div>
              )}

              <button type="button" onClick={submit} disabled={!canSubmit} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: canSubmit ? BRAND_BLACK : "#525252", color: canSubmit ? BRAND_YELLOW : "#e5e5e5" }}>
                {submitting ? <Loader2 size={12} className="animate-spin"/> : <Flag size={12} strokeWidth={2.6}/>}
                {submitting ? "Sending…" : "Submit report"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
