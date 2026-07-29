"use client";
// MemoryMatchCard — surfaces the Materials Memory result and lets the
// owner choose: use existing · update existing · create new.

import { Brain, Check, Plus, Edit3, AlertCircle, SkipForward } from "lucide-react";
import { MT } from "../_tokens";
import type { MemoryMatch, NexAddStockDraft } from "@/apps/materials/_schema/memory_types";

export function MemoryMatchCard({
  memoryMatch, action, onActionChange, proposedName,
}: {
  memoryMatch: MemoryMatch;
  action: NexAddStockDraft["memory_action"] | null;
  onActionChange: (a: NexAddStockDraft["memory_action"]) => void;
  proposedName: string;
}) {
  const isNone   = memoryMatch.kind === "none";
  const isLowConfidenceFuzzy = memoryMatch.kind === "fuzzy" && memoryMatch.similarity < 0.65;

  return (
    <div
      className="px-4 py-4"
      style={{ background: MT.card, border: `1px solid ${MT.borderLight}`, borderRadius: MT.radiusLg, boxShadow: MT.shadowSoft }}
    >
      <div className="flex items-start gap-3">
        <Brain size={20} strokeWidth={2} style={{ color: MT.primary, flexShrink: 0, marginTop: 2 }} />
        <div className="min-w-0 flex-1">
          {isNone && (
            <>
              <div className="text-[14px] font-bold" style={{ color: MT.darkGrey }}>
                First time I&apos;ve seen &ldquo;{proposedName}&rdquo;
              </div>
              <p className="mt-1 text-[12.5px]" style={{ color: MT.secondaryGrey }}>
                I&apos;ll remember it so you don&apos;t have to explain it again.
              </p>
            </>
          )}
          {(memoryMatch.kind === "exact" || memoryMatch.kind === "synonym") && (
            <>
              <div className="flex items-center gap-2">
                <Check size={15} strokeWidth={2.25} style={{ color: MT.success }} />
                <div className="text-[14px] font-bold" style={{ color: MT.darkGrey }}>
                  I&apos;ve seen this before — <span style={{ color: MT.primary }}>{memoryMatch.row.name}</span>
                </div>
              </div>
              <p className="mt-1 text-[12.5px]" style={{ color: MT.secondaryGrey }}>
                Used {memoryMatch.row.usage_count} time{memoryMatch.row.usage_count === 1 ? "" : "s"}
                {memoryMatch.row.default_length_mm && memoryMatch.row.default_width_mm && memoryMatch.row.default_thickness_mm
                  ? ` · usually ${memoryMatch.row.default_length_mm} × ${memoryMatch.row.default_width_mm} × ${memoryMatch.row.default_thickness_mm} mm`
                  : " · no dimensions on file"}
                {memoryMatch.row.typical_grade ? ` · grade ${memoryMatch.row.typical_grade}` : ""}
              </p>
            </>
          )}
          {memoryMatch.kind === "fuzzy" && (
            <>
              <div className="text-[14px] font-bold" style={{ color: MT.darkGrey }}>
                This looks like <span style={{ color: MT.primary }}>{memoryMatch.row.name}</span>
                <span className="ml-2 text-[11px] font-semibold" style={{ color: MT.secondaryGrey }}>
                  ({Math.round(memoryMatch.similarity * 100)}% similar)
                </span>
              </div>
              <p className="mt-1 text-[12.5px]" style={{ color: MT.secondaryGrey }}>
                Same material? If not, I&apos;ll treat it as new.
              </p>
            </>
          )}
        </div>
      </div>

      {isLowConfidenceFuzzy && (
        <div
          className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold"
          style={{ background: "#FFF6E5", color: "#8A5A00", border: "1px solid #F1D9A8" }}
        >
          <AlertCircle size={14} strokeWidth={2.25} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Not sure enough — pick one so I don&apos;t assume anything.</span>
        </div>
      )}

      {/* Action selector */}
      <div className="mt-3 flex flex-wrap gap-2">
        {!isNone && (
          <ActionChip
            active={action === "use_existing"}
            icon={<Check size={13} strokeWidth={2.25} />}
            label="Use previous details"
            onClick={() => onActionChange("use_existing")}
          />
        )}
        {!isNone && (
          <ActionChip
            active={action === "update_existing"}
            icon={<Edit3 size={13} strokeWidth={2.25} />}
            label="Update the saved details"
            onClick={() => onActionChange("update_existing")}
          />
        )}
        <ActionChip
          active={action === "create_new"}
          icon={<Plus size={13} strokeWidth={2.5} />}
          label={isNone ? "Remember for next time" : "Save as new material"}
          onClick={() => onActionChange("create_new")}
        />
        <ActionChip
          active={action === "skip_memory"}
          icon={<SkipForward size={13} strokeWidth={2.25} />}
          label="One-off — don't remember"
          onClick={() => onActionChange("skip_memory")}
        />
      </div>
    </div>
  );
}

function ActionChip({
  active, icon, label, onClick,
}: {
  active: boolean; icon: React.ReactNode; label: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[11.5px] font-bold transition-transform active:scale-95"
      style={{
        background: active ? MT.primary : MT.bg,
        color:      active ? "#FFFFFF" : MT.darkGrey,
        border:     active ? `1px solid ${MT.primary}` : `1px solid ${MT.border}`,
      }}
    >
      {icon}
      {label}
    </button>
  );
}
