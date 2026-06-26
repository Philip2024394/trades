"use client";

// Xrated Trades — qualified-lead contact form.
//
// Fields are designed to filter time-wasters so tradies on the admin
// dashboard can triage incoming leads quickly:
//   - Postcode is required (proves a real address; can be matched
//     against the tradesperson's service_postcodes / coverage radius)
//   - Project type + stage radios surface intent vs research traffic
//   - Earliest-start bucket signals urgency
//   - Up to 6 optional photos give the tradie a quote-ready brief
//
// Two send paths:
//   1. EMAIL — POST to /api/trade-off/messages (DB row + tradie email)
//   2. WHATSAPP — open wa.me with a structured text body + photo URLs.
//      Photos can't pre-attach via wa.me, so we inline the URLs and
//      WhatsApp shows a preview of the first one.

import { useEffect, useState } from "react";

const ENQUIRY_KEY = "xrated_enquiry_service";

type EnquirySubject = {
  name: string;
  price: number;
  unit: string;
};

type ProjectType = "new_build" | "renovation" | "repair";
type ProjectStage = "ready_to_book" | "comparing_quotes" | "just_researching";

const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  new_build: "New build",
  renovation: "Renovation",
  repair: "Repair"
};
const PROJECT_STAGE_LABEL: Record<ProjectStage, string> = {
  ready_to_book: "Ready to book",
  comparing_quotes: "Comparing quotes",
  just_researching: "Just researching"
};
const EARLIEST_START_OPTIONS: { value: string; label: string }[] = [
  { value: "asap", label: "ASAP" },
  { value: "within_1_month", label: "Within 1 month" },
  { value: "1_to_3_months", label: "1–3 months" },
  { value: "3_plus_months", label: "3+ months" }
];

// UK postcode — permissive partial matcher (full and partial inputs).
const UK_POSTCODE_RE = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/;
const MAX_PHOTOS = 6;

function formatPrice(price: number, unit: string): string {
  const amount = `£${price.toLocaleString("en-GB")}`;
  if (!unit) return amount;
  const u = unit.trim();
  if (u.toLowerCase() === "from") return `From ${amount}`;
  return `${amount} ${u}`;
}

function buildPrefillMessage(svc: EnquirySubject): string {
  // price === 0 marks a project-style enquiry (Recent Work lightbox) — no
  // listed price, so we leave the price tail off the message instead of
  // surfacing "(£0)".
  if (svc.price === 0) {
    return `Hi, I saw ${svc.name} on your profile and would like to discuss a similar project. Can you arrange a quote?`;
  }
  return `Hi, I'm interested in ${svc.name} (${formatPrice(svc.price, svc.unit)}). Can you confirm availability and arrange a quote?`;
}

