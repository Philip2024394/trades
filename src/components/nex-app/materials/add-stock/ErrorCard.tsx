"use client";
// ErrorCard — soft error state with retry.

import { AlertCircle, RefreshCcw } from "lucide-react";
import { MT } from "../_tokens";

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="mt-4 flex items-start gap-3 px-4 py-4"
      style={{ background: "#FBE3E3", border: "1px solid #F5C6C6", borderRadius: MT.radiusLg }}
    >
      <AlertCircle size={20} strokeWidth={2} style={{ color: "#B91C1C", flexShrink: 0, marginTop: 1 }} />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-bold" style={{ color: "#7F1414" }}>Something went wrong</div>
        <p className="mt-1 text-[12.5px]" style={{ color: "#7F1414" }}>{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-bold text-white transition-transform active:scale-95"
            style={{ background: "#B91C1C" }}
          >
            <RefreshCcw size={14} strokeWidth={2.25} />
            Start over
          </button>
        )}
      </div>
    </div>
  );
}
