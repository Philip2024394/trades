// TierPicker — client island. Renders the 5 licence tiers as cards
// with selection radios, an email input for external buyers, and a
// postcode input for regional_exclusive. Submit → POST to
// /api/licenses/checkout → redirect the browser to Stripe.

"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  formatPence,
  TIER_PRICING
} from "@/lib/licenses/pricing";
import type { LicenseTier } from "@/lib/licenses/types";

export type TierPickerProps = {
  imageId: string;
  imageSubject: string;
  merchantId: string | null;
  initialTier: string;
  initialPostcode: string;
};

const TIER_ORDER: LicenseTier[] = [
  "standard",
  "extended",
  "regional_exclusive",
  "full_buyout",
  "competitor"
];

export function TierPicker({
  imageId,
  imageSubject: _imageSubject,
  merchantId,
  initialTier,
  initialPostcode
}: TierPickerProps) {
  const [tier, setTier] = useState<LicenseTier>(
    (TIER_ORDER.includes(initialTier as LicenseTier)
      ? initialTier
      : "standard") as LicenseTier
  );
  const [email, setEmail] = useState("");
  const [postcode, setPostcode] = useState(initialPostcode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsPostcode = tier === "regional_exclusive";
  const needsEmail = !merchantId;

  const canSubmit =
    (!needsEmail || /.+@.+\..+/.test(email)) &&
    (!needsPostcode || postcode.trim().length >= 2) &&
    !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/licenses/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId,
          tier,
          buyerType: merchantId ? "merchant" : "external",
          buyerMerchantId: merchantId ?? undefined,
          buyerEmail: needsEmail ? email : undefined,
          postcodePrefix: needsPostcode ? postcode.trim().toUpperCase() : undefined
        })
      });
      const data = (await res.json()) as { url?: string; error?: string; detail?: string };
      if (!res.ok || !data.url) {
        setError(data.detail ?? data.error ?? "Checkout unavailable");
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2">
        {TIER_ORDER.map((t) => {
          const p = TIER_PRICING[t];
          const cadence =
            p.billingCadence === "annual"
              ? "/ year"
              : p.billingCadence === "monthly"
              ? "/ mo"
              : "";
          const isSelected = tier === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              className={`flex items-start gap-3 rounded-xl border-2 bg-white p-3 text-left transition ${
                isSelected
                  ? "border-neutral-900 shadow-sm"
                  : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <div
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  isSelected
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white"
                }`}
              >
                {isSelected ? <Check className="h-2.5 w-2.5" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-semibold text-neutral-900">
                    {p.label}
                  </div>
                  <div className="text-[13px] font-semibold text-neutral-900">
                    {formatPence(p.amountPence)}
                    <span className="text-[11px] font-medium text-neutral-500">
                      {cadence}
                    </span>
                  </div>
                </div>
                <div className="mt-0.5 text-[11px] text-neutral-600">
                  {p.headline} · {p.sublabel}
                </div>
                {isSelected ? (
                  <ul className="mt-2 flex flex-col gap-1">
                    {p.bullets.map((b, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-1.5 text-[11px] text-neutral-700"
                      >
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                        {b}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {needsEmail ? (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Your email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            placeholder="you@example.com"
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-[13px]"
          />
          <span className="text-[10px] text-neutral-500">
            We&apos;ll email your download link + licence receipt here.
          </span>
        </label>
      ) : null}

      {needsPostcode ? (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Your postcode district (e.g. SW1, E14, M1)
          </span>
          <input
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.currentTarget.value.toUpperCase())}
            placeholder="SW1"
            maxLength={4}
            className="w-32 rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-[13px] uppercase tracking-widest"
          />
          <span className="text-[10px] text-neutral-500">
            No other tradesperson in this district will be able to
            licence this image.
          </span>
        </label>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-[12px] text-red-800">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {busy ? "Sending to checkout…" : `Buy licence · ${formatPence(TIER_PRICING[tier].amountPence)}`}
      </button>
    </div>
  );
}
