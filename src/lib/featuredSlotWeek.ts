// Featured-slot auction — helper to compute the "current week" and
// "next week" boundaries used by the bidding API + weekly cron.
//
// Slots run Monday → Sunday UK time. Bidding for week N closes at
// Sunday 23:59 UTC of week N-1 (i.e. the day before the slot starts).

/** ISO date (YYYY-MM-DD) of the Monday of the week `date` falls in.
 *  Sunday counts as the *previous* Monday's week (UK convention). */
export function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayIdx = d.getUTCDay();           // 0=Sun, 1=Mon..6=Sat
  const offsetToMon = dayIdx === 0 ? -6 : 1 - dayIdx;
  d.setUTCDate(d.getUTCDate() + offsetToMon);
  return d.toISOString().slice(0, 10);
}

/** Monday of NEXT week (i.e. the auction merchants can currently bid on). */
export function nextMonday(now: Date = new Date()): string {
  const currentMon = new Date(mondayOf(now) + "T00:00:00Z");
  currentMon.setUTCDate(currentMon.getUTCDate() + 7);
  return currentMon.toISOString().slice(0, 10);
}
