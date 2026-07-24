// IANA timezone helpers. Never uses server time.
//
// Rule: the merchant picks a local time ("Friday 17:00 in Europe/London").
// We store the resolved UTC instant in scheduled_for + the IANA name in
// scheduled_tz. Rendering back uses Intl.DateTimeFormat with the same tz.

const WEEKDAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] as const;
type Weekday = typeof WEEKDAYS[number];

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch { return false; }
}

/** Return the UTC offset (minutes) that `tz` is at the given UTC instant. */
export function utcOffsetMinutes(tz: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
  });
  const parts = dtf.formatToParts(at).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value; return acc;
  }, {});
  // Interpret those local parts AS a UTC instant, then diff.
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour === "24" ? 0 : parts.hour), Number(parts.minute), Number(parts.second)
  );
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Convert a wall-clock time in a specific IANA zone → the actual UTC
 *  Date the platform should fire at. Handles DST implicitly. */
export function localToUtc(input: {
  year: number; month: number; day: number;
  hour: number; minute: number;
  timezone: string;
}): Date {
  const guessUtc = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, 0);
  const guessDate = new Date(guessUtc);
  const offset1 = utcOffsetMinutes(input.timezone, guessDate);
  // Iterate once (DST edge) to converge.
  const secondGuess = new Date(guessUtc - offset1 * 60000);
  const offset2 = utcOffsetMinutes(input.timezone, secondGuess);
  return new Date(guessUtc - offset2 * 60000);
}

/** Compute the NEXT occurrence (UTC) of the given weekly pattern in the
 *  merchant's timezone. Pattern like "weekly:friday@17:00". */
export function nextWeeklyRun(input: {
  pattern:  string;
  timezone: string;
  now?:     Date;
}): Date | null {
  const m = /^weekly:([a-z]+)@(\d{1,2}):(\d{2})$/i.exec(input.pattern.trim());
  if (!m) return null;
  const wd = m[1].toLowerCase() as Weekday;
  if (!WEEKDAYS.includes(wd)) return null;
  const targetDow  = WEEKDAYS.indexOf(wd);
  const targetHour = Number(m[2]);
  const targetMin  = Number(m[3]);
  if (Number.isNaN(targetHour) || Number.isNaN(targetMin)) return null;

  const now = input.now ?? new Date();
  // Read what day-of-week + hour/min it is right now IN THE MERCHANT'S TZ.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: input.timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "long",
    hour12: false
  });
  const parts = dtf.formatToParts(now).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value; return acc;
  }, {});
  const localDow  = WEEKDAYS.indexOf((parts.weekday ?? "monday").toLowerCase() as Weekday);
  const localHour = Number(parts.hour === "24" ? 0 : parts.hour);
  const localMin  = Number(parts.minute);

  // Days to add to reach targetDow at targetHour:targetMin in local time.
  let daysAhead = (targetDow - localDow + 7) % 7;
  const alreadyPastToday = daysAhead === 0 && (localHour * 60 + localMin) >= (targetHour * 60 + targetMin);
  if (alreadyPastToday) daysAhead = 7;

  // Compute the target local date parts by shifting from today.
  const todayYear  = Number(parts.year);
  const todayMonth = Number(parts.month);
  const todayDay   = Number(parts.day);
  const shifted   = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay + daysAhead));
  const y = shifted.getUTCFullYear();
  const mo = shifted.getUTCMonth() + 1;
  const d = shifted.getUTCDate();

  return localToUtc({ year: y, month: mo, day: d, hour: targetHour, minute: targetMin, timezone: input.timezone });
}

/** Human-readable local rendering. Used by admin UI so we don't show
 *  merchants a UTC ISO. */
export function formatInTz(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      dateStyle: "medium", timeStyle: "short"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
