// useIsTrade — single enforcement point for the "trade features only for
// trades" constitutional rule (feedback_trade_features_trade_only.md).
//
// Today: `authed` == "is trade" because every historical account was a
// trade. When the DIY signup path lands and `viewer_role` becomes part
// of the whoami response, this hook is the ONE place to tighten the
// gate to `trade?.viewerRole === "trade"`. Every consumer stays honest.

"use client";

import { useCurrentTrade } from "@/lib/useCurrentTrade";

export function useIsTrade(): boolean {
  const { trade } = useCurrentTrade();
  if (trade === null) return false;
  // Constitutional gate: DIY viewers NEVER see trade features. Legacy
  // accounts predating the viewer_role migration have their role
  // defaulted to "trade" server-side, so an undefined value on a
  // populated profile safely reads as trade too.
  return (trade.viewerRole ?? "trade") === "trade";
}
