// Nex greeting — makes the chat feel continuous, not stateless.
// Uses time-of-day + last-seen so Nex says the right thing without
// ever asking who the merchant is.

export type GreetingInput = {
  firstName:      string;
  lastSeenAt:     string | null;   // ISO
  pendingReviews: number;
  now?:           Date;             // injectable for tests
};

/** Build the greeting string + optional briefing line. */
export function buildGreeting(input: GreetingInput): { greeting: string; briefing: string | null } {
  const now = input.now ?? new Date();
  const hour = now.getUTCHours() + 1;  // UK-ish; DST tweak not worth for a greeting
  const timeOfDay =
    hour < 5  ? "Late one"          :
    hour < 12 ? "Good morning"      :
    hour < 17 ? "Afternoon"         :
    hour < 21 ? "Evening"           :
                "Evening";

  const first = (input.firstName || "").split(" ")[0] || "";
  const greetingCore = first ? `${timeOfDay}, ${first}.` : `${timeOfDay}.`;

  const gap = input.lastSeenAt ? now.getTime() - new Date(input.lastSeenAt).getTime() : null;
  const days = gap !== null ? Math.floor(gap / (1000 * 60 * 60 * 24)) : null;

  let welcome = "";
  if (days === null)     welcome = " First visit — welcome to Nex.";
  else if (days === 0)   welcome = " Back so soon?";
  else if (days === 1)   welcome = " Welcome back.";
  else if (days <= 7)    welcome = " Welcome back.";
  else if (days <= 30)   welcome = ` Been ${days} days.`;
  else                    welcome = " Long time no see.";

  const greeting = greetingCore + welcome;

  let briefing: string | null = null;
  if (input.pendingReviews > 0) {
    briefing = `${input.pendingReviews} knowledge item${input.pendingReviews === 1 ? "" : "s"} waiting for your review.`;
  }

  return { greeting, briefing };
}
