// Job Diary — render the 8 controlled-enum status chips.
//
// Single source of truth for the chip palette + labels. Public profile
// and dashboard editor both import from here so a new chip wouldn't
// fork its colours across two surfaces.
//
// All eight values are NEUTRAL-FRAMED — even the delay chips read as
// "stuff happens on real building sites", not "something is wrong".
// That's deliberate: tradespeople were burned by review platforms that
// punish honest communication.

import type { HammerexXratedProjectUpdate } from "@/lib/supabase";

export type StatusChipKey = HammerexXratedProjectUpdate["status_chip"];

export const STATUS_LABELS: Record<
  StatusChipKey,
  { label: string; dot: string; bg: string; text: string; description: string }
> = {
  on_track: {
    label: "On track",
    dot: "#10B981",
    bg: "rgba(16,185,129,0.12)",
    text: "#10B981",
    description: "Running to plan"
  },
  stage_complete: {
    label: "Stage complete",
    dot: "#059669",
    bg: "rgba(5,150,105,0.12)",
    text: "#059669",
    description: "Wrapped a defined stage"
  },
  inspection_passed: {
    label: "Inspection passed",
    dot: "#0D9488",
    bg: "rgba(13,148,136,0.12)",
    text: "#0D9488",
    description: "Building Control / Gas Safe / electrical signed off"
  },
  weather_delay: {
    label: "Weather delay",
    dot: "#3B82F6",
    bg: "rgba(59,130,246,0.12)",
    text: "#3B82F6",
    description: "Weather pushed us back"
  },
  materials_delay: {
    label: "Materials delay",
    dot: "#F97316",
    bg: "rgba(249,115,22,0.12)",
    text: "#F97316",
    description: "Waiting on supplier"
  },
  scope_change: {
    label: "Scope changed",
    dot: "#A855F7",
    bg: "rgba(168,85,247,0.12)",
    text: "#A855F7",
    description: "Customer added work"
  },
  snagging: {
    label: "Snagging",
    dot: "#6366F1",
    bg: "rgba(99,102,241,0.12)",
    text: "#6366F1",
    description: "Punch-list / final tweaks"
  },
  completed: {
    label: "Completed",
    dot: "#FFB300",
    bg: "rgba(255,179,0,0.14)",
    text: "#FFB300",
    description: "Project closed out"
  }
};

export const STATUS_KEYS: StatusChipKey[] = [
  "on_track",
  "stage_complete",
  "inspection_passed",
  "weather_delay",
  "materials_delay",
  "scope_change",
  "snagging",
  "completed"
];

export function StatusChip({
  status,
  size = "md"
}: {
  status: StatusChipKey;
  size?: "sm" | "md";
}) {
  const entry = STATUS_LABELS[status];
  const isSm = size === "sm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-extrabold ${
        isSm ? "h-6 px-2 text-[10px]" : "h-7 px-2.5 text-[13px]"
      }`}
      style={{ background: entry.bg, color: entry.text }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: entry.dot }}
      />
      {entry.label}
    </span>
  );
}
