"use client";

// Shared homeowner→trade contact form.
//
// One component, multiple callsites (Site Interest "I like it, how
// much?" button + WhatsApp gate for guests + future Trade Center
// quote-request button). Fields, validation, and copy live here so
// they never drift across surfaces.
//
// Design rules (Philip 2026-07-16):
//   • Name always required. Phone OR email required (not both) so
//     mobile-only homeowners can submit without an email.
//   • Message ≥60 chars — the seriousness filter that stands in for
//     any per-lead payment.
//   • Up to 3 photo attachments (site / area / build photos), each
//     ≤4MB, image types only. Renders local previews so user
//     confirms the file loaded before submitting.
//   • Consent checkbox — required before submit. Stamps consented_at
//     on the row for GDPR.
//   • Submits as multipart/form-data to /api/quote-requests so
//     files stream in one request.

import { useCallback, useMemo, useState } from "react";
import { Camera, Check, Loader2, Paperclip, Send, X } from "lucide-react";

const BRAND_BLACK = "#0A0A0A";
const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN = "#166534";
const RED = "#B91C1C";

const MIN_MESSAGE = 60;
const MAX_MESSAGE = 4000;
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

const ERROR_COPY: Record<string, string> = {
  "name-too-short":     "Please add your name (at least 2 characters).",
  "name-too-long":      "Name is too long.",
  "contact-required":   "Please add a WhatsApp number OR an email so the trade can reply.",
  "invalid-email":      "That email doesn't look right — please check it.",
  "message-too-short":  `Please describe your project in at least ${MIN_MESSAGE} characters — the trade needs the detail to quote.`,
  "message-too-long":   "Your message is too long — please trim it a little.",
  "no-target-trade":    "Missing trade target — please reload the page.",
  "consent-required":   "Please tick the consent box to send your details.",
  "rate-limited":       "Too many requests from your device in the last hour. Try again shortly.",
  "invalid-multipart":  "Something went wrong with the upload — please try again.",
  "db-insert-failed":   "Couldn't save your request — please try again.",
  "network-error":      "Network error — check your connection and try again."
};

export type QuickContactContext = {
  /** The trade slug that receives the lead. Credit-chip trade for
   *  Site Interest submissions; nearest-1 for curated hero images. */
  targetTradeSlug: string;
  targetTradeName: string;
  /** Optional canteen slug for the lead-detail deep link. */
  targetCanteenSlug?: string | null;
  /** Provenance — echoed onto the row so admin can trace the lead
   *  back to the specific Site Interest image + source post. */
  sourceImageUrl?:  string | null;
  sourcePostId?:    string | null;
  sourceCanteenId?: string | null;
  /** Short project label used in the header + submitted message
   *  ("Kitchen extension in Manchester" → helps the trade understand
   *  the ask at a glance). Optional; falls back to "your project". */
  projectLabel?:    string;
};

