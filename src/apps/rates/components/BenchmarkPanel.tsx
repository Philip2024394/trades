// Regional benchmark — shows where the trade's own rates sit against
// the anonymised P25 / median / P75 bands from other rate cards in the
// same discipline + region.
//
// Constitution Rule #6: Trade Center NEVER says "you should charge X."
// This panel only reflects what other trades already published. It's a
// mirror, not an advisor. The disclaimer at the bottom makes this
// explicit.

import { TrendingUp, Info } from "lucide-react";
import { UNIT_LABEL, type RateCard, type RegionalBenchmark } from "../data/rateCards";

type Props = {
  card: RateCard;
  benchmark: RegionalBenchmark;
};

type Position = "below" | "middle" | "above" | "no-benchmark";

function positionFor(rate: number, p25: number, p75: number): Position {
  if (rate < p25) return "below";
  if (rate > p75) return "above";
  return "middle";
}

function positionLabel(pos: Position): string {
  switch (pos) {
    case "below":         return "Below P25";
    case "middle":        return "In the middle band";
    case "above":         return "Above P75";
    case "no-benchmark":  return "No benchmark yet";
  }
}

function positionColour(pos: Position): { bg: string; fg: string } {
  switch (pos) {
    case "below":         return { bg: "#DBEAFE", fg: "#1E40AF" };
    case "middle":        return { bg: "#DCFCE7", fg: "#166534" };
    case "above":         return { bg: "#FEF3C7", fg: "#B45309" };
    case "no-benchmark":  return { bg: "#F5F0E4", fg: "#525252" };
  }
}

export function BenchmarkPanel({ card, benchmark }: Props) {
  return (
    <section
      className="rounded-2xl border p-5 shadow-sm"
      style={{
        borderColor: "rgba(139,69,19,0.15)",
        backgroundColor: "#FFFDF8"
      }}
    >
      <header className="flex items-center gap-2">
        <TrendingUp size={14} className="text-amber-700"/>
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">
          Where you sit vs {benchmark.discipline.toLowerCase()} in {benchmark.region}
        </div>
      </header>
      <p className="mt-1 text-[11.5px] leading-snug text-neutral-600">
        Anonymised bands from {benchmark.totalContributors} rate cards published by trades in
        your region. Updated {new Date(benchmark.updatedAtIso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.
      </p>

      <ul className="mt-4 flex flex-col gap-4">
        {benchmark.perItem.map((band) => {
          // Match this band to the trade's own item (loose label match)
          const yourItem = card.items.find(
            (i) => i.label.toLowerCase() === band.label.toLowerCase() && i.unit === band.unit
          );
          const pos: Position = yourItem
            ? positionFor(yourItem.rateGbp, band.p25, band.p75)
            : "no-benchmark";
          const col = positionColour(pos);
          return (
            <li key={band.label + band.unit}>
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[12.5px] font-black text-neutral-900">
                  {band.label}
                </div>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                  style={{ backgroundColor: col.bg, color: col.fg }}
                >
                  {yourItem
                    ? positionLabel(pos)
                    : "You haven't published this"}
                </span>
              </div>

              {/* Band bar */}
              <div className="mt-2">
                <BandBar
                  p25={band.p25}
                  median={band.median}
                  p75={band.p75}
                  yourRate={yourItem?.rateGbp}
                />
                <div className="mt-1 flex items-baseline justify-between text-[10px] text-neutral-500">
                  <span>P25 · £{band.p25}</span>
                  <span>Median · £{band.median}</span>
                  <span>P75 · £{band.p75}</span>
                </div>
              </div>

              {yourItem && (
                <div className="mt-1 text-[10.5px] text-neutral-600">
                  You publish <strong>£{yourItem.rateGbp}</strong> {UNIT_LABEL[yourItem.unit]}
                  {" "}from {band.sampleSize} peers.
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Constitution disclaimer */}
      <div className="mt-4 flex items-start gap-2 rounded-md bg-white p-3" style={{ border: "1px solid rgba(139,69,19,0.15)" }}>
        <Info size={13} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
        <p className="text-[10.5px] leading-snug text-neutral-600">
          Every band is anonymised, aggregated across at least {Math.min(...benchmark.perItem.map((b) => b.sampleSize))} peer rate cards.
          Trade Center never recommends a rate — this panel only reflects what other trades in your area
          published themselves. Set higher, set lower, or stay put — your call.
        </p>
      </div>
    </section>
  );
}

function BandBar({
  p25,
  median,
  p75,
  yourRate
}: {
  p25: number;
  median: number;
  p75: number;
  yourRate?: number;
}) {
  // Scale: give the bar a bit of headroom either side of the P25-P75
  // range so the marker sits comfortably even for outlier rates.
  const min = Math.min(p25, yourRate ?? p25) - Math.max(4, p25 * 0.15);
  const max = Math.max(p75, yourRate ?? p75) + Math.max(4, p75 * 0.15);
  const span = max - min;
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / span) * 100));

  return (
    <div className="relative h-3 overflow-hidden rounded-full" style={{ backgroundColor: "#F5F0E4" }}>
      {/* Middle band (P25-P75) */}
      <div
        className="absolute top-0 h-full"
        style={{
          left: `${pct(p25)}%`,
          width: `${pct(p75) - pct(p25)}%`,
          backgroundColor: "#DCFCE7"
        }}
      />
      {/* Median tick */}
      <div
        className="absolute top-0 h-full w-0.5"
        style={{
          left: `${pct(median)}%`,
          backgroundColor: "#166534"
        }}
        aria-hidden
      />
      {/* Your marker */}
      {yourRate !== undefined && (
        <div
          className="absolute -top-0.5 flex h-4 items-center justify-center"
          style={{
            left: `calc(${pct(yourRate)}% - 8px)`,
            width: 16
          }}
          aria-label={`Your rate £${yourRate}`}
        >
          <span
            className="h-4 w-4 rounded-full border-2 border-white shadow-md"
            style={{ backgroundColor: "#0A0A0A" }}
          />
        </div>
      )}
    </div>
  );
}
