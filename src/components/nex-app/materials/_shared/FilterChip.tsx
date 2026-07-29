// FilterChip — small dismissible chip used when filters are active.

"use client";

import { X } from "lucide-react";
import { MT } from "../_tokens";

export function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove?: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full py-1 pl-3 pr-2 text-[12px] font-semibold"
      style={{
        background: MT.primarySoft,
        color: MT.primary,
        border: `1px solid ${MT.primaryBorder}`,
      }}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label} filter`}
          className="grid h-4 w-4 place-items-center rounded-full transition-transform active:scale-90"
          style={{ background: "rgba(184,90,12,0.15)" }}
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      )}
    </span>
  );
}
