// Trade Center Picks — render the 5 controlled-enum merchant status chips.
//
// Single source of truth for the chip palette + labels. Public profile
// (TradeCenterPicksSection) and dashboard editor (TradeCenterPicksEditor +
// TradeCenterPicksStatusPicker) both import from here so a new chip
// wouldn't fork its colours across surfaces.
//
// Vocabulary is merchant-flavoured (On promo / New arrival / Just arrived /
// In stock / Pre-order) — distinct from Job Diary's project-status chips,
// which is why this lives in a SEPARATE palette file under merchant/.

import type { HammerexXratedTradeCenterPick } from "@/lib/supabase";

export type TradeCenterPickStatusKey = HammerexXratedTradeCenterPick["status"];

export const STATUS_LABELS: Record<
  TradeCenterPickStatusKey,
  { label: string; dot: string; bg: string; text: string; description: string }
> = {
  on_promo: {
    label: "On promo",
    dot: "#FFB300",
    bg: "#0A0A0A",
    text: "#FFB300",
    description: "Limited-time price"
  },
  new_arrival: {
    label: "New arrival",
    dot: "#FFB300",
    bg: "#0A0A0A",
    text: "#FFB300",
    description: "Just added to the yard"
  },
  just_arrived: {
    label: "Just arrived",
    dot: "#FFB300",
    bg: "#0A0A0A",
    text: "#FFB300",
    description: "Pallet landed this week"
  },
  pre_order: {
    label: "Pre-order",
    dot: "#FFB300",
    bg: "#0A0A0A",
    text: "#FFB300",
    description: "Reserve ahead — arrives [date]"
  }
};

export const STATUS_KEYS: TradeCenterPickStatusKey[] = [
  "on_promo",
  "new_arrival",
  "just_arrived",
  "pre_order"
];

export function TradeCenterPickStatusChip({
  status,
  size = "md"
}: {
  status: TradeCenterPickStatusKey;
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
