// Xrated Trades — "Trades On Standby" availability + headline-rate helpers.
// Shared by the landing-page list, the editor panel, and the API sanitiser
// so the allowed values stay in one place.

export const AVAILABILITY_LABELS: Record<string, string> = {
  now: "Ready now",
  tomorrow: "Start tomorrow",
  this_week: "Start this week",
  next_week: "Start next week",
  two_weeks: "Start in 2 weeks",
  later: "Start later"
};

export const AVAILABILITY_OPTIONS = [
  { value: "now", label: "Ready now" },
  { value: "tomorrow", label: "Start tomorrow" },
  { value: "this_week", label: "Start this week" },
  { value: "next_week", label: "Start next week" },
  { value: "two_weeks", label: "Start in 2 weeks" },
  { value: "later", label: "Start later" }
] as const;

// Ordering rank used by the landing page to sort soonest-available first.
// Anything not on the list sinks to the bottom.
const AVAILABILITY_RANK: Record<string, number> = {
  now: 0,
  tomorrow: 1,
  this_week: 2,
  next_week: 3,
  two_weeks: 4,
  later: 5
};

export function availabilityRank(value: string | null | undefined): number {
  if (!value) return 99;
  return AVAILABILITY_RANK[value] ?? 99;
}

export function formatHeadlineRate(
  rate: { amount: number; unit: string; currency: string } | null | undefined
): string | null {
  if (!rate || !rate.amount) return null;
  const symbol = rate.currency === "GBP" ? "£" : rate.currency + " ";
  const u = (rate.unit ?? "").trim();
  if (u.toLowerCase() === "from") {
    return `From ${symbol}${rate.amount.toLocaleString("en-GB")}`;
  }
  return `${symbol}${rate.amount.toLocaleString("en-GB")} ${u}`;
}
