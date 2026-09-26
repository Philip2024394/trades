"use client";

// src/app/nex-native/create-account/_phone-field.tsx
//
// NEX phone-with-country-prefix field · dark-navy styled.
// -------------------------------------------------------------------------
// Two coordinated inputs that post to the same form:
//   · phone_country_code · e.g. "+62" · comes from the <select>
//   · phone_national_number · digits only · e.g. "8123456789"
//
// Auto-detection order:
//   1. `initialIso2` prop from the server (parsed from Accept-Language)
//   2. navigator.language (e.g. "id-ID" → "ID")
//   3. Intl.DateTimeFormat().resolvedOptions().timeZone (mapped via a small
//      table for a handful of high-signal zones like Asia/Jakarta → ID)
//   4. Fallback: first country in COUNTRY_DIAL_CODES (GB)
//
// The user can always override via the dropdown.

import { useEffect, useMemo, useState } from "react";
import { COUNTRY_DIAL_CODES } from "@/lib/countryDialCodes";

interface Props {
  initialIso2?: string;
}

const NEX = {
  panel: "#03101D",
  fieldBg: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
};

// A minimal timezone → ISO2 fallback map. Covers the highest-signal zones
// for markets NEX serves. `Intl` returns e.g. "Asia/Jakarta" reliably even
// when navigator.language is a generic "en".
const TZ_TO_ISO2: Record<string, string> = {
  "Asia/Jakarta": "ID",
  "Asia/Makassar": "ID",
  "Asia/Jayapura": "ID",
  "Asia/Singapore": "SG",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Bangkok": "TH",
  "Asia/Ho_Chi_Minh": "VN",
  "Asia/Manila": "PH",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Asia/Kolkata": "IN",
  "Asia/Karachi": "PK",
  "Asia/Dubai": "AE",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Berlin": "DE",
  "Europe/Paris": "FR",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Lisbon": "PT",
  "Europe/Warsaw": "PL",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Pacific/Auckland": "NZ",
};

function detectIso2(): string | null {
  if (typeof window === "undefined") return null;
  // 1 · navigator.language e.g. "id-ID"
  try {
    const langs = [navigator.language, ...(navigator.languages ?? [])];
    for (const l of langs) {
      const m = l && l.match(/-([A-Z]{2})\b/i);
      if (m) return m[1]!.toUpperCase();
    }
  } catch { /* noop */ }
  // 2 · timezone
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ_TO_ISO2[tz]) return TZ_TO_ISO2[tz]!;
  } catch { /* noop */ }
  return null;
}

export function NexPhoneField({ initialIso2 }: Props) {
  // Order the option list so the auto-detected country floats to the top.
  // Deduplicate by dial code so the ordering doesn't create ambiguity.
  const [iso2, setIso2] = useState<string>(() => {
    if (initialIso2 && COUNTRY_DIAL_CODES.some((c) => c.iso2 === initialIso2)) {
      return initialIso2;
    }
    return COUNTRY_DIAL_CODES[0]!.iso2;
  });
  const [national, setNational] = useState("");

  // If the server didn't detect a country, try the client detectors on mount.
  useEffect(() => {
    if (initialIso2 && COUNTRY_DIAL_CODES.some((c) => c.iso2 === initialIso2)) return;
    const detected = detectIso2();
    if (detected && COUNTRY_DIAL_CODES.some((c) => c.iso2 === detected)) {
      setIso2(detected);
    }
  }, [initialIso2]);

  const selected = useMemo(
    () => COUNTRY_DIAL_CODES.find((c) => c.iso2 === iso2) ?? COUNTRY_DIAL_CODES[0]!,
    [iso2],
  );

  return (
    <div style={{ marginBottom: 14 }}>
      <span
        style={{
          display: "block",
          marginBottom: 6,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.16em",
          color: NEX.cyan,
          textTransform: "uppercase",
        }}
      >
        Phone
      </span>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "132px 1fr",
          gap: 8,
        }}
      >
        <select
          name="phone_iso2"
          value={iso2}
          onChange={(e) => setIso2(e.target.value)}
          aria-label="Country code"
          style={{
            minHeight: 48,
            padding: "12px 10px",
            background: NEX.fieldBg,
            color: NEX.textPrimary,
            border: `1px solid ${NEX.cyanSoft}`,
            borderRadius: 8,
            fontFamily: "inherit",
            fontSize: 14,
            outline: "none",
            appearance: "auto",
          }}
        >
          {COUNTRY_DIAL_CODES.map((c) => (
            <option key={c.iso2} value={c.iso2}>
              {c.flag} {c.dial} · {c.name}
            </option>
          ))}
        </select>
        <input
          required
          type="tel"
          name="phone_national_number"
          value={national}
          onChange={(e) => setNational(e.target.value.replace(/[^0-9]/g, "").slice(0, 15))}
          placeholder="8123456789"
          inputMode="tel"
          autoComplete="tel-national"
          pattern="^[0-9]{5,15}$"
          style={{
            minHeight: 48,
            padding: "12px 14px",
            background: NEX.fieldBg,
            color: NEX.textPrimary,
            border: `1px solid ${NEX.cyanSoft}`,
            borderRadius: 8,
            fontFamily: "inherit",
            fontSize: 14,
            letterSpacing: "0.02em",
            outline: "none",
          }}
        />
      </div>
      {/* Hidden actual dial code · the form action reads this by name */}
      <input type="hidden" name="phone_country_code" value={selected.dial} />
      <p
        style={{
          marginTop: 6,
          fontSize: 11,
          color: NEX.textSecondary,
          lineHeight: 1.4,
        }}
      >
        We use your country ({selected.flag} {selected.name}) to show the right
        NEX experience. Digits only · 5-15 characters.
      </p>
    </div>
  );
}
