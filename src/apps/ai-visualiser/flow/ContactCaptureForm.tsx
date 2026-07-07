// ContactCaptureForm — homeowner registration step.
//
// Displayed as the first screen of the Visualiser flow. No OTP —
// WhatsApp is stored so the merchant can reach back out. Email is
// stored for lead delivery; a soft magic-link verification can be
// added later without changing this form. Postcode filters merchants
// by geography further down the line.

"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

export type ContactCaptureValue = {
  fullName: string;
  email: string;
  whatsapp: string;
  homePhone: string;
  postcode: string;
};

const EMPTY: ContactCaptureValue = {
  fullName: "",
  email: "",
  whatsapp: "",
  homePhone: "",
  postcode: ""
};

export type ContactCaptureFormProps = {
  merchantId: string;
  firstLeafSlug?: string;
  source?: "merchant-page" | "gold-path" | "marketplace";
  fingerprintId?: string;
  merchantDisplayName?: string;
  onComplete: (homeownerId: string, uploadGrant: string) => void;
  onCancel?: () => void;
  className?: string;
};

export function ContactCaptureForm({
  merchantId,
  firstLeafSlug,
  source = "merchant-page",
  fingerprintId,
  merchantDisplayName = "us",
  onComplete,
  onCancel,
  className = ""
}: ContactCaptureFormProps) {
  const [value, setValue] = useState<ContactCaptureValue>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);

  const set = (k: keyof ContactCaptureValue) => (v: string) =>
    setValue((prev) => ({ ...prev, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/apps/ai-visualiser/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          merchantId,
          fullName: value.fullName,
          email: value.email,
          whatsapp: value.whatsapp,
          homePhone: value.homePhone || undefined,
          postcode: value.postcode,
          fingerprintId,
          firstLeafSlug,
          source
        })
      });

      const data: {
        ok: boolean;
        homeownerId?: string;
        uploadGrant?: string;
        field?: string;
        error?: string;
      } = await res.json();

      if (!data.ok || !data.homeownerId || !data.uploadGrant) {
        setError({
          field: data.field,
          message: data.error || "Something went wrong. Try again."
        });
        return;
      }
      onComplete(data.homeownerId, data.uploadGrant);
    } catch {
      setError({ message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex flex-col gap-4 ${className}`.trim()}
      noValidate
    >
      <header>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[13px] font-semibold text-amber-900">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Free — no card needed
        </div>
        <h2 className="mt-3 text-2xl font-semibold text-neutral-900 md:text-3xl">
          A few details to get started.
        </h2>
        <p className="mt-1 text-[13px] leading-snug text-neutral-600">
          {merchantDisplayName} will send you the design and follow up with a
          no-obligation quote.
        </p>
      </header>

      <Field
        label="Your name"
        name="fullName"
        value={value.fullName}
        onChange={set("fullName")}
        error={error?.field === "fullName" ? error.message : null}
        required
        autoComplete="name"
      />
      <Field
        label="Email"
        name="email"
        type="email"
        value={value.email}
        onChange={set("email")}
        error={error?.field === "email" ? error.message : null}
        required
        autoComplete="email"
      />
      <Field
        label="WhatsApp number"
        name="whatsapp"
        type="tel"
        value={value.whatsapp}
        onChange={set("whatsapp")}
        error={error?.field === "whatsapp" ? error.message : null}
        hint="We'll use this to send you the design."
        required
        autoComplete="tel"
      />
      <Field
        label="Home / landline (optional)"
        name="homePhone"
        type="tel"
        value={value.homePhone}
        onChange={set("homePhone")}
        error={error?.field === "homePhone" ? error.message : null}
      />
      <Field
        label="Postcode"
        name="postcode"
        value={value.postcode}
        onChange={(v) => set("postcode")(v.toUpperCase())}
        error={error?.field === "postcode" ? error.message : null}
        required
        autoComplete="postal-code"
      />

      {/* Honeypot — hidden from real users, filled by bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        style={{
          position: "absolute",
          left: "-9999px",
          height: 0,
          width: 0,
          opacity: 0
        }}
        aria-hidden
      />

      {error && !error.field ? (
        <p className="text-[13px] text-red-600">{error.message}</p>
      ) : null}

      <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 text-[13px] font-semibold text-neutral-700 hover:border-neutral-400"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-neutral-900 px-5 text-[14px] font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            "Continue to upload"
          )}
        </button>
      </div>

      <p className="text-[13px] text-neutral-500">
        By continuing you agree we may share your contact details with{" "}
        {merchantDisplayName} so they can quote for the work.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  error,
  hint,
  required = false,
  type = "text",
  autoComplete
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  hint?: string;
  required?: boolean;
  type?: "text" | "email" | "tel";
  autoComplete?: string;
}) {
  const id = `ai-viz-${name}`;
  return (
    <label htmlFor={id} className="block">
      <span className="text-[13px] font-semibold text-neutral-800">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      <input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className={`mt-1 block min-h-[44px] w-full rounded-lg border bg-white px-3 text-[14px] text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 ${
          error ? "border-red-400" : "border-neutral-200"
        }`}
      />
      {hint && !error ? (
        <span className="mt-1 block text-[13px] text-neutral-500">{hint}</span>
      ) : null}
      {error ? (
        <span className="mt-1 block text-[13px] text-red-600">{error}</span>
      ) : null}
    </label>
  );
}
