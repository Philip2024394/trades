// TradeDispatchBadge — trades-themed adaptation of Hammerex's
// DispatchCountdown.
//
// Semantic drift on purpose: hammer's DispatchCountdown ticks against a
// daily HH:MM cutoff ("Order in 03:24:11 for dispatch today"). Trades
// schema (hammerex_xrated_products.dispatch_days) stores a plain
// integer — how many business days it takes to ship — with no cutoff
// time to countdown to. Rather than fabricate one, this component
// renders the same pill *visual* the countdown uses but with static
// copy that matches what the schema actually knows:
//
//   • 0        → "Ships same day"
//   • 1        → "Ships next business day"
//   • N ≥ 2    → "Ships in N business days"
//   • null     → renders nothing
//
// If a future migration adds `dispatch_cutoff_utc` to the listing (so
// every trade declares their daily cutoff), this component can grow
// into a live countdown that matches Hammerex 1:1. For now the trades
// schema doesn't lie about what it stores.

export function TradeDispatchBadge({
  dispatchDays
}: {
  dispatchDays: number | null | undefined;
}) {
  if (dispatchDays === null || dispatchDays === undefined) return null;
  const days = Math.max(0, Math.floor(dispatchDays));

  const copy =
    days === 0
      ? "Ships same day"
      : days === 1
        ? "Ships next business day"
        : `Ships in ${days} business days`;

  const urgent = days <= 1;

  return (
    <div
      role="status"
      className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border px-3 py-1.5 text-[12px] font-black ${
        urgent
          ? "border-amber-400 bg-amber-100 text-amber-800"
          : "border-[#1B1A17]/10 bg-white text-[#1B1A17]/70"
      }`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M2 7h13l4 4v6h-2" />
        <path d="M14 17H8" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </svg>
      <span>{copy}</span>
    </div>
  );
}
