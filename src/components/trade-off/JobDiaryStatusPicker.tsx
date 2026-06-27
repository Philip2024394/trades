"use client";

// Editor — 8-chip status picker. Used in the "post update" modal.
// Renders as a horizontally-scrollable row on mobile so all eight chips
// stay tap-accessible at 375px without breaking the layout.

import { STATUS_KEYS, STATUS_LABELS, type StatusChipKey } from "@/components/xrated/profile/StatusChip";

export function JobDiaryStatusPicker({
  value,
  onChange
}: {
  value: StatusChipKey | null;
  onChange: (next: StatusChipKey) => void;
}) {
  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2">
      {STATUS_KEYS.map((k) => {
        const entry = STATUS_LABELS[k];
        const selected = value === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className="inline-flex h-11 shrink-0 snap-start items-center gap-1.5 rounded-full border-2 px-3 text-[13px] font-extrabold transition active:scale-[0.97]"
            style={{
              borderColor: selected ? entry.text : "rgba(0,0,0,0.1)",
              background: selected ? entry.bg : "#FFFFFF",
              color: selected ? entry.text : "#404040"
            }}
            aria-pressed={selected}
          >
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: entry.dot }}
            />
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}
