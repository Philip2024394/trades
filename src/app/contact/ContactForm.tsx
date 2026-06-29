"use client";

// Xrated Trades — Contact form (client island).
//
// Pro-grade structured intake. Routes via POST /api/contact which
// emails the admin inbox through Resend. The reason dropdown is the
// killer field: it lands in the email subject so the team can filter
// straight from the inbox.
//
// Layout: reason + country/name pair + WhatsApp/email pair + URL + message.
// Validation runs inline; on submit the form swaps for a yellow-accent
// success card so visitors know the message was logged.
//
// Spam protection:
//   - Hidden honeypot input (`website`) — real users never see it. If a
//     bot fills it, we still resolve the submission as `ok: true` so the
//     bot thinks it worked, but no email is sent (handled server-side).
//   - Slide-to-confirm widget — the Send button is disabled until the
//     user drags the yellow handle to the right. Pointer + touch events
//     both supported. Once confirmed, the handle stays as a yellow tick.

import { useCallback, useEffect, useRef, useState } from "react";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { CONTACT_COUNTRIES as WORLD_CONTACT_COUNTRIES } from "@/lib/worldCountries";

export const CONTACT_REASONS = [
  "General enquiry",
  "Marketing / partnership",
  "Trade app — feature request or custom build",
  "Payment / billing issue",
  "Account access / login help",
  "Reseller programme",
  "Bug report",
  "Press / media",
  "Other"
] as const;

export type ContactReason = (typeof CONTACT_REASONS)[number];

// Re-export the worldwide list so any historical importer of
// CONTACT_COUNTRIES from this file keeps working. New code should
// import from @/lib/worldCountries directly — that module is
// server-compatible (this file is "use client") which means
// server components / route handlers can pull the list without
// crossing the client boundary.
export const CONTACT_COUNTRIES = WORLD_CONTACT_COUNTRIES;

type FieldName =
  | "reason"
  | "country"
  | "name"
  | "whatsapp"
  | "email"
  | "accountRef"
  | "message";

type FieldErrors = Partial<Record<FieldName, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputBase =
  "h-12 w-full rounded-lg border bg-white px-3 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none transition";
const inputIdle = "border-neutral-300";
const inputError = "border-red-400";
const labelClass =
  "text-[13px] font-bold uppercase tracking-wider text-neutral-800";
const captionClass = "mt-1 text-[13px] leading-relaxed text-neutral-500";
const errorClass = "mt-1 text-[11px] font-semibold text-red-600";

// Visually hidden but accessible to bots. Position off-screen so users
// never see it, tabIndex={-1} so keyboard users never focus it.
const honeypotStyle: React.CSSProperties = {
  position: "absolute",
  left: "-9999px",
  top: "auto",
  width: "1px",
  height: "1px",
  overflow: "hidden"
};

// Slide-to-confirm constants. CONFIRM_THRESHOLD is the fraction of the
// track the handle has to cross before we flip into confirmed state.
const SLIDER_HANDLE_PX = 44;
const CONFIRM_THRESHOLD = 0.9;

