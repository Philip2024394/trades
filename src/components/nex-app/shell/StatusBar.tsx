"use client";

// StatusBar — thin faux iOS status strip at the very top of the app.
// Shows current time top-left + signal / wifi / battery glyphs top-right.
// Matches the mockup's iOS-frame status bar so the PWA feels native.

import { useEffect, useState } from "react";
import { Signal, Wifi, BatteryFull } from "lucide-react";

export function StatusBar() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const time = now
    ? now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "9:41";

  return (
    <div
      className="flex items-center justify-between px-6 pt-2 pb-1 text-[13px] font-semibold"
      style={{ color: "var(--nex-neutral-900)" }}
      aria-hidden
    >
      <span className="tabular-nums">{time}</span>
      <span className="flex items-center gap-1.5">
        <Signal size={14} strokeWidth={2} />
        <Wifi size={14} strokeWidth={2} />
        <BatteryFull size={18} strokeWidth={2} />
      </span>
    </div>
  );
}
