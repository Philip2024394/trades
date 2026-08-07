// NEX Delivery Engine · country/timezone-aware send-window engine
//
// Given a country + preference config, decide whether NOW is inside
// the send window; if not, calculate the next eligible time.
//
// Uses Intl.DateTimeFormat for tz lookup (no external dep). Country
// → tz mapping covers common markets; unknown countries fall back to
// UTC + a default 08:00-20:00 window in that tz.

export type WindowConfig = {
  local_start_hour: number;              // inclusive · default 8
  local_end_hour: number;                // exclusive · default 20
  weekend_rule: "allow" | "skip";        // default 'allow'
};

const DEFAULT_CONFIG: WindowConfig = {
  local_start_hour: 8,
  local_end_hour: 20,
  weekend_rule: "allow",
};

// Country ISO2 → primary IANA timezone. For countries with multiple
// zones we choose the most populous. Unknown = UTC.
const COUNTRY_TZ: Record<string, string> = {
  GB: "Europe/London",
  IE: "Europe/Dublin",
  US: "America/New_York",       // NYC · workers in other US zones can override per-recipient later
  CA: "America/Toronto",
  AU: "Australia/Sydney",
  NZ: "Pacific/Auckland",
  IN: "Asia/Kolkata",
  ID: "Asia/Jakarta",
  SG: "Asia/Singapore",
  HK: "Asia/Hong_Kong",
  JP: "Asia/Tokyo",
  DE: "Europe/Berlin",
  FR: "Europe/Paris",
  ES: "Europe/Madrid",
  IT: "Europe/Rome",
  NL: "Europe/Amsterdam",
  SE: "Europe/Stockholm",
  NO: "Europe/Oslo",
  FI: "Europe/Helsinki",
  DK: "Europe/Copenhagen",
  BR: "America/Sao_Paulo",
  MX: "America/Mexico_City",
  AR: "America/Argentina/Buenos_Aires",
  ZA: "Africa/Johannesburg",
  AE: "Asia/Dubai",
  SA: "Asia/Riyadh",
};

const NAME_TO_ISO: Record<string, string> = {
  "united kingdom": "GB", "great britain": "GB", "england": "GB", "uk": "GB",
  "united states": "US", "usa": "US",
  "australia": "AU", "canada": "CA", "germany": "DE", "france": "FR",
  "india": "IN", "indonesia": "ID", "japan": "JP", "new zealand": "NZ",
};

export function normaliseCountry(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim();
  if (s.length === 2) return s.toUpperCase();
  const iso = NAME_TO_ISO[s.toLowerCase()];
  return iso ?? null;
}

function tzForCountry(country: string | null | undefined): string {
  const iso = normaliseCountry(country);
  return (iso && COUNTRY_TZ[iso]) || "UTC";
}

// Returns { hour, isWeekend, date } for the given instant in the tz.
function partsInTz(now: Date, tz: string): { year: number; month: number; day: number; hour: number; isWeekend: boolean } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
  });
  const parts = dtf.formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const weekday = (parts.find((p) => p.type === "weekday")?.value ?? "").toLowerCase();
  return {
    year: get("year"), month: get("month"), day: get("day"),
    hour: get("hour"),
    isWeekend: weekday === "sat" || weekday === "sun",
  };
}

export type WindowDecision =
  | { in_window: true;  next_eligible_at: string }
  | { in_window: false; next_eligible_at: string; reason: "quiet_hours" | "weekend"; tz: string };

/**
 * Decide whether NOW is in the send window for the given country.
 * If not, return the next eligible instant (as an ISO string).
 */
export function decideWindow(country: string | null | undefined, now: Date = new Date(), cfg: Partial<WindowConfig> = {}): WindowDecision {
  const config = { ...DEFAULT_CONFIG, ...cfg };
  const tz = tzForCountry(country);
  const p = partsInTz(now, tz);

  // Weekend rule
  if (p.isWeekend && config.weekend_rule === "skip") {
    return { in_window: false, next_eligible_at: nextMondayLocal(now, tz, config.local_start_hour), reason: "weekend", tz };
  }

  // Quiet hours
  if (p.hour < config.local_start_hour || p.hour >= config.local_end_hour) {
    return { in_window: false, next_eligible_at: nextWindowOpen(now, tz, config), reason: "quiet_hours", tz };
  }

  // In window · eligible immediately
  return { in_window: true, next_eligible_at: now.toISOString() };
}

// Return the next moment when `local_start_hour` becomes 0.0 in the given tz.
function nextWindowOpen(now: Date, tz: string, cfg: WindowConfig): string {
  // Walk forward hour-by-hour in the local tz until we hit start_hour on a valid day.
  const step = 60 * 60 * 1000;
  let t = now.getTime();
  for (let i = 0; i < 168; i++) {                        // safety cap 1 week
    t += step;
    const p = partsInTz(new Date(t), tz);
    if (p.hour >= cfg.local_start_hour && p.hour < cfg.local_end_hour) {
      if (p.isWeekend && cfg.weekend_rule === "skip") continue;
      return new Date(t).toISOString();
    }
  }
  return new Date(t).toISOString();
}

function nextMondayLocal(now: Date, tz: string, hour: number): string {
  const step = 60 * 60 * 1000;
  let t = now.getTime();
  for (let i = 0; i < 240; i++) {
    t += step;
    const p = partsInTz(new Date(t), tz);
    if (!p.isWeekend && p.hour === hour) return new Date(t).toISOString();
  }
  return new Date(t).toISOString();
}

export function timezoneForCountry(country: string | null | undefined): string {
  return tzForCountry(country);
}
