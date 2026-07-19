// Business-day SLA utilities — UK standard, Sundays skipped.
//
// hasBusinessDaySlaElapsed(sentAt, now, hours=24) returns true when
// the elapsed clock (Mon-Sat only) since sentAt has exceeded `hours`.
// Sunday time doesn't count against the deadline.
//
// Examples (deadline = 24 business hours):
//   Mon 10:00 → Tue 10:00 (24h elapsed, no Sunday crossed)
//   Fri 18:00 → Sat 18:00 (24h elapsed, no Sunday crossed)
//   Sat 09:00 → Mon 09:00 (Sunday skipped)
//   Sun 14:00 → Mon 14:00 (Sunday doesn't count from start either)
//
// Reusable for any SLA on the platform (invitation response, beacon
// reply, warranty reminders, etc).

/** Sunday = 0 in JS Date.getUTCDay(). We treat all UTC Sundays as
 *  "off the clock" — good enough for UK-scoped SLAs at platform
 *  scale. Future: swap for user-timezone Sunday when we localise. */
const SUNDAY = 0;

/** Milliseconds of business time (Mon-Sat) between two Date values.
 *  Iterates in whole days for correctness at midnight boundaries,
 *  with partial-day fractions handled at both endpoints. */
export function businessMillisBetween(startAt: Date, endAt: Date): number {
  if (endAt.getTime() <= startAt.getTime()) return 0;

  const DAY_MS  = 24 * 60 * 60 * 1000;
  const startMs = startAt.getTime();
  const endMs   = endAt.getTime();

  // Fast-path — same UTC day.
  const startDayUtc = utcDayStart(startAt);
  const endDayUtc   = utcDayStart(endAt);
  if (startDayUtc.getTime() === endDayUtc.getTime()) {
    if (startAt.getUTCDay() === SUNDAY) return 0;
    return endMs - startMs;
  }

  let total = 0;

  // Start day partial (start → end of start day)
  if (startAt.getUTCDay() !== SUNDAY) {
    total += (startDayUtc.getTime() + DAY_MS) - startMs;
  }

  // Middle full days
  let cursor = startDayUtc.getTime() + DAY_MS;
  while (cursor + DAY_MS <= endDayUtc.getTime()) {
    const d = new Date(cursor);
    if (d.getUTCDay() !== SUNDAY) total += DAY_MS;
    cursor += DAY_MS;
  }

  // End day partial (start of end day → end)
  if (endAt.getUTCDay() !== SUNDAY) {
    total += endMs - endDayUtc.getTime();
  }

  return total;
}

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Has more than `hours` of business time (Mon-Sat) elapsed since
 *  `sentAt` measured against `now`? */
export function hasBusinessDaySlaElapsed(
  sentAt: Date | string,
  now:    Date = new Date(),
  hours:  number = 24
): boolean {
  const sent = typeof sentAt === "string" ? new Date(sentAt) : sentAt;
  return businessMillisBetween(sent, now) >= hours * 60 * 60 * 1000;
}
