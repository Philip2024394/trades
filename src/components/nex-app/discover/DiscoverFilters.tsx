"use client";

// DiscoverFilters — segmented control for the three V1 discovery
// segments. Future segments (Dating · Gaming · Sports · Education ·
// Language · Pets) hang off the same array — deliberately locked to
// three at V1 per spec.

import { Users, Building2, Globe2 } from "lucide-react";
import type { DiscoverSegment } from "@/lib/nex/discover/_types";

const SEGMENTS: Array<{ id: DiscoverSegment; label: string; icon: typeof Users }> = [
  { id: "people",      label: "People",      icon: Users },
  { id: "businesses",  label: "Businesses",  icon: Building2 },
  { id: "communities", label: "Communities", icon: Globe2 }
];

export function DiscoverFilters({
  segment, onSegmentChange
}: {
  segment:         DiscoverSegment;
  onSegmentChange: (s: DiscoverSegment) => void;
}) {
  return (
    <div className="mt-3 px-4">
      <div
        className="flex gap-1 rounded-full p-1"
        style={{
          background: "var(--nex-neutral-0)",
          border: "1px solid var(--nex-neutral-200)",
          boxShadow: "var(--nex-shadow-sm)"
        }}
        role="tablist"
        aria-label="Discovery segment"
      >
        {SEGMENTS.map((s) => {
          const active = s.id === segment;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSegmentChange(s.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-[11.5px] font-semibold transition-all"
              style={{
                background: active ? "var(--nex-accent-500)" : "transparent",
                color:      active ? "var(--nex-neutral-0)"  : "var(--nex-neutral-700)",
                boxShadow:  active ? "var(--nex-shadow-sm)"  : "none"
              }}
            >
              <s.icon size={14} strokeWidth={2} />
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
