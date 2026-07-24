"use client";

// DualPrice — display a merchant's official GBP price alongside an
// approximate local-currency price for the customer's detected
// country. Used ONLY on Business Brain surfaces (a specific merchant's
// own product/quote cards) per the two-context £-price rule. Never
// used on Trade Brain surfaces — no £ figures cross the Trade Brain
// boundary in the first place.
//
// Detection: uses browser navigator.language on mount for immediate
// display (zero round-trip). Fetches the live rate from our cached
// /api/pricing/fx-rate endpoint. If the user's currency is GBP, only
// the GBP line renders — nothing to convert.

import { useEffect, useState } from "react";
import { COUNTRY_TO_CURRENCY, currencyFor, formatMoney } from "@/lib/pricing/_locale";

type Variant = "compact" | "prominent" | "quote";

export function DualPrice({
  gbpPence,
  variant = "compact",
  showDisclaimer = true
}: {
  gbpPence:       number;
  variant?:       Variant;
  showDisclaimer?: boolean;
}) {
  const [localCurrency, setLocalCurrency] = useState<string | null>(null);
  const [localAmount, setLocalAmount]     = useState<number | null>(null);
  const [stale, setStale]                 = useState(false);

  useEffect(() => {
    // Detect user's currency from browser locale
    const lang = typeof navigator !== "undefined" ? navigator.language : "en-GB";
    const region = lang.split("-")[1]?.toUpperCase();
    const currency = region ? currencyFor(region) : "GBP";
    if (currency === "GBP") return;   // no conversion needed
    if (!COUNTRY_TO_CURRENCY[region ?? ""]) return;
    setLocalCurrency(currency);

    let cancelled = false;
    fetch(`/api/pricing/fx-rate?to=${currency}`)
      .then((r) => r.json())
      .then((j: { ok: boolean; rate?: number; stale?: boolean }) => {
        if (cancelled) return;
        if (j.ok && typeof j.rate === "number") {
          setLocalAmount((gbpPence / 100) * j.rate);
          setStale(!!j.stale);
        }
      })
      .catch(() => { /* silent — GBP still shows */ });
    return () => { cancelled = true; };
  }, [gbpPence]);

  const gbpStr = formatMoney(gbpPence / 100, "GBP", "en-GB");
  const localStr = localAmount !== null && localCurrency
    ? formatMoney(localAmount, localCurrency)
    : null;

  if (variant === "quote") {
    return (
      <div className="flex flex-col gap-2">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide"
               style={{ color: "var(--nex-neutral-500)", letterSpacing: "0.06em" }}>
            Official Price
          </div>
          <div className="text-[22px] font-black leading-tight"
               style={{ color: "var(--nex-neutral-900)" }}>
            {gbpStr}
          </div>
        </div>
        {localStr && (
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wide"
                 style={{ color: "var(--nex-neutral-500)", letterSpacing: "0.06em" }}>
              Approximate Local Price
            </div>
            <div className="text-[16px] font-bold leading-tight"
                 style={{ color: "var(--nex-neutral-700)" }}>
              {localStr}
            </div>
          </div>
        )}
        {localStr && showDisclaimer && <Disclaimer stale={stale} />}
      </div>
    );
  }

  if (variant === "prominent") {
    return (
      <div className="flex flex-col">
        <div className="text-[18px] font-bold leading-tight"
             style={{ color: "var(--nex-neutral-900)" }}>
          {gbpStr}
        </div>
        {localStr && (
          <div className="text-[12.5px] font-medium leading-tight"
               style={{ color: "var(--nex-neutral-500)" }}>
            ~{localStr}
          </div>
        )}
        {localStr && showDisclaimer && <Disclaimer stale={stale} />}
      </div>
    );
  }

  // compact
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[13.5px] font-bold leading-tight"
           style={{ color: "var(--nex-neutral-900)" }}>
        {gbpStr}
      </div>
      {localStr && (
        <div className="text-[10.5px] font-medium leading-tight"
             style={{ color: "var(--nex-neutral-500)" }}>
          ~{localStr}
        </div>
      )}
    </div>
  );
}

function Disclaimer({ stale }: { stale: boolean }) {
  return (
    <div className="mt-1 text-[10px] leading-tight"
         style={{ color: "var(--nex-neutral-400)" }}>
      Approximate local price based on the{stale ? " latest available" : " latest live"} exchange rate.
      Final payment calculated in GBP.
    </div>
  );
}