export function QuickContactForm({
  context,
  onSuccess,
  onCancel
}: {
  context: QuickContactContext;
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const messageRemaining = MIN_MESSAGE - message.trim().length;
  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (name.trim().length < 2) return false;
    if (!email.trim() && phone.replace(/[^0-9]/g, "").length < 7) return false;
    if (message.trim().length < MIN_MESSAGE) return false;
    if (!consented) return false;
    return true;
  }, [name, email, phone, message, consented, submitting]);

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    setFiles((prev) => {
      const next: File[] = [...prev];
      for (const f of Array.from(incoming)) {
        if (next.length >= MAX_ATTACHMENTS) break;
        if (!f.type.startsWith("image/")) continue;
        if (f.size > MAX_ATTACHMENT_BYTES) continue;
        next.push(f);
      }
      return next;
    });
  }, []);

  const removeFile = useCallback((idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorKey(null);

    const fd = new FormData();
    fd.set("requesterName",     name.trim());
    fd.set("requesterEmail",    email.trim());
    fd.set("requesterPhone",    phone.trim());
    fd.set("message",           message.trim());
    fd.set("targetTradeSlug",   context.targetTradeSlug);
    if (context.targetCanteenSlug) fd.set("targetCanteenSlug", context.targetCanteenSlug);
    if (context.sourceImageUrl)    fd.set("sourceImageUrl",    context.sourceImageUrl);
    if (context.sourcePostId)      fd.set("sourcePostId",      context.sourcePostId);
    if (context.sourceCanteenId)   fd.set("sourceCanteenId",   context.sourceCanteenId);
    fd.set("consented", "true");
    for (const f of files) fd.append("attachments", f);

    try {
      const res = await fetch("/api/quote-requests", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setErrorKey(typeof data.error === "string" ? data.error : "network-error");
        return;
      }
      setSubmitted(true);
      setSubmittedId(data.id ?? null);
      onSuccess?.(data.id ?? "");
    } catch {
      setErrorKey("network-error");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: `${BRAND_GREEN}18` }}
        >
          <Check size={26} strokeWidth={2.6} style={{ color: BRAND_GREEN }}/>
        </div>
        <h3 className="mt-3 text-[19px] font-black text-neutral-900">
          Sent to {context.targetTradeName}.
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-neutral-600">
          They&apos;ll reply on the WhatsApp number or email you provided. Usually within a day — sooner if you submitted during working hours.
        </p>
        {submittedId && (
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
            Ref {submittedId.slice(0, 8)}
          </p>
        )}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-4 inline-flex items-center rounded-full border px-5 py-2 text-[11.5px] font-black uppercase tracking-wider text-neutral-800 hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      className="mx-auto flex max-w-lg flex-col gap-3"
    >
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
          Contact {context.targetTradeName}
        </div>
        <h3
          className="mt-1 text-[22px] font-black leading-tight text-neutral-900"
          style={{ fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' }}
        >
          Get a quote for {context.projectLabel ?? "your project"}
        </h3>
        <p className="mt-1 text-[12px] leading-snug text-neutral-600">
          Add a bit about what you&apos;re building, upload a photo or two of the space, and {context.targetTradeName.split(/\s+/)[0]} will reply directly.
        </p>
      </div>

      <FieldRow>
        <Field label="Your name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 120))}
            placeholder="Sam Wright"
            autoComplete="name"
            className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="Email" hint="or leave blank if you prefer WhatsApp only">
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.slice(0, 200))}
            placeholder="sam@example.com"
            autoComplete="email"
            className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          />
        </Field>
        <Field label="WhatsApp / phone" hint="at least one contact required">
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.slice(0, 32))}
            placeholder="07700 900101"
            autoComplete="tel"
            className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          />
        </Field>
      </FieldRow>

      <Field
        label={`About your project`}
        hint={messageRemaining > 0
          ? `${messageRemaining} more character${messageRemaining === 1 ? "" : "s"} needed`
          : `${message.trim().length}/${MAX_MESSAGE}`}
        required
      >
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
          rows={5}
          placeholder="I'm building a loft conversion in Manchester and need a Youngman timber loft ladder fitted next month. The hatch opening is roughly 60x120cm. Any advice on hatch upgrades welcome."
          className="w-full resize-none rounded-lg border bg-white px-3 py-2.5 text-[13px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        />
      </Field>

      {/* Attachments */}
      <div>
        <div className="flex items-center justify-between">
          <div className="text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-600">
            Site photos <span className="text-neutral-400">(optional, up to {MAX_ATTACHMENTS})</span>
          </div>
          <label
            className="inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-800 hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <Camera size={12} strokeWidth={2.5}/>
            Add photo
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
              disabled={files.length >= MAX_ATTACHMENTS}
            />
          </label>
        </div>
        {files.length > 0 && (
          <ul className="mt-2 grid grid-cols-3 gap-2">
            {files.map((f, i) => {
              const objectUrl = URL.createObjectURL(f);
              return (
                <li key={`${f.name}-${i}`} className="relative overflow-hidden rounded-lg border" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={objectUrl} alt="" className="block aspect-square w-full object-cover"/>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X size={12}/>
                  </button>
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    <Paperclip size={9} strokeWidth={2.5} className="mr-0.5 inline"/>
                    {Math.round(f.size / 1024)}KB
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Consent */}
      <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
        <input
          type="checkbox"
          checked={consented}
          onChange={(e) => setConsented(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-shrink-0"
        />
        <span className="text-[11.5px] leading-snug text-neutral-700">
          I&apos;m happy for {context.targetTradeName} to contact me using the details above about this project.
        </span>
      </label>

      {errorKey && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-black" style={{ color: RED }}>
          {ERROR_COPY[errorKey] ?? "Something went wrong. Please try again."}
        </div>
      )}

      <div className="flex items-center gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex flex-1 items-center justify-center rounded-full border px-4 py-2.5 text-[11.5px] font-black uppercase tracking-wider text-neutral-800 hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: canSubmit ? BRAND_BLACK : "#525252", color: canSubmit ? BRAND_YELLOW : "#e5e5e5" }}
        >
          {submitting ? <Loader2 size={13} className="animate-spin"/> : <Send size={13} strokeWidth={2.6}/>}
          {submitting ? "Sending…" : "Send request"}
        </button>
      </div>
    </form>
  );
}

// ─── Layout helpers ─────────────────────────────────────────────

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  hint,
  required,
  children
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-600">
          {label}
          {required && <span className="ml-1" style={{ color: RED }}>*</span>}
        </span>
        {hint && <span className="text-[10px] text-neutral-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