function SlideToConfirm({
  confirmed,
  onConfirm
}: {
  confirmed: boolean;
  onConfirm: () => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);

  // Keep ref in sync so global pointermove handler reads fresh state.
  useEffect(() => {
    draggingRef.current = dragging;
  }, [dragging]);

  const trackWidth = useCallback(() => {
    return trackRef.current?.getBoundingClientRect().width ?? 0;
  }, []);

  const maxOffset = useCallback(() => {
    return Math.max(0, trackWidth() - SLIDER_HANDLE_PX);
  }, [trackWidth]);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!trackRef.current || confirmed) return;
      const rect = trackRef.current.getBoundingClientRect();
      const localX = clientX - rect.left - SLIDER_HANDLE_PX / 2;
      const max = maxOffset();
      const clamped = Math.max(0, Math.min(localX, max));
      setOffset(clamped);
      if (max > 0 && clamped / max >= CONFIRM_THRESHOLD) {
        setOffset(max);
        setDragging(false);
        onConfirm();
      }
    },
    [confirmed, maxOffset, onConfirm]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (confirmed) return;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    handleMove(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    handleMove(e.clientX);
  };

  const onPointerUp = () => {
    if (confirmed) return;
    setDragging(false);
    // Snap back if user released before threshold.
    setOffset(0);
  };

  const progress = (() => {
    const max = maxOffset();
    if (max <= 0) return 0;
    return Math.min(1, offset / max);
  })();

  return (
    <div className="select-none">
      <div
        ref={trackRef}
        role="slider"
        aria-label="Slide to confirm you are human"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={confirmed ? "Confirmed" : "Slide to send"}
        className="relative h-14 w-full overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900"
      >
        {/* Caption (centred) — fades as the handle covers the track. */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] font-bold uppercase tracking-wider transition-colors"
          style={{
            color: confirmed ? XRATED_BRAND.accent : "rgba(255,255,255,0.7)",
            opacity: confirmed ? 1 : Math.max(0.25, 1 - progress)
          }}
        >
          {confirmed ? (
            <span>Confirmed — ready to send</span>
          ) : (
            <span>→ Slide to send</span>
          )}
        </div>

        {/* Yellow trail behind the handle — visualises drag progress. */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 transition-opacity"
          style={{
            width: `${offset + SLIDER_HANDLE_PX}px`,
            background: `${XRATED_BRAND.accent}33`,
            opacity: dragging || confirmed ? 1 : 0.7
          }}
        />

        {/* Handle */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full shadow-md"
          style={{
            left: `${offset + 2}px`,
            background: XRATED_BRAND.accent,
            cursor: confirmed ? "default" : "grab",
            touchAction: "none",
            transition: dragging ? "none" : "left 200ms ease-out"
          }}
        >
          {confirmed ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="black"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <polyline points="5 12 10 17 19 7" />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="black"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <polyline points="9 6 15 12 9 18" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

export function ContactForm() {
  const [reason, setReason] = useState<ContactReason | "">("");
  const [country, setCountry] = useState<string>("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [accountRef, setAccountRef] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [humanConfirmed, setHumanConfirmed] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedReason, setSubmittedReason] = useState<string | null>(null);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!reason) next.reason = "Pick a reason for your message.";
    if (!country) next.country = "Choose your country.";
    if (name.trim().length < 2) next.name = "Enter your name (2+ characters).";
    if (whatsapp.replace(/\D/g, "").length < 7) {
      next.whatsapp = "Enter a WhatsApp number with country code.";
    }
    if (!EMAIL_RE.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (message.trim().length < 10) {
      next.message = "Add a bit more detail (10+ characters).";
    }
    return next;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!humanConfirmed) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason,
          country,
          name: name.trim(),
          whatsapp: whatsapp.trim(),
          email: email.trim(),
          accountRef: accountRef.trim(),
          message: message.trim(),
          website // honeypot — non-empty value tells the server "bot"
        })
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        field?: FieldName;
      };
      if (!res.ok || !body.ok) {
        if (body.field && body.error) {
          setErrors({ [body.field]: body.error });
        } else {
          setSubmitError(
            body.error ?? "Something went wrong. Please try again."
          );
        }
        setSubmitting(false);
        return;
      }
      setSubmittedReason(reason || null);
    } catch {
      setSubmitError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  if (submittedReason) {
    return (
      <div
        className="mt-5 rounded-2xl border-2 bg-white p-6 shadow-sm sm:p-8"
        style={{ borderColor: XRATED_BRAND.accent }}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            style={{ background: XRATED_BRAND.accent }}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="black"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <polyline points="5 12 10 17 19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
              Message received
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">
              We'll reply within 24 hours via WhatsApp or email.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-neutral-700">
              Logged under category:{" "}
              <span
                className="rounded px-2 py-0.5 text-[13px] font-bold text-black"
                style={{ background: XRATED_BRAND.accent }}
              >
                {submittedReason}
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-5 flex flex-col gap-5"
      noValidate
    >
      {/* Honeypot — hidden from real users, tempting to bots. If filled,
          the API silently discards the submission. */}
      <div style={honeypotStyle} aria-hidden="true">
        <label htmlFor="contact-website">
          Website (leave this empty)
          <input
            id="contact-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      {/* Reason — full width */}
      <div>
        <label htmlFor="contact-reason" className={labelClass}>
          Reason for contact
        </label>
        <p className={captionClass}>
          Pick the reason closest to what you need — it routes your message
          to the right team member faster.
        </p>
        <select
          id="contact-reason"
          name="reason"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value as ContactReason | "")}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = XRATED_BRAND.accent)
          }
          onBlur={(e) => (e.currentTarget.style.borderColor = "")}
          className={`mt-2 ${inputBase} ${
            errors.reason ? inputError : inputIdle
          }`}
        >
          <option value="">Select a reason…</option>
          {CONTACT_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {errors.reason && <p className={errorClass}>{errors.reason}</p>}
      </div>

      {/* Name + Country */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className={labelClass}>
            Your name
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = XRATED_BRAND.accent)
            }
            onBlur={(e) => (e.currentTarget.style.borderColor = "")}
            className={`mt-2 ${inputBase} ${
              errors.name ? inputError : inputIdle
            }`}
          />
          {errors.name && <p className={errorClass}>{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="contact-country" className={labelClass}>
            Country
          </label>
          <select
            id="contact-country"
            name="country"
            required
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = XRATED_BRAND.accent)
            }
            onBlur={(e) => (e.currentTarget.style.borderColor = "")}
            className={`mt-2 ${inputBase} ${
              errors.country ? inputError : inputIdle
            }`}
          >
            <option value="">Select a country…</option>
            {CONTACT_COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {errors.country && <p className={errorClass}>{errors.country}</p>}
        </div>
      </div>

      {/* WhatsApp + Email */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="contact-whatsapp" className={labelClass}>
            WhatsApp number
          </label>
          <input
            id="contact-whatsapp"
            name="whatsapp"
            type="tel"
            required
            inputMode="tel"
            placeholder="+44 7700 900000"
            autoComplete="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = XRATED_BRAND.accent)
            }
            onBlur={(e) => (e.currentTarget.style.borderColor = "")}
            className={`mt-2 ${inputBase} ${
              errors.whatsapp ? inputError : inputIdle
            }`}
          />
          <p className={captionClass}>
            Best way to reply. Include your country code.
          </p>
          {errors.whatsapp && <p className={errorClass}>{errors.whatsapp}</p>}
        </div>
        <div>
          <label htmlFor="contact-email" className={labelClass}>
            Email address
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = XRATED_BRAND.accent)
            }
            onBlur={(e) => (e.currentTarget.style.borderColor = "")}
            className={`mt-2 ${inputBase} ${
              errors.email ? inputError : inputIdle
            }`}
          />
          {errors.email && <p className={errorClass}>{errors.email}</p>}
        </div>
      </div>

      {/* Account reference */}
      <div>
        <label htmlFor="contact-account-ref" className={labelClass}>
          Your xratedtrade.com URL or account reference{" "}
          <span className="font-normal normal-case tracking-normal text-neutral-500">
            (optional)
          </span>
        </label>
        <input
          id="contact-account-ref"
          name="accountRef"
          type="text"
          placeholder="xratedtrade.com/your-name"
          value={accountRef}
          onChange={(e) => setAccountRef(e.target.value)}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = XRATED_BRAND.accent)
          }
          onBlur={(e) => (e.currentTarget.style.borderColor = "")}
          className={`mt-2 ${inputBase} ${inputIdle}`}
        />
        <p className={captionClass}>
          If you've already signed up, paste your URL or slug. Skip if you
          haven't.
        </p>
      </div>

      {/* Message */}
      <div>
        <label htmlFor="contact-message" className={labelClass}>
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          placeholder="Tell us what you need. The more detail, the faster we can help."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = XRATED_BRAND.accent)
          }
          onBlur={(e) => (e.currentTarget.style.borderColor = "")}
          className={`mt-2 w-full rounded-lg border bg-white px-3 py-3 text-[13px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:outline-none transition ${
            errors.message ? inputError : inputIdle
          }`}
        />
        {errors.message && <p className={errorClass}>{errors.message}</p>}
      </div>

      {submitError && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {submitError}
        </div>
      )}

      {/* Slide-to-confirm — gates the Send button. */}
      <SlideToConfirm
        confirmed={humanConfirmed}
        onConfirm={() => setHumanConfirmed(true)}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <p className="text-[13px] text-neutral-500 sm:mr-auto">
          We reply within 24 hours, UK business hours.
        </p>
        <button
          type="submit"
          disabled={submitting || !humanConfirmed}
          aria-disabled={submitting || !humanConfirmed}
          title={
            !humanConfirmed
              ? "Slide the handle to confirm you're human"
              : undefined
          }
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-6 text-[13px] font-extrabold uppercase tracking-wider text-black shadow-md transition enabled:hover:brightness-105 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500 disabled:shadow-none disabled:opacity-80 sm:w-auto"
          style={
            humanConfirmed && !submitting
              ? { background: XRATED_BRAND.accent }
              : undefined
          }
        >
          {submitting ? "Sending…" : "Send message"}
          {!submitting && (
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <line x1="3" y1="10" x2="16" y2="10" />
              <polyline points="11 5 16 10 11 15" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}

export default ContactForm;
