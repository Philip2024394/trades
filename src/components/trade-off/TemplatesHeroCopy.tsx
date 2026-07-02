"use client";

// Regionalised hero copy for the templates page. On mount we resolve
// the visitor's country directly from THEIR browser IP via
// ipapi.co/json (free, CORS-enabled, no key). The browser-issued
// request means it works identically in dev and in prod — Vercel's
// edge headers only matter when our server origins the request, but
// here the browser hits ipapi.co straight, so localhost still
// detects a US dev's IP as US.
//
// First paint shows a neutral global hook so the headline doesn't
// flash a stale country name; the moment the IP resolves (~150ms in
// practice) the country swaps in. If lookup fails, the neutral
// wording stays — we deliberately do NOT default to UK.

import { useEffect, useState } from "react";

const ACCENT = "#FFB300";

// Short-form country names for the headline so it stays punchy.
// Anything not in here uses the full ipapi.co `country_name` value.
const SHORT_NAMES: Record<string, string> = {
  GB: "UK",
  US: "USA",
  AE: "UAE"
};

export function TemplatesHeroCopy({ totalCount }: { totalCount: number }) {
  const [shortName, setShortName] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Free + CORS-enabled — returns { country_code, country_name,
        // country, region, ... }. We only need the first two.
        const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json().catch(() => null)) as {
          country_code?: string;
          country_name?: string;
        } | null;
        if (cancelled || !j?.country_code || !j?.country_name) return;
        const iso2 = j.country_code.toUpperCase();
        setShortName(SHORT_NAMES[iso2] ?? j.country_name);
        setFullName(j.country_name);
      } catch {
        /* network blip — neutral headline stays */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <p
        className="text-xs font-bold uppercase tracking-[0.22em]"
        style={{ color: ACCENT }}
      >
        Industry Packs & templates
      </p>
      <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
        {shortName ? `${shortName}'s` : "The"} largest collection of{" "}
        <span style={{ color: ACCENT }}>
          trade business templates.
        </span>
      </h1>
      <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
        {totalCount} ready-built business apps across five categories — Service,
        Installation, Manufacture, Sales and Hire. Pick the one that fits
        how you work and your business is live in under five minutes.{" "}
        <span className="font-bold text-white">
          Free for life{fullName ? ` in ${fullName}` : ""}. No commissions,
          no fees, no card needed.
        </span>
      </p>
    </>
  );
}
