"use client";

// Homeowner-facing beacon request form. Renders on the empty state
// of /trade-off/inspiration/[id] when no trades match, and can be
// reused from /find/beacon or any other surface with a matching
// trade_slug context.
//
// On submit → POST /api/beacon/create. Success state shows "Sent to
// N trades near you" + the message body they submitted. Error state
// keeps form open with the error inline.

import { useState } from "react";
import Link from "next/link";

type Props = {
  tradeSlug:      string;
  tradeLabel:     string;
  city?:          string | null;
  sourceSurface:  string;
  sourceImageId?: string | null;
};

type ApiResponse = {
  ok:               boolean;
  error?:           string;
  detail?:          string;
  beacon_id?:       string;
  fanout_count?:    number;
  readiness?:       { tier1: number; tier2: number; tier3: number };
  admin_residual?:  boolean;
  message?:         string;
};

export function BeaconRequestForm({ tradeSlug, tradeLabel, city, sourceSurface, sourceImageId }: Props) {
  const [name,        setName]        = useState("");
  const [email,       setEmail]       = useState("");
  const [whatsapp,    setWhatsapp]    = useState("");
  const [cityInput,   setCityInput]   = useState(city ?? "");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [result,  setResult]  = useState<ApiResponse | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (description.trim().length < 60) {
      setError("Please describe your project in at least 60 characters — trades need enough detail to quote fairly.");
      return;
    }
    if (!email.trim() && !whatsapp.trim()) {
      setError("Add an email or a WhatsApp number so trades can message you back.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/beacon/create", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          customer_name:       name.trim(),
          customer_email:      email.trim() || null,
          customer_whatsapp:   whatsapp.trim() || null,
          customer_city:       cityInput.trim() || null,
          project_description: description.trim(),
          trade_slug:          tradeSlug,
          source_surface:      sourceSurface,
          source_image_id:     sourceImageId ?? null
        })
      });
      const data: ApiResponse = await res.json().catch(() => ({ ok: false, error: "parse" }));
      if (!res.ok || !data.ok) {
        setError(data.detail ?? data.error ?? "Something went wrong. Try again in a moment.");
        setLoading(false);
        return;
      }
      setResult(data);
    } catch (err) {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (result?.ok) {
    return (
      <div
        className="rounded-2xl border p-5"
        style={{ borderColor: "rgba(22,101,52,0.30)", backgroundColor: "#ECFDF5" }}
      >
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#166534]">
          Request sent
        </p>
        <p className="mt-1 text-[15px] font-black text-neutral-900">
          {result.admin_residual
            ? "We've got your enquiry"
            : `Sent to ${result.fanout_count} trades near you`}
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-neutral-700">
          {result.message}
        </p>
        {!result.admin_residual && (
          <p className="mt-3 text-[11px] text-neutral-600">
            Trades who claim your enquiry pay to unlock your contact — so anyone who messages you is
            serious about the job. You&apos;ll typically hear from the first one within 2 hours.
          </p>
        )}
        <Link
          href="/trade-off/search?tab=inspiration"
          className="mt-4 inline-flex h-9 items-center justify-center rounded-full border px-4 text-[11px] font-black uppercase tracking-wider text-neutral-800 transition hover:bg-white"
          style={{ borderColor: "rgba(0,0,0,0.12)" }}
        >
          Browse more inspiration
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border p-5"
      style={{ borderColor: "rgba(184,134,11,0.30)", backgroundColor: "#FFF7DB" }}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7A5B00]">
        Post your project
      </p>
      <p className="mt-1 text-[15px] font-black text-neutral-900">
        Get quotes from {tradeLabel}s near you
      </p>
      <p className="mt-1 text-[11px] text-neutral-600">
        We&apos;ll send your enquiry to 3 nearby {tradeLabel.toLowerCase()}s. They&apos;ve got 2 hours to respond — the fastest to claim will WhatsApp you first. Only serious trades reach out (they pay a lead credit to contact you).
      </p>

      <div className="mt-4 space-y-3">
        <Field label="Your name" required>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sarah Jenkins"
            className="w-full rounded-md border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400"
            style={{ borderColor: "rgba(0,0,0,0.15)" }}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full rounded-md border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400"
              style={{ borderColor: "rgba(0,0,0,0.15)" }}
            />
          </Field>
          <Field label="WhatsApp">
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+44 7…"
              className="w-full rounded-md border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400"
              style={{ borderColor: "rgba(0,0,0,0.15)" }}
            />
          </Field>
        </div>
        <Field label="City / town">
          <input
            type="text"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            placeholder="e.g. Manchester"
            className="w-full rounded-md border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400"
            style={{ borderColor: "rgba(0,0,0,0.15)" }}
          />
        </Field>
        <Field label={`Project description (${description.trim().length}/60 min)`} required>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell trades what you need. When, where, what size, any photos or refs to mention. The more detail, the better the quotes."
            className="w-full resize-y rounded-md border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400"
            style={{ borderColor: "rgba(0,0,0,0.15)" }}
          />
        </Field>
      </div>

      {error && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full text-[12px] font-black uppercase tracking-wider text-white transition disabled:opacity-60"
        style={{ backgroundColor: "#166534" }}
      >
        {loading ? "Sending…" : `Send to 3 ${tradeLabel.toLowerCase()}s near you`}
      </button>

      <p className="mt-3 text-[10px] leading-snug text-neutral-500">
        We&apos;ll share your enquiry with matching trades on The Network. No lead fees, no bidding wars. See our{" "}
        <Link href="/legal/privacy" className="underline">privacy notice</Link>.
      </p>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
        {label}{required && <span className="text-red-600"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
