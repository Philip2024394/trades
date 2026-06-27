// Compute the "is the tradesperson reachable right now?" pill state from
// the simple inputs we already store: `accepting_jobs` (boolean) and
// `operating_hours` (Mon-Sun open/close). Used by AvailabilityPill in
// the three customer-facing enquire modals so customers see a real-time
// expectation BEFORE they tap WhatsApp ("Available now" vs
// "Back online at 7:00 AM tomorrow").
//
// Time-zone note: we trust the browser's local clock. UK tradies serving
// UK customers will match — both sides see BST/GMT. Cross-time-zone
// edge cases (customer abroad) accept a small skew rather than introduce
// a server fetch on every modal open.

export type AvailabilitySlot = { open: string; close: string } | null;
export type OperatingHours = Record<string, AvailabilitySlot>;
export type AvailabilityStatus = "available" | "snoozed" | "closed";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function computeAvailability(
  acceptingJobs: boolean,
  operatingHours: OperatingHours | null,
  now: Date = new Date()
): { status: AvailabilityStatus; label: string } {
  if (acceptingJobs) {
    return {
      status: "available",
      label: "Available now — usually replies in minutes"
    };
  }

  if (!operatingHours) {
    return {
      status: "snoozed",
      label: "Currently offline — leave a message"
    };
  }

  const nowMins = now.getHours() * 60 + now.getMinutes();
  const todayKey = DAY_KEYS[now.getDay()];
  const todaySlot = operatingHours[todayKey];

  if (todaySlot) {
    const openMins = toMins(todaySlot.open);
    const closeMins = toMins(todaySlot.close);
    if (openMins !== null && closeMins !== null) {
      if (nowMins >= openMins && nowMins < closeMins) {
        return {
          status: "snoozed",
          label: "Snoozed — back shortly"
        };
      }
    }
  }

  const next = findNextOpening(operatingHours, now);
  if (next) {
    return { status: "closed", label: `Back online ${next}` };
  }

  return {
    status: "snoozed",
    label: "Currently offline — leave a message"
  };
}

function findNextOpening(hours: OperatingHours, now: Date): string | null {
  const nowMins = now.getHours() * 60 + now.getMinutes();

  for (let i = 0; i < 7; i++) {
    const checkDayIdx = (now.getDay() + i) % 7;
    const key = DAY_KEYS[checkDayIdx];
    const slot = hours[key];
    if (!slot) continue;
    const openMins = toMins(slot.open);
    if (openMins === null) continue;

    if (i === 0) {
      if (nowMins < openMins) return `at ${format12(slot.open)}`;
    } else if (i === 1) {
      return `tomorrow at ${format12(slot.open)}`;
    } else {
      return `${DAY_NAMES[checkDayIdx]} at ${format12(slot.open)}`;
    }
  }
  return null;
}

function toMins(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const mn = Number(m[2]);
  if (h < 0 || h > 23 || mn < 0 || mn > 59) return null;
  return h * 60 + mn;
}

function format12(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0
    ? `${h12}:00 ${ampm}`
    : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
