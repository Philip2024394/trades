// Verified Trade Identity — inline badge.
//
// The one primitive every surface uses to signal "this trade is a
// Verified Trade Identity". Shows N of 8 layers verified + tap-to-open
// the full panel. Colour tokens sourced from brand: BRAND_GREEN_DARK
// for buttons (per memory `feedback_dark_green_only.md`), black+yellow
// for accents. Icon = Lucide only (per `feedback_lucide_icons_only.md`).

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import {
  countVerifiedLayers,
  type VerifiedTradeIdentity
} from "../data/tradeIdentities";

type Props = {
  trade: VerifiedTradeIdentity;
  size?: "sm" | "md";
  href?: string;
};

export function VerifiedTradeIdentityBadge({ trade, size = "md", href }: Props) {
  const verified = countVerifiedLayers(trade);
  const isTiny = size === "sm";
  const content = (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-black uppercase tracking-wider ${
        isTiny ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"
      }`}
      style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
    >
      <ShieldCheck size={isTiny ? 9 : 11} strokeWidth={2.5}/>
      Verified Trade · {verified}/8
    </span>
  );
  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
