"use client";

// Xrated Trades — single-line office-hours marquee.
//
// Renders the tradesperson's operating hours as a horizontally
// scrolling strip. Pauses on hover (desktop) and on touch (mobile)
// with a 1.5s resume delay so the customer can read what they
// stopped on. Falls back to a static line on tradies who haven't
// set hours yet.

import { useEffect, useRef, useState } from "react";

type HourPair = { open: string; close: string } | null;
type HoursMap = Record<string, HourPair>;

const DAY_KEYS: { key: string; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" }
];

// "08:00" -> "8am"; "17:30" -> "5:30pm"; "13:00" -> "1pm".
function formatTimeCompact(input: string): string {
  const [hStr, mStr] = input.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h)) return input;
  const meridiem = h >= 12 ? "pm" : "am";
  const h12 = ((h + 11) % 12) + 1;
  const minutes = Number.isFinite(m) && m > 0 ? `:${String(m).padStart(2, "0")}` : "";
  return `${h12}${minutes}${meridiem}`;
}

// Render a run of consecutive days as "Mon-Fri 9am-5pm" or just "Sat
// 9am-1pm" when the run is a single day. Closed runs collapse to
// "closed Sunday" or "Sat-Sun closed".
function formatRun(
  start: { key: string; label: string },
  end: { key: string; label: string },
  hours: HourPair
): string {
  const range = start.key === end.key ? start.label : `${start.label}-${end.label}`;
  if (!hours) {
    return start.key === end.key ? `closed ${start.label}` : `${range} closed`;
  }
  return `${range} ${formatTimeCompact(hours.open)}-${formatTimeCompact(hours.close)}`;
}

function hoursEqual(a: HourPair, b: HourPair): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.open === b.open && a.close === b.close;
}

function summarise(hours: HoursMap): string {
  const groups: string[] = [];
  let runStart = 0;
  for (let i = 1; i <= DAY_KEYS.length; i++) {
    const prev = hours[DAY_KEYS[i - 1].key] ?? null;
    const next = i < DAY_KEYS.length ? (hours[DAY_KEYS[i].key] ?? null) : null;
    const lastDay = i === DAY_KEYS.length;
    if (lastDay || !hoursEqual(prev, next)) {
      groups.push(formatRun(DAY_KEYS[runStart], DAY_KEYS[i - 1], prev));
      runStart = i;
    }
  }
  return groups.join("  ·  ");
}

export function OfficeHoursMarquee({ hours }: { hours: HoursMap | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  const summary =
    hours && Object.keys(hours).length > 0
      ? summarise(hours)
      : "Mon-Fri 9am-5pm  ·  Sat 9am-1pm  ·  Sun closed";

  // Single span repeated so the strip can loop seamlessly.
  const text = `Office hours  ·  ${summary}`;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || paused) return;
    let raf = 0;
    let last = performance.now();
    const SPEED_PX_PER_SEC = 28;
    function tick(now: number) {
      const el = containerRef.current;
      if (!el) return;
      const dt = (now - last) / 1000;
      last = now;
      el.scrollLeft += SPEED_PX_PER_SEC * dt;
      const half = el.scrollWidth / 2;
      if (el.scrollLeft >= half) el.scrollLeft -= half;
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused]);

  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function pauseNow() {
    if (resumeTimer.current) {
      clearTimeout(resumeTimer.current);
      resumeTimer.current = null;
    }
    setPaused(true);
  }
  function scheduleResume(delayMs: number) {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), delayMs);
  }

  return (
    <div
      className="relative overflow-hidden rounded-lg bg-neutral-900 px-3 py-1.5"
      onMouseEnter={pauseNow}
      onMouseLeave={() => scheduleResume(300)}
    >
      <div
        ref={containerRef}
        className="flex gap-10 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onTouchStart={pauseNow}
        onTouchEnd={() => scheduleResume(1500)}
      >
        {[0, 1].map((i) => (
          <span
            key={i}
            className="shrink-0 text-xs font-bold text-white"
            aria-hidden={i === 1 ? "true" : undefined}
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
