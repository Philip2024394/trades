"use client";

// DMCA takedown submit form. Fires against /api/support/tickets
// with kind=dmca_takedown pre-set.

import { useState } from "react";
import { Check, Loader2, Send, X } from "lucide-react";

const BRAND_BLACK = "#0A0A0A";
const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN = "#166534";
const RED = "#B91C1C";

const MIN_DESCRIPTION = 40;
const MAX_DESCRIPTION = 6000;
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;

const ERROR_COPY: Record<string, string> = {
  "name-too-short":            "Please add your name.",
  "invalid-email":             "Please add a valid email address.",
  "subject-too-short":         "Please summarise the issue in the subject.",
  "description-too-short":     `Please describe the infringement in at least ${MIN_DESCRIPTION} characters.`,
  "description-too-long":      "Description is too long — please trim.",
  "sworn-statement-required":  "You must tick the sworn-statement box to submit a takedown.",
  "consent-required":          "Please tick the consent box.",
  "rate-limited":              "Too many submissions from your IP. Try again in an hour or email takedown@thenetworkers.app directly.",
  "db-insert-failed":          "Something went wrong on our end. Try again or email takedown@thenetworkers.app.",
  "network-error":             "Network error. Check your connection and try again."
};

export function TakedownForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [claimedOwnership, setClaimedOwnership] = useState("");
  const [swornStatement, setSwornStatement] = useState(false);
  const [consented, setConsented] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => {
      const next = [...prev];
      for (const f of Array.from(list)) {
        if (next.length >= MAX_ATTACHMENTS) break;
        if (f.size > MAX_ATTACHMENT_BYTES) continue;
        if (!f.type.startsWith("image/") && f.type !== "application/pdf") continue;
        next.push(f);
      }
      return next;
    });
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setErrorKey(null);

    const fd = new FormData();
    fd.set("kind", "dmca_takedown");
    fd.set("reporterName", name.trim());
    fd.set("reporterEmail", email.trim());
    fd.set("reporterPhone", phone.trim());
    fd.set("subject", subject.trim() || "Copyright takedown");
    fd.set("description", description.trim());
    fd.set("targetUrl", targetUrl.trim());
    fd.set("claimedOwnership", claimedOwnership.trim());
    fd.set("swornStatement", swornStatement ? "true" : "false");
    fd.set("consented", consented ? "true" : "false");
    for (const f of files) fd.append("attachments", f);

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
        <h3 className="mt-2 text-[18px] font-black text-neutral-900">Notice received.</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-700">
          We&apos;ll review within <strong>24 hours</strong> and email you at the address you provided. Ref: <span className="font-mono text-[11px]">{submittedId.slice(0, 8)}</span>.
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
    targetUrl.trim().length > 0 &&
    swornStatement &&
    consented;

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mt-6 flex flex-col gap-3">
      <FieldRow>
        <Field label="Your name" required>
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value.slice(0, 120))}
            placeholder="Sam Wright"
            className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          />
        </Field>
        <Field label="Email" required>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value.slice(0, 200))}
            placeholder="sam@example.com"
            className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          />
        </Field>
      </FieldRow>

      <Field label="Phone (optional)">
        <input
          type="tel" value={phone} onChange={(e) => setPhone(e.target.value.slice(0, 32))}
          placeholder="+44 …"
          className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        />
      </Field>

      <Field label="Subject" required hint="short — e.g. 'Unlicensed use of my product photos'">
        <input
          type="text" value={subject} onChange={(e) => setSubject(e.target.value.slice(0, 200))}
          placeholder="Unlicensed use of copyrighted photographs"
          className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        />
      </Field>

      <Field label="URL(s) of the infringing content" required hint="paste every affected page/image URL">
        <textarea
          value={targetUrl} onChange={(e) => setTargetUrl(e.target.value.slice(0, 2000))}
          rows={2} placeholder="https://thenetworkers.app/... (one per line if multiple)"
          className="w-full resize-none rounded-lg border bg-white px-3 py-2 text-[13px] leading-snug focus:outline-none focus:ring-2"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        />
      </Field>

      <Field label="Ownership claim" hint="who owns the copyright + your relationship to them">
        <textarea
          value={claimedOwnership} onChange={(e) => setClaimedOwnership(e.target.value.slice(0, 500))}
          rows={2} placeholder="I am the photographer; the image was first published on my site in 2024."
          className="w-full resize-none rounded-lg border bg-white px-3 py-2 text-[13px] leading-snug focus:outline-none focus:ring-2"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        />
      </Field>

      <Field
        label="Detailed description of the infringement"
        required
        hint={`${description.trim().length}/${MAX_DESCRIPTION} · min ${MIN_DESCRIPTION}`}
      >
        <textarea
          value={description} onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
          rows={6}
          placeholder="Describe the copyrighted work, how you can prove ownership, and how the content on our platform infringes it. Include registration numbers, filing dates, or first-publication dates where relevant."
          className="w-full resize-none rounded-lg border bg-white px-3 py-2.5 text-[13px] leading-relaxed focus:outline-none focus:ring-2"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        />
      </Field>

      <div>
        <div className="flex items-center justify-between">
          <div className="text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-600">
            Evidence attachments <span className="text-neutral-400">(optional, up to {MAX_ATTACHMENTS})</span>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-800 hover:bg-neutral-50" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
            Add file
            <input type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} disabled={files.length >= MAX_ATTACHMENTS}/>
          </label>
        </div>
        {files.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-[11px]" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
                <span className="truncate">{f.name} <span className="text-neutral-400">· {Math.round(f.size / 1024)}KB</span></span>
                <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-neutral-500 hover:text-red-600" aria-label={`Remove ${f.name}`}>
                  <X size={12}/>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-[11.5px] leading-snug text-neutral-800" style={{ borderColor: `${RED}55`, backgroundColor: "#FEF2F2" }}>
        <input type="checkbox" checked={swornStatement} onChange={(e) => setSwornStatement(e.target.checked)} className="mt-0.5 h-4 w-4 flex-shrink-0"/>
        <span>
          <strong>Sworn statement:</strong> I state, under penalty of perjury, that the information in this notice is accurate and that I am the copyright owner OR am authorised to act on the copyright owner&apos;s behalf. I understand that knowingly making a materially false statement can result in liability under UK CDPA 1988 or US DMCA 17 USC 512(f).
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-[11.5px] leading-snug text-neutral-800" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
        <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} className="mt-0.5 h-4 w-4 flex-shrink-0"/>
        <span>
          I&apos;m happy for Thenetworkers to email me at the address above about this notice.
        </span>
      </label>

      {errorKey && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-black" style={{ color: RED }}>
          {ERROR_COPY[errorKey] ?? "Something went wrong. Try again."}
        </div>
      )}

      <button
        type="submit" disabled={!canSubmit}
        className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-3 text-[12px] font-black uppercase tracking-wider text-white shadow-md transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ backgroundColor: canSubmit ? BRAND_BLACK : "#525252", color: canSubmit ? BRAND_YELLOW : "#e5e5e5" }}
      >
        {submitting ? <Loader2 size={13} className="animate-spin"/> : <Send size={13} strokeWidth={2.6}/>}
        {submitting ? "Sending…" : "Submit takedown notice"}
      </button>
    </form>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}
function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-600">
          {label}{required && <span className="ml-1" style={{ color: RED }}>*</span>}
        </span>
        {hint && <span className="text-[10px] text-neutral-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
