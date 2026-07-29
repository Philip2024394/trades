// Stock summary list — species roll-up from stockSummaryForOwner.
// Read-only presentation. Editing lives in the admin surface.

import { MT } from "../_tokens";
import type { StockSummaryRow } from "@/apps/materials/_schema/types";

export function StockList({ rows }: { rows: StockSummaryRow[] }) {
  return (
    <div
      className="overflow-hidden"
      style={{
        background: MT.card,
        border: `1px solid ${MT.borderLight}`,
        borderRadius: MT.radiusLg,
        boxShadow: MT.shadowSoft,
      }}
    >
      <div
        className="grid grid-cols-[minmax(0,1.5fr)_repeat(5,minmax(0,1fr))] gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-wider"
        style={{ color: MT.secondaryGrey, borderBottom: `1px solid ${MT.borderLight}` }}
      >
        <div>Species</div>
        <div className="text-right">Packs</div>
        <div className="text-right">Boards</div>
        <div className="text-right">Measured</div>
        <div className="text-right">Allocated</div>
        <div className="text-right">Volume (m³)</div>
      </div>
      {rows.map((r) => (
        <div
          key={r.species_id}
          className="grid grid-cols-[minmax(0,1.5fr)_repeat(5,minmax(0,1fr))] items-center gap-2 px-4 py-3 text-[13px]"
          style={{ borderBottom: `1px solid ${MT.borderLight}`, color: MT.darkGrey }}
        >
          <div className="truncate font-semibold">{r.species_display_name}</div>
          <div className="text-right tabular-nums">{r.pack_count}</div>
          <div className="text-right tabular-nums">{r.board_count}</div>
          <div className="text-right tabular-nums">{r.measured_board_count}</div>
          <div className="text-right tabular-nums">{r.allocated_count}</div>
          <div className="text-right font-bold tabular-nums" style={{ color: MT.primary }}>{r.total_volume_m3.toFixed(3)}</div>
        </div>
      ))}
    </div>
  );
}
