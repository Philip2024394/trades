// Xrated Trades — live pulse marquee.
// Thin orange-tinted strip running right-to-left, fed by the latest jobs +
// tradies. Server component. CSS-only animation, pauses on hover via the
// `:hover` rule inside the style block. ~30s loop for a calm cadence.

import type {
  HammerexTradeOffListing,
  HammerexXratedJob
} from "@/lib/supabase";
import { tradeLabel } from "@/lib/tradeOff";
import { XRATED_BRAND } from "@/lib/xratedTrades";

type Props = {
  jobs: HammerexXratedJob[];
  tradies: HammerexTradeOffListing[];
};

function buildItems(jobs: HammerexXratedJob[], tradies: HammerexTradeOffListing[]): string[] {
  const out: string[] = [];

  jobs.slice(0, 5).forEach((j) => {
    const label = tradeLabel(j.trade_slug);
    out.push(`New job: ${label} in ${j.city}`);
  });

  tradies
    .filter((t) => t.hammerex_standard_verified)
    .slice(0, 4)
    .forEach((t) => {
      out.push(`${t.display_name} verified Hammerex Standard`);
    });

  tradies.slice(0, 5).forEach((t) => {
    out.push(`New tradie: ${t.display_name} in ${t.city}`);
  });

  // Fallback if DB is empty so the strip never collapses.
  if (out.length === 0) {
    out.push(
      "New tradies joining weekly",
      "Free for life — list your trade",
      "WhatsApp direct, no middleman"
    );
  }
  return out;
}

export function LivePulseTicker({ jobs, tradies }: Props) {
  const items = buildItems(jobs, tradies);
  const content = items.map((i) => `${i}`).join("   ·   ");
  const stream = `${content}   ·   ${content}`;

  return (
    <section
      className="relative overflow-hidden border-y border-[#FFB300]/30"
      style={{ background: `${XRATED_BRAND.accent}14` }}
      aria-label="Live activity ticker"
    >
      <div className="xrated-pulse-marquee flex whitespace-nowrap py-2.5 text-xs font-semibold text-white">
        <span className="inline-flex shrink-0 items-center px-4">
          {items.concat(items).map((item, idx) => (
            <span key={idx} className="inline-flex items-center">
              <span
                aria-hidden="true"
                className="mr-2 inline-block h-2 w-2 rounded-full"
                style={{ background: "#22c55e", boxShadow: "0 0 8px #22c55e" }}
              />
              <span className="mr-6">{item}</span>
            </span>
          ))}
        </span>
        <span
          aria-hidden="true"
          className="inline-flex shrink-0 items-center px-4"
        >
          {items.concat(items).map((item, idx) => (
            <span key={`b-${idx}`} className="inline-flex items-center">
              <span
                aria-hidden="true"
                className="mr-2 inline-block h-2 w-2 rounded-full"
                style={{ background: "#22c55e", boxShadow: "0 0 8px #22c55e" }}
              />
              <span className="mr-6">{item}</span>
            </span>
          ))}
        </span>
      </div>
      <span className="sr-only">{stream}</span>
      <style>{`
        .xrated-pulse-marquee {
          animation: xrated-pulse-marquee 32s linear infinite;
          will-change: transform;
        }
        .xrated-pulse-marquee:hover {
          animation-play-state: paused;
        }
        @keyframes xrated-pulse-marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}

export default LivePulseTicker;
