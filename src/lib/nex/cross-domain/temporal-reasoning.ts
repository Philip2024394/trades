// src/lib/nex/cross-domain/temporal-reasoning.ts
//
// Founder Phase 5 · P5-4 · temporal reasoning helper.
//
// Parses natural-language time constraints into concrete windows so
// downstream filters can check "open tonight" · "closes before we
// arrive" · etc. Doctrine-safe: unknown phrasing → null (honest
// UNKNOWN · never fabricates a time).

export interface TimeWindow {
  start_iso: string;
  end_iso: string;
  tz: string;
  hint: string;                   // the original phrase for observability
}

export interface ParseOptions {
  /** Reference now for testing · defaults to Date.now(). */
  now?: Date;
  /** IANA tz (default: Asia/Jakarta for NEX default deployment). */
  tz?: string;
}

/**
 * Parse a phrase into a TimeWindow. Returns null when the phrase
 * doesn't match a known pattern (honest UNKNOWN).
 *
 * Supported (case-insensitive):
 *   now                             → next 60 min from now
 *   tonight                         → 18:00 → 23:59 local today
 *   this evening                    → same as tonight
 *   tomorrow                        → 00:00 → 23:59 local +1 day
 *   tomorrow morning                → 06:00 → 11:00 local +1 day
 *   tomorrow afternoon              → 12:00 → 17:00 local +1 day
 *   tomorrow evening / tomorrow night → 18:00 → 23:59 local +1 day
 *   this weekend / weekend          → Sat 00:00 → Sun 23:59
 *   next week                       → Mon 00:00 → Sun 23:59 of next ISO week
 *   morning / afternoon / evening   → today's segment (if still future) else next day
 */
export function parseTemporalHint(phrase: string, opts: ParseOptions = {}): TimeWindow | null {
  if (!phrase) return null;
  const tz = opts.tz ?? "Asia/Jakarta";
  const now = opts.now ?? new Date();
  const p = phrase.toLowerCase().trim();

  const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const setLocal = (d: Date, h: number, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const iso = (d: Date) => d.toISOString();

  if (/^now$/.test(p) || /^right now$/.test(p)) {
    return { start_iso: iso(now), end_iso: iso(new Date(now.getTime() + 60 * 60_000)), tz, hint: p };
  }
  if (/^(tonight|this evening)$/.test(p)) {
    const today = startOfLocalDay(now);
    return { start_iso: iso(setLocal(today, 18)), end_iso: iso(setLocal(today, 23, 59)), tz, hint: p };
  }
  if (/^tomorrow$/.test(p)) {
    const t = addDays(startOfLocalDay(now), 1);
    return { start_iso: iso(setLocal(t, 0)), end_iso: iso(setLocal(t, 23, 59)), tz, hint: p };
  }
  if (/^tomorrow morning$/.test(p)) {
    const t = addDays(startOfLocalDay(now), 1);
    return { start_iso: iso(setLocal(t, 6)), end_iso: iso(setLocal(t, 11)), tz, hint: p };
  }
  if (/^tomorrow afternoon$/.test(p)) {
    const t = addDays(startOfLocalDay(now), 1);
    return { start_iso: iso(setLocal(t, 12)), end_iso: iso(setLocal(t, 17)), tz, hint: p };
  }
  if (/^tomorrow (evening|night)$/.test(p)) {
    const t = addDays(startOfLocalDay(now), 1);
    return { start_iso: iso(setLocal(t, 18)), end_iso: iso(setLocal(t, 23, 59)), tz, hint: p };
  }
  if (/^this weekend$|^weekend$|^akhir pekan$/.test(p)) {
    // Nearest Saturday 00:00 → Sunday 23:59.
    const day = now.getDay();                      // 0=Sun · 6=Sat
    const daysToSat = (6 - day + 7) % 7;
    const sat = addDays(startOfLocalDay(now), daysToSat);
    const sun = addDays(sat, 1);
    return { start_iso: iso(setLocal(sat, 0)), end_iso: iso(setLocal(sun, 23, 59)), tz, hint: p };
  }
  if (/^next week$/.test(p)) {
    const day = now.getDay();
    const daysToMon = ((1 - day + 7) % 7) || 7;    // next Monday
    const mon = addDays(startOfLocalDay(now), daysToMon);
    const sun = addDays(mon, 6);
    return { start_iso: iso(setLocal(mon, 0)), end_iso: iso(setLocal(sun, 23, 59)), tz, hint: p };
  }
  if (/^morning$|^pagi$/.test(p)) {
    const today = startOfLocalDay(now);
    const morningEnd = setLocal(today, 11);
    if (now < morningEnd) return { start_iso: iso(now), end_iso: iso(morningEnd), tz, hint: p };
    // already past · use tomorrow morning
    const t = addDays(today, 1);
    return { start_iso: iso(setLocal(t, 6)), end_iso: iso(setLocal(t, 11)), tz, hint: p };
  }
  if (/^afternoon$|^siang$/.test(p)) {
    const today = startOfLocalDay(now);
    const noon = setLocal(today, 12);
    const afternoonEnd = setLocal(today, 17);
    if (now < afternoonEnd) return { start_iso: iso(now < noon ? noon : now), end_iso: iso(afternoonEnd), tz, hint: p };
    const t = addDays(today, 1);
    return { start_iso: iso(setLocal(t, 12)), end_iso: iso(setLocal(t, 17)), tz, hint: p };
  }
  if (/^evening$|^sore$|^malam$/.test(p)) {
    const today = startOfLocalDay(now);
    const eveningEnd = setLocal(today, 23, 59);
    return { start_iso: iso(setLocal(today, 18)), end_iso: iso(eveningEnd), tz, hint: p };
  }
  if (/^today$|^hari ini$/.test(p)) {
    const today = startOfLocalDay(now);
    return { start_iso: iso(now), end_iso: iso(setLocal(today, 23, 59)), tz, hint: p };
  }
  return null; // honest UNKNOWN
}
