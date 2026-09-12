// src/lib/nex-agent/day-labels.ts
//
// Relative day labels for history cards.
//   Today · Yesterday · N days ago · Older
// Also computes the "should this card be purged?" 7-day threshold.

const DAY_MS = 24 * 60 * 60 * 1000;

export function dayLabel(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  // Normalise to UTC-day boundaries · avoids TZ off-by-one at midnight
  const toDayIndex = (ms: number) => Math.floor(ms / DAY_MS);
  const diff = toDayIndex(now) - toDayIndex(t);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  if (diff < 14) return "Last week";
  if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`;
  return "Older";
}

/** True if the task was submitted more than 7 * 24h ago. */
export function isStale(iso: string, now = Date.now(), thresholdDays = 7): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return (now - t) > thresholdDays * DAY_MS;
}

/** Bucket label for grouping (used by the History tab). */
export function dayBucket(iso: string, now = Date.now()): "today" | "yesterday" | "recent" | "week+" | "older" {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "older";
  const diff = Math.floor((now - t) / DAY_MS);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return "recent";
  if (diff < 30) return "week+";
  return "older";
}
