"use client";

// Phone input with a country-dial-code picker on the left. On first
// mount we fetch `/api/geo` to detect the visitor's country from edge
// headers and set the default prefix — overriding remains one tap
// away via the dropdown. Final stored value is `${dial}${digits}`
// (e.g. "+44 7700 900000"), preserving the existing data shape.

import { useEffect, useState } from "react";
import {
  COUNTRY_DIAL_CODES,
  countryByIso2,
  splitPhone,
  type CountryDialCode
} from "@/lib/countryDialCodes";

export function PhoneCountryInput({
  value,
  onChange,
  placeholder,
  maxLength = 40
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  const split = splitPhone(value);
  const initialCountry = countryByIso2(split.iso2) ?? COUNTRY_DIAL_CODES[0];
  const [country, setCountry] = useState<CountryDialCode>(initialCountry);
  const [local, setLocal] = useState<string>(split.local);
  // Lock detection to one auto-pick so a tradesperson who swaps to
  // their actual country isn't reset by a late-arriving geo response.
  const [autoDetected, setAutoDetected] = useState<boolean>(
    !!value && value.trim().length > 0
  );

  useEffect(() => {
    if (autoDetected) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/geo", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json().catch(() => null)) as { iso2?: string } | null;
        if (cancelled || !j?.iso2) return;
        const match = countryByIso2(j.iso2);
        if (!match) return;
        setCountry(match);
        // Commit immediately so the parent's stored value reflects the
        // detected prefix even if the user never tweaks anything.
        if (local) onChange(`${match.dial}${local}`);
        setAutoDetected(true);
      } catch {
        /* network blip — fall back to the default UK pick. */
      }
    })();
    return () => {
      cancelled = true;
    };
    // We only want this to run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commit(next: { country?: CountryDialCode; local?: string }) {
    const c = next.country ?? country;
    const l = next.local ?? local;
    onChange(l.trim().length === 0 ? "" : `${c.dial}${l}`);
  }

  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-brand-line bg-brand-bg focus-within:border-[#FFB300]">
      <label className="relative inline-flex items-center bg-neutral-100 px-2 text-[13px] font-bold text-brand-text">
        <span aria-hidden="true" className="mr-1.5 text-base">
          {country.flag}
        </span>
        <span className="font-mono">{country.dial}</span>
        <select
          aria-label="Country dial code"
          value={country.iso2}
          onChange={(e) => {
            const next = countryByIso2(e.target.value);
            if (!next) return;
            setCountry(next);
            setAutoDetected(true);
            commit({ country: next });
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {COUNTRY_DIAL_CODES.map((c) => (
            <option key={c.iso2} value={c.iso2}>
              {c.flag}  {c.name} ({c.dial})
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ml-1 text-brand-muted"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </label>
      <input
        type="tel"
        inputMode="tel"
        value={local}
        onChange={(e) => {
          const next = e.target.value;
          setLocal(next);
          setAutoDetected(true);
          commit({ local: next });
        }}
        placeholder={placeholder ?? "7700 900000"}
        maxLength={maxLength}
        className="h-11 min-w-0 flex-1 bg-transparent px-3 text-[13px] text-brand-text placeholder:text-brand-muted focus:outline-none"
      />
    </div>
  );
}
