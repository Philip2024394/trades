"use client";

// Xrated Trades — circular trade-icon chip row.
// One row, scrolls horizontally on mobile. First chip is "All trades"
// (filled yellow when active); the rest are black circles with white
// icons that fill yellow when selected. Each chip is a link — All
// goes to /trade-off, each trade goes to /trade-off/<slug>. Selected
// state is derived from the URL pathname so the row reads correctly
// on both the landing and per-trade filter pages.

import { usePathname } from "next/navigation";
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { tradeIconFor } from "./tradeIcons";

export function TradeIconChips() {
  const pathname = usePathname() ?? "";
  const tradeMatch = pathname.match(/^\/trade-off\/([^/]+)$/);
  const activeSlug = tradeMatch?.[1] ?? null;

  return (
    <section
      aria-label="Pick a trade"
      className="mx-auto mt-4 max-w-6xl sm:mt-5"
    >
      <ul
        className="flex gap-2 overflow-x-auto px-3 pb-1 pr-8 sm:gap-3 sm:px-4 sm:pr-10 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          // Soft fade on the right edge so the last visible chip never
          // looks 'sliced' against the viewport — signals scrollable.
          maskImage:
            "linear-gradient(to right, #000 0, #000 calc(100% - 28px), transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, #000 0, #000 calc(100% - 28px), transparent 100%)"
        }}
      >
        <li key="all" className="shrink-0">
          <Chip
            href="/trade-off"
            label="All trades"
            iconSlug="all"
            active={activeSlug === null}
          />
        </li>
        {TRADE_OFF_TRADES.map((t) => (
          <li key={t.slug} className="shrink-0">
            <Chip
              href={`/trade-off/${t.slug}`}
              label={t.label}
              iconSlug={t.slug}
              active={activeSlug === t.slug}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Chip({
  href,
  label,
  iconSlug,
  active
}: {
  href: string;
  label: string;
  iconSlug: string;
  active: boolean;
}) {
  const Icon = tradeIconFor(iconSlug);
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      className="flex w-16 flex-col items-center gap-1.5 transition active:scale-[0.95]"
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full border"
        style={
          active
            ? {
                background: XRATED_BRAND.accent,
                color: "#1a1a1a",
                borderColor: XRATED_BRAND.accent
              }
            : {
                background: "#FFFFFF",
                color: "#1a1a1a",
                borderColor: "#E5E7EB"
              }
        }
      >
        <Icon />
      </span>
      <span
        className="block w-full truncate text-center text-[11px] font-semibold leading-tight"
        style={{ color: active ? XRATED_BRAND.accent : "#1a1a1a" }}
      >
        {label}
      </span>
    </a>
  );
}
