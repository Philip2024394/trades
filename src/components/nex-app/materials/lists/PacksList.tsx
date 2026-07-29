// Read-only pack list — placeholder for the Phase 3 pack-management UI.
// Renders whatever the existing listPacks service returns.

import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import { MT } from "../_tokens";
import type { HardwoodPackRow } from "@/apps/materials/_schema/types";

export function PacksList({ packs }: { packs: HardwoodPackRow[] }) {
  return (
    <ul
      className="divide-y overflow-hidden"
      style={{
        background: MT.card,
        borderRadius: MT.radiusLg,
        border: `1px solid ${MT.borderLight}`,
        boxShadow: MT.shadowSoft,
      }}
    >
      {packs.map((p) => (
        <li key={p.id}>
          <Link
            href={`/nex-app/materials/packs/${p.id}`}
            className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-black/[0.015]"
          >
            <span
              aria-hidden
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
              style={{ background: MT.primarySoft, color: MT.primary, border: `1px solid ${MT.primaryBorder}` }}
            >
              <Package size={18} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold" style={{ color: MT.darkGrey }}>{p.pack_ref}</div>
              <div className="text-[12px]" style={{ color: MT.secondaryGrey }}>
                {p.species_id.replaceAll("_", " ")} · {p.grade ?? "no grade"} · {p.status}
              </div>
            </div>
            <ChevronRight size={18} strokeWidth={2} style={{ color: MT.primary }} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
