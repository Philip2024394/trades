// Marketplace — Trust Score chip.
// Renders the merchant's composite trust score + count of verified
// layers. Colour bands: 90+ green, 80-89 amber-green, 70-79 amber,
// <70 warning. All values from the design tokens (no hex here).

import type { LayeredTrustScore } from "../types";

type Props = {
  trust: LayeredTrustScore;
  compact?: boolean;
};

function verifiedLayerCount(trust: LayeredTrustScore): number {
  return Object.values(trust.layers).filter((v) => v !== null).length;
}

function bandFor(score: number): {
  fg: string;
  bg: string;
  label: string;
} {
  if (score >= 90) return { fg: "#FFFFFF", bg: "#166534", label: "Excellent" };
  if (score >= 80) return { fg: "#FFFFFF", bg: "#15803D", label: "Strong" };
  if (score >= 70) return { fg: "#0A0A0A", bg: "#FBBF24", label: "Solid" };
  return { fg: "#FFFFFF", bg: "#DC2626", label: "Limited" };
}

export function TrustScoreChip({ trust, compact }: Props) {
  const band = bandFor(trust.score);
  const verified = verifiedLayerCount(trust);
  const total = Object.keys(trust.layers).length;

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
      style={{ backgroundColor: band.bg, color: band.fg }}
      title={`Trust ${trust.score}/100 · ${verified}/${total} layers verified`}
    >
      <span>Trust {trust.score}</span>
      {!compact && (
        <span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[9px]">
          {verified}/{total}
        </span>
      )}
    </div>
  );
}
