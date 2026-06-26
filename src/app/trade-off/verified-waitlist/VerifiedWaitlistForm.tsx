"use client";

// Verified-waitlist form. Posts to /api/trade-off/request-upgrade with
// kind=verified-waitlist so it lands in the admin inbox alongside other
// upgrade requests until the dedicated Verified ops endpoint ships.
//
// We collect the minimum needed to seed the verification queue once it
// launches: trade name, company name, country, email, optional WhatsApp.
// Full Companies-House check happens at verification time, not here.

import { useState } from "react";
import { XRATED_BRAND } from "@/lib/xratedTrades";

type Status = "idle" | "submitting" | "ok" | "error";

export function VerifiedWaitlistForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tradeName, setTradeName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/trade-off/verified-waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tradeName: tradeName.trim(),
          companyName: companyName.trim(),
          country: country.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim() || null
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      setStatus("ok");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <div
        className="rounded-2xl border-2 p-6 sm:p-8"
        style={{ borderColor: XRATED_BRAND.accent, background: `${XRATED_BRAND.accent}10` }}
      >
        <span
          className="inline-flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: XRATED_BRAND.accent }}
          aria-hidden="true"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h3 className="mt-4 text-xl font-extrabold text-neutral-900 sm:text-2xl">
          You&rsquo;re on the Verified waitlist.
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700">
          We&rsquo;ve locked your seat at <strong>£19.99/mo for life</strong> when
          Verified launches in Q3 2026. We&rsquo;ll email you when the
          verification queue opens — you&rsquo;ll be first in.
        </p>
        <p className="mt-3 text-xs text-neutral-600">
          In the meantime, you can claim your xratedtrade.com URL on the Paid
          14-day trial. Your slug stays yours either way.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="/trade-off/signup"
            className="inline-flex h-11 items-center gap-1.5 rounded-lg px-5 text-xs font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] sm:text-sm"
            style={{ background: XRATED_BRAND.accent }}
          >
            Start Paid trial now
          </a>
          <a
            href="/trade-off"
            className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-5 text-xs font-bold uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-50 sm:text-sm"
          >
            Back to overview
          </a>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h2 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
        Lock your founding-member seat
      </h2>
      <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
        £19.99/mo locked for life. Verification queue opens Q3 2026.
      </p>

      <fieldset disabled={status === "submitting"} className="mt-5 flex flex-col gap-3.5">
        <Field
          label="Your trade name"
          placeholder="e.g. Mike Watson Drywall"
          required
          value={tradeName}
          onChange={setTradeName}
        />
        <Field
          label="Company name (as registered)"
          placeholder="e.g. Watson Drywall Ltd"
          required
          value={companyName}
          onChange={setCompanyName}
        />
        <Field
          label="Country of registration"
          placeholder="e.g. United Kingdom"
          required
          value={country}
          onChange={setCountry}
        />
        <Field
          label="Email"
          type="email"
          placeholder="you@trade.com"
          required
          value={email}
          onChange={setEmail}
        />
        <Field
          label="WhatsApp (optional)"
          type="tel"
          placeholder="+44 7700 900000"
          value={whatsapp}
          onChange={setWhatsapp}
        />

        {errorMsg && (
          <p
            role="alert"
            className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 ring-1 ring-red-200"
          >
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          className="mt-1 inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.98] disabled:opacity-60"
          style={{
            background: XRATED_BRAND.accent,
            boxShadow: `0 6px 18px ${XRATED_BRAND.accent}55`
          }}
        >
          {status === "submitting" ? "Joining..." : "Join the Verified waitlist"}
          {status !== "submitting" && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          )}
        </button>
        <p className="text-center text-[11px] text-neutral-500">
          No card. No spam. We email you once when verification opens.
        </p>
      </fieldset>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel";
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold text-neutral-700">
        {label}
        {required && <span className="ml-1 text-neutral-400">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={type === "email" ? "email" : type === "tel" ? "tel" : "off"}
        className="h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#FFB300] focus:outline-none focus:ring-2 focus:ring-[#FFB300]/30"
      />
    </label>
  );
}
