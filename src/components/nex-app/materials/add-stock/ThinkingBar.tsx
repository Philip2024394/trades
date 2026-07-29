"use client";
// ThinkingBar — soft animated status shown while NEX is working.

import { Sparkles } from "lucide-react";
import { MT } from "../_tokens";

export function ThinkingBar({ label }: { label: string }) {
  return (
    <div
      className="mt-6 flex items-center gap-3 px-5 py-4"
      style={{
        background: MT.card,
        border: `1px solid ${MT.borderLight}`,
        borderRadius: MT.radiusLg,
        boxShadow: MT.shadowSoft,
      }}
      aria-live="polite"
    >
      <span
        className="grid h-9 w-9 place-items-center rounded-full"
        style={{ background: MT.primarySoft, color: MT.primary, border: `1px solid ${MT.primaryBorder}` }}
      >
        <Sparkles size={16} strokeWidth={2.1} style={{ animation: "nex-thinking-spin 1.6s linear infinite" }} />
      </span>
      <span className="text-[14px] font-semibold" style={{ color: MT.darkGrey }}>{label}</span>
      <div className="ml-auto flex items-center gap-1">
        <Dot i={0} />
        <Dot i={1} />
        <Dot i={2} />
      </div>
      <style jsx global>{`
        @keyframes nex-thinking-spin {
          from { transform: rotate(0deg);   opacity: 0.85; }
          50%  {                            opacity: 1;    }
          to   { transform: rotate(360deg); opacity: 0.85; }
        }
        @keyframes nex-dot-pulse {
          0%, 60%, 100% { transform: scale(0.7); opacity: 0.4; }
          30%           { transform: scale(1.2); opacity: 1;   }
        }
      `}</style>
    </div>
  );
}

function Dot({ i }: { i: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 6, height: 6, borderRadius: 3,
        background: MT.primary,
        animation: `nex-dot-pulse 1200ms ease-in-out infinite`,
        animationDelay: `${i * 200}ms`,
      }}
    />
  );
}
