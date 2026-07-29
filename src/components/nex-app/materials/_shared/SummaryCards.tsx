// SummaryCards — horizontally scrollable metric row for the pack
// header. Snap-scrolling on mobile, ≥48px touch targets, no scrollbar
// visible (thin drag indicator underneath).

import type { ReactNode } from "react";
import { Layers, Package, TreeDeciduous, Lock, Percent } from "lucide-react";
import { MT } from "../_tokens";

export type SummaryMetric = {
  key: string;
  icon: "boards" | "volume" | "available" | "reserved" | "measured_pct";
  value: string;
  label: string;
};

const ICONS = {
  boards:       { Icon: Layers,        color: MT.primary },
  volume:       { Icon: Package,       color: MT.primary },
  available:    { Icon: TreeDeciduous, color: MT.success },
  reserved:     { Icon: Lock,          color: MT.primary },
  measured_pct: { Icon: Percent,       color: MT.primary },
} as const;

export function SummaryCards({ metrics }: { metrics: SummaryMetric[] }) {
  return (
    <div className="relative">
      <div
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto"
        style={{ scrollPaddingInline: 16, paddingInline: 16, paddingBlock: 4 }}
      >
        {metrics.map((m) => {
          const cfg = ICONS[m.icon];
          const Icon = cfg.Icon;
          return (
            <MetricCard key={m.key} icon={<Icon size={22} strokeWidth={1.85} style={{ color: cfg.color }} />} value={m.value} label={m.label} />
          );
        })}
      </div>
      {/* Bottom drag indicator strip */}
      <div className="mt-1 flex justify-center">
        <span aria-hidden style={{ width: 32, height: 4, background: MT.border, borderRadius: 2 }} />
      </div>
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

function MetricCard({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div
      className="flex shrink-0 snap-start flex-col items-start justify-center"
      style={{
        background: MT.card,
        border: `1px solid ${MT.borderLight}`,
        borderRadius: MT.radiusMd,
        boxShadow: MT.shadowSoft,
        minWidth: 140,
        padding: "14px 16px",
      }}
    >
      <div className="mb-1.5">{icon}</div>
      <div className="text-[20px] font-extrabold leading-none tracking-tight" style={{ color: MT.darkGrey }}>{value}</div>
      <div className="mt-1 text-[11.5px] font-semibold" style={{ color: MT.secondaryGrey }}>{label}</div>
    </div>
  );
}
