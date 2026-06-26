// Xrated Trades — premium-tier "Operating hours" panel.
// Server component: pure render from the `operating_hours` jsonb.
// Highlights today's row in brand orange. Days missing render "Closed".
//
// Time format: COMPACT 12-hour, lowercase am/pm, leading zero stripped,
// `:00` minutes dropped. So "08:00" -> "8am", "17:30" -> "5:30pm",
// "13:00" -> "1pm". The editor still stores HH:MM (24-hour) — this is
// display-only formatting.

type Hours = { open: string; close: string } | null;
type HoursMap = Record<string, Hours>;

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" }
];

// Date.getDay() — 0 = Sunday … 6 = Saturday
const DAY_KEY_BY_INDEX = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function todayKey(): string {
  return DAY_KEY_BY_INDEX[new Date().getDay()];
}

/**
 * Compact 12-hour formatter.
 *   "08:00" -> "8am"
 *   "17:30" -> "5:30pm"
 *   "13:00" -> "1pm"
 *   "00:00" -> "12am"
 *   "12:00" -> "12pm"
 * Falls back to the raw input if it cannot parse.
 */
export function formatTimeCompact(input: string): string {
  if (!input) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(input.trim());
  if (!m) return input;
  const h = Number(m[1]);
  const mins = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mins)) return input;
  if (h < 0 || h > 23 || mins < 0 || mins > 59) return input;
  const period = h >= 12 ? "pm" : "am";
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return mins === 0 ? `${hour12}${period}` : `${hour12}:${String(mins).padStart(2, "0")}${period}`;
}

export function OperatingHoursPanel({
  hours,
  themeColor,
  bare = false
}: {
  hours: HoursMap;
  themeColor: string;
  /**
   * When true, drop the outer `<section>` chrome (used inside the inline
   * expand panel where the parent already provides padding + max-width).
   */
  bare?: boolean;
}) {
  const keys = Object.keys(hours || {});
  if (keys.length === 0) return null;

  const today = todayKey();

  const list = (
    <>
      <h3
        className="text-xs font-bold uppercase tracking-widest"
        style={{ color: themeColor }}
      >
        Operating hours
      </h3>
      <ul className="mt-3 overflow-hidden rounded-2xl border border-brand-line bg-brand-surface/40">
        {DAYS.map(({ key, label }) => {
          const slot = hours[key] ?? null;
          const isToday = key === today;
          const text =
            slot && slot.open && slot.close
              ? `${formatTimeCompact(slot.open)} – ${formatTimeCompact(slot.close)}`
              : "Closed";
          return (
            <li
              key={key}
              className="flex items-center justify-between border-b border-brand-line/40 px-4 py-3 last:border-b-0"
              style={
                isToday
                  ? { background: `${themeColor}1A`, color: themeColor }
                  : undefined
              }
            >
              <span
                className={`text-[13px] font-semibold ${
                  isToday ? "" : "text-brand-text"
                }`}
              >
                {label}
                {isToday && (
                  <span className="ml-2 text-xs font-bold uppercase tracking-wide opacity-80">
                    Today
                  </span>
                )}
              </span>
              <span
                className={`text-[13px] ${
                  isToday ? "font-bold" : slot ? "text-brand-text" : "text-brand-muted"
                }`}
              >
                {text}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );

  if (bare) return <div>{list}</div>;

  return (
    <section className="mx-auto max-w-3xl px-4 pb-2 pt-8">
      {list}
    </section>
  );
}
