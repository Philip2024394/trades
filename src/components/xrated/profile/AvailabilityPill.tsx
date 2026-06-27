"use client";

// Real-time "is this tradesperson reachable right now?" pill that sits
// above the WhatsApp Enquire button inside the three customer-facing
// modals (ViewCardModal, ServiceModal, ProductModal). Sets customer
// expectations BEFORE the WhatsApp tap so they know whether to expect
// a reply in 5 minutes or 5 hours.
//
// Three states:
//   available — green pill, dot glows
//   snoozed   — amber pill (inside hours but not accepting)
//   closed    — amber pill (outside hours) showing next opening time

import { useEffect, useState } from "react";
import {
  computeAvailability,
  type AvailabilityStatus,
  type OperatingHours
} from "@/lib/availabilityStatus";

const COLORS: Record<AvailabilityStatus, string> = {
  available: "#0F7A3F",
  snoozed: "#B07000",
  closed: "#7A4F00"
};

export function AvailabilityPill({
  acceptingJobs,
  operatingHours,
  className = ""
}: {
  acceptingJobs: boolean;
  operatingHours: OperatingHours | null;
  className?: string;
}) {
  // Re-render every 60s so the pill flips from "Back online at 7:00 AM"
  // to "Available now" the moment the hour passes — no page reload.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const { status, label } = computeAvailability(
    acceptingJobs,
    operatingHours
  );
  const bg = COLORS[status];

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-extrabold text-white shadow-sm sm:text-[13px] ${className}`}
      style={{ background: bg }}
      role="status"
      aria-live="polite"
    >
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full bg-white"
        style={
          status === "available"
            ? { boxShadow: "0 0 6px rgba(255,255,255,0.95)" }
            : undefined
        }
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