export function ContactFormPanel({
  listingId,
  displayName,
  themeColor,
  whatsapp
}: {
  listingId: string;
  displayName: string;
  themeColor: string;
  /** When provided, a "Send by WhatsApp" button renders alongside the
   *  email submit. Composes a wa.me link with the form contents and
   *  opens in a new tab — no DB row is written for the WhatsApp path. */
  whatsapp?: string | null;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [postcode, setPostcode] = useState("");
  const [projectType, setProjectType] = useState<ProjectType | "">("");
  const [projectStage, setProjectStage] = useState<ProjectStage | "">("");
  const [earliestStart, setEarliestStart] = useState("");
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"email" | "whatsapp" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [subject, setSubject] = useState<EnquirySubject | null>(null);

  // Pre-fill from the priced-services modal handoff. Same behaviour as
  // before — see ENQUIRY_KEY in sessionStorage.
  useEffect(() => {
    function readPrefill() {
      try {
        const raw = sessionStorage.getItem(ENQUIRY_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<EnquirySubject>;
        if (
          !parsed ||
          typeof parsed.name !== "string" ||
          typeof parsed.price !== "number" ||
          typeof parsed.unit !== "string"
        ) {
          return;
        }
        const svc: EnquirySubject = {
          name: parsed.name,
          price: parsed.price,
          unit: parsed.unit
        };
        setSubject(svc);
        setMessage((curr) => (curr.trim().length === 0 ? buildPrefillMessage(svc) : curr));
        sessionStorage.removeItem(ENQUIRY_KEY);
      } catch {
        // ignore
      }
    }
    readPrefill();
    function onHash() {
      if (window.location.hash === "#contact-panel") readPrefill();
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function emailLooksValid(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function clearSubject() {
    setSubject(null);
    setMessage((curr) => {
      if (!subject) return curr;
      return curr === buildPrefillMessage(subject) ? "" : curr;
    });
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking same file
    if (files.length === 0) return;
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      setErr(`You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const toUpload = files.slice(0, remaining);
    setErr(null);
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const f of toUpload) {
        const fd = new FormData();
        fd.append("listing_id", listingId);
        fd.append("file", f);
        const res = await fetch("/api/trade-off/lead-photos", {
          method: "POST",
          body: fd
        });
        const json = await res.json().catch(() => ({ ok: false }));
        if (!json.ok || typeof json.url !== "string") {
          throw new Error(json.error || "Upload failed.");
        }
        newUrls.push(json.url);
      }
      setPhotos((curr) => [...curr, ...newUrls]);
    } catch (uploadErr) {
      setErr(uploadErr instanceof Error ? uploadErr.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(url: string) {
    setPhotos((curr) => curr.filter((p) => p !== url));
  }

  // Common validation that BOTH paths share. Returns null if OK or an
  // error string. Email is checked only for the email path; everything
  // else is mandatory regardless of channel.
  function validate(opts: { requireEmail: boolean }): string | null {
    if (name.trim().length < 2) return "Please enter your name.";
    if (opts.requireEmail && !emailLooksValid(email.trim())) {
      return "Please enter a valid email address.";
    }
    if (!postcode.trim()) return "Please enter your job postcode.";
    if (!UK_POSTCODE_RE.test(postcode.trim().toUpperCase())) {
      return "Please enter a valid UK postcode.";
    }
    if (!projectType) return "Please choose a project type.";
    if (!projectStage) return "Please choose a project stage.";
    if (!earliestStart) return "Please choose your earliest start.";
    const m = message.trim();
    if (m.length < 50) return "Message must be at least 50 characters.";
    if (m.length > 500) return "Message must be 500 characters or fewer.";
    return null;
  }

  function buildStructuredSummary(): string {
    const lines: string[] = [];
    if (projectType) lines.push(`Project type: ${PROJECT_TYPE_LABEL[projectType]}`);
    if (projectStage) lines.push(`Stage: ${PROJECT_STAGE_LABEL[projectStage]}`);
    if (earliestStart) {
      const opt = EARLIEST_START_OPTIONS.find((o) => o.value === earliestStart);
      if (opt) lines.push(`Earliest start: ${opt.label}`);
    }
    if (postcode.trim()) lines.push(`Postcode: ${postcode.trim().toUpperCase()}`);
    if (phone.trim()) lines.push(`Call-back: ${phone.trim()}`);
    return lines.join("\n");
  }

  function sendByWhatsApp() {
    setErr(null);
    if (!whatsapp) return;
    const v = validate({ requireEmail: false });
    if (v) {
      setErr(v);
      return;
    }
    const wa = whatsapp.replace(/[^0-9]/g, "");
    const summary = buildStructuredSummary();
    const photoBlock =
      photos.length > 0
        ? `\nPhotos (${photos.length}):\n${photos.join("\n")}`
        : "";
    const body = [
      `Hi ${displayName}, this is ${name.trim()}.`,
      "",
      message.trim(),
      summary ? `\n${summary}` : null,
      photoBlock || null,
      "",
      "(Sent via Xrated Trades)"
    ]
      .filter((line): line is string => line !== null)
      .join("\n");
    window.open(
      `https://wa.me/${wa}?text=${encodeURIComponent(body)}`,
      "_blank",
      "noopener,noreferrer"
    );
    setDone("whatsapp");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const v = validate({ requireEmail: true });
    if (v) {
      setErr(v);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/trade-off/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          sender_name: name.trim(),
          sender_email: email.trim(),
          sender_phone: phone.trim() || null,
          message: message.trim(),
          postcode: postcode.trim() || null,
          project_type: projectType || null,
          project_stage: projectStage || null,
          earliest_start: earliestStart || null,
          photo_urls: photos
        })
      });
      const json = await res.json().catch(() => ({ ok: false }));
      if (!json.ok) {
        setErr(json.error || "Could not send your message — please try again.");
      } else {
        setDone("email");
      }
    } catch {
      setErr("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="w-full px-4 pb-2 pt-8">
        <div
          className="rounded-2xl border p-5 text-center"
          style={{ borderColor: themeColor, background: `${themeColor}14` }}
        >
          <p className="text-[13px] font-bold" style={{ color: themeColor }}>
            {done === "whatsapp"
              ? `WhatsApp opened with your message to ${displayName}.`
              : `Message sent to ${displayName}.`}
          </p>
          <p className="mt-1 text-[13px] text-brand-muted">
            {done === "whatsapp"
              ? "They'll reply directly on WhatsApp. No payment is taken on this page."
              : "They'll respond directly. No payment is taken on this page."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="contact-panel" className="w-full px-4 pb-2 pt-8">
      <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
        Contact {displayName}
      </h2>
      <p className="mt-1 text-xs text-brand-muted">
        A few quick details help {displayName.split(" ")[0]} quote accurately. 50–500 character brief.
      </p>
      <form
        onSubmit={submit}
        className="mt-4 space-y-4 rounded-2xl border border-brand-line bg-brand-surface p-4 sm:p-5"
      >
        {/* Identity row */}
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldLabel label="Your name" icon={Icons.user} required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              required
              minLength={2}
              maxLength={80}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Email" icon={Icons.mail} required>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              maxLength={120}
              className={inputClass}
            />
          </FieldLabel>
        </div>

        {/* Location row */}
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldLabel label="Phone (optional)" icon={Icons.phone}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07xxx xxx xxx"
              maxLength={32}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Job postcode" icon={Icons.pin} required>
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              placeholder="M1 1AE"
              required
              maxLength={10}
              className={inputClass}
            />
          </FieldLabel>
        </div>

        {/* Project type + earliest start dropdowns — both required so the
            tradie gets enough qualification data with every lead. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldLabel label="Project type" icon={Icons.hammer} required>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
              required
              className={selectClass}
            >
              <option value="">Select project type…</option>
              <option value="new_build">{PROJECT_TYPE_LABEL.new_build}</option>
              <option value="renovation">{PROJECT_TYPE_LABEL.renovation}</option>
              <option value="repair">{PROJECT_TYPE_LABEL.repair}</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Earliest start" icon={Icons.calendar} required>
            <select
              value={earliestStart}
              onChange={(e) => setEarliestStart(e.target.value)}
              required
              className={selectClass}
            >
              <option value="">Select earliest start…</option>
              {EARLIEST_START_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FieldLabel>
        </div>

        {/* Project stage stays as a radio — it's the killer "filter
            time-wasters" signal and surfacing all three options at once
            reduces clicks vs hiding them in a dropdown. */}
        <RadioGroup
          label="Project stage"
          icon={Icons.clipboardCheck}
          required
          value={projectStage}
          options={[
            { value: "ready_to_book", label: "Ready to book" },
            { value: "comparing_quotes", label: "Comparing quotes" },
            { value: "just_researching", label: "Just researching" }
          ]}
          onChange={(v) => setProjectStage(v as ProjectStage)}
          themeColor={themeColor}
        />

        {/* Message */}
        <div>
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-muted">
            <span
              aria-hidden="true"
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={{ background: "rgba(255,179,0,0.15)", color: "#FFB300" }}
            >
              {Icons.message}
            </span>
            Message ({message.trim().length}/500)
            <span className="text-red-500">*</span>
          </span>
          {subject && (
            <div className="mt-1.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                style={{
                  background: `${themeColor}1F`,
                  color: themeColor,
                  border: `1px solid ${themeColor}`
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4-8 5-8-5V6l8 5 8-5v2Z" />
                </svg>
                Enquiring about: {subject.name}
                <button
                  type="button"
                  onClick={clearSubject}
                  aria-label="Clear enquiry subject"
                  className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-current transition hover:bg-black/20"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </span>
            </div>
          )}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What needs doing, where, any rough timing or budget. 50 characters minimum."
            required
            minLength={50}
            maxLength={500}
            rows={5}
            className="mt-1.5 w-full rounded-md border border-brand-line bg-brand-bg px-3 py-2 text-[13px] text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
          />
        </div>

        {/* Photo picker */}
        <div>
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-muted">
            <span
              aria-hidden="true"
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={{ background: "rgba(255,179,0,0.15)", color: "#FFB300" }}
            >
              {Icons.camera}
            </span>
            Photos (optional · up to {MAX_PHOTOS})
          </span>
          <p className="mt-1 text-xs text-brand-muted">
            Sharper quote when {displayName.split(" ")[0]} can see the job. JPG/PNG/WebP/HEIC, 5MB each.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((url) => (
              <div key={url} className="relative h-20 w-20 overflow-hidden rounded-lg border border-brand-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Attached" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(url)}
                  aria-label="Remove photo"
                  className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-brand-line bg-brand-bg text-brand-muted transition hover:border-brand-accent hover:text-brand-accent">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  multiple
                  className="sr-only"
                  onChange={onPickFiles}
                  disabled={uploading}
                />
                {uploading ? (
                  <span className="text-xs font-bold">Uploading…</span>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                )}
              </label>
            )}
          </div>
        </div>

        {err && (
          <p className="text-[13px] font-semibold text-red-600" role="alert">
            {err}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="submit"
            disabled={busy || uploading}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[13px] font-bold transition disabled:opacity-50"
            style={{ background: themeColor, color: "#000" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            {busy ? "Sending…" : "Send by Email"}
          </button>
          {whatsapp && whatsapp.trim().length > 0 && (
            <button
              type="button"
              onClick={sendByWhatsApp}
              disabled={busy || uploading}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border-2 bg-transparent px-5 text-[13px] font-bold transition disabled:opacity-50"
              style={{ borderColor: themeColor, color: themeColor }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Z" />
              </svg>
              Send by WhatsApp
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

const inputClass =
  "mt-1.5 h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none";
const selectClass = `${inputClass} appearance-none bg-[length:14px] bg-[right_12px_center] bg-no-repeat pr-9`;

function FieldLabel({
  label,
  required,
  icon,
  children
}: {
  label: string;
  required?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-muted">
        {icon && (
          <span
            aria-hidden="true"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
            style={{ background: "rgba(255,179,0,0.15)", color: "#FFB300" }}
          >
            {icon}
          </span>
        )}
        <span>
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </span>
      </span>
      {children}
    </label>
  );
}

// Icon set — Lucide-style inline SVGs, sized 13×13 to nest cleanly in
// the 20px yellow-tinted circle next to each field label.
const Icons = {
  user: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  mail: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  ),
  phone: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  ),
  pin: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  hammer: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 12-8.5 8.5a2.12 2.12 0 0 1-3-3L12 9" />
      <path d="m22 7-7-7-4 4 7 7 4-4Z" />
      <path d="m9 11 4 4" />
    </svg>
  ),
  calendar: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  clipboardCheck: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  ),
  message: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  camera: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
};

function RadioGroup({
  label,
  value,
  options,
  onChange,
  themeColor,
  required,
  icon
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  themeColor: string;
  required?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-muted">
        {icon && (
          <span
            aria-hidden="true"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
            style={{ background: `${themeColor}26`, color: themeColor }}
          >
            {icon}
          </span>
        )}
        <span>
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </span>
      </span>
      <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="inline-flex h-11 items-center justify-center rounded-md border px-2 text-xs font-bold transition"
            style={
              value === o.value
                ? { background: themeColor, color: "#000", borderColor: themeColor }
                : { background: "transparent", color: "var(--brand-text-rgb,#111)", borderColor: "var(--brand-line-rgb,#e5e7eb)" }
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
