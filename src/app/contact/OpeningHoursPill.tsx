"use client";

// OpeningHoursPill — small live "Open today · 8am – 5pm" chip that
// sits on the right side of the Contact page eyebrow. Reads the
// visitor's local weekday and prints the day's opening hours.
//
// Weekend copy softens the "Open today" phrasing; office is Mon–Fri.
// Reused pattern — a canteen version will follow so each merchant's
// own opening hours render on their profile.

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

const HOURS: Record<number, { open: string; close: string } | null> = {
  0: null,                              // Sun
  1: { open: "8am", close: "5pm" },     // Mon
  2: { open: "8am", close: "5pm" },     // Tue
  3: { open: "8am", close: "5pm" },     // Wed
  4: { open: "8am", close: "5pm" },     // Thu
  5: { open: "8am", close: "5pm" },     // Fri
  6: null                               // Sat
};

export function OpeningHoursPill() {
  // Read the day client-side so it reflects the visitor's clock.
  // Server-render with a neutral Mon-Fri window so SSR doesn't ship a
  // stale "Closed" flash on a weekend load.
  const [today, setToday] = useState<{ open: string; close: string } | null | undefined>(
    undefined
  );
  useEffect(() => {
    setToday(HOURS[new Date().getDay()] ?? null);
  }, []);

  const isOpen = today != null;
  const label = today === undefined
    ? "Mon-Fri · 8am - 5pm"
    : isOpen
      ? `Open today · ${today.open} - ${today.close}`
      : "Closed today · Mon 8am";

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold text-white/95 shadow-sm backdrop-blur"
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: isOpen === false ? "#EF4444" : "#22C55E" }}
      />
      <Clock size={11} strokeWidth={2.5}/>
      {label}
    </span>
  );
}
