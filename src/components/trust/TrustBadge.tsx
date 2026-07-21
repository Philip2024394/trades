// TrustBadge — the small chip rendered on public surfaces
// (canteen hero, yard listing cards, search results).
//
// Bronze isn't shown — everyone starts there so a Bronze badge is
// visual noise. Only Silver / Gold / Platinum earn a chip. Custom
// hex overrides the tier default when a Platinum merchant has
// purchased the £2.99 unlock.

import { Crown } from "lucide-react";

type Props = {
  tier:  "bronze" | "silver" | "gold" | "platinum" | null | undefined;
  color?: string | null;
  size?:  "sm" | "md";
};

const TIER_DEFAULT_COLOR: Record<string, { color: string; text: string; label: string }> = {
  silver:   { color: "#C0C0C0", text: "#111111", label: "Silver Verified" },
  gold:     { color: "#FFB300", text: "#0A0A0A", label: "Gold Trusted" },
  platinum: { color: "#4A5568", text: "#FFFFFF", label: "Platinum Elite" }
};

export function TrustBadge({ tier, color, size = "sm" }: Props) {
  if (!tier || tier === "bronze") return null;
  const meta = TIER_DEFAULT_COLOR[tier];
  if (!meta) return null;

  const bg = color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : meta.color;
  const px = size === "md" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]";
  const iconSize = size === "md" ? 12 : 10;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-black uppercase tracking-wider shadow-sm ${px}`}
      style={{ backgroundColor: bg, color: meta.text }}
      title={meta.label}
    >
      <Crown size={iconSize} strokeWidth={2.6}/> {meta.label.split(" ")[0]}
    </span>
  );
}
