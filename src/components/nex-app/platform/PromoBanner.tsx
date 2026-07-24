"use client";

// PromoBanner — "Do more with NEX AI" upsell strip per canonical
// mockup. Cream tinted card with sparkles icon, title + subtitle, and
// orange CTA button. Non-interruptive — lives in the scroll not as a
// modal per Design Language rules.

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

export function PromoBanner() {
  const router = useRouter();
  return (
    <section className="mt-3 px-5">
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{
          background: "linear-gradient(135deg, var(--nex-accent-50) 0%, var(--nex-cream-elev) 100%)",
          border: "1px solid var(--nex-accent-100)"
        }}
      >
        <span
          className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full"
          style={{ background: "rgba(249, 115, 22, 0.14)", color: "var(--nex-accent-500)" }}
          aria-hidden
        >
          <Sparkles size={18} strokeWidth={2} />
        </span>
        <div className="flex-1">
          <div className="text-[13px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>
            Do more with NEX AI
          </div>
          <div className="mt-0.5 text-[11px] leading-tight" style={{ color: "var(--nex-neutral-600)" }}>
            Smart tools to save time, boost productivity and grow faster.
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push("/nex-app/brains/staircase")}
          className="flex-shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-black transition-transform active:scale-95"
          style={{
            background: "linear-gradient(135deg, var(--nex-accent-500) 0%, var(--nex-accent-600) 100%)",
            color: "var(--nex-neutral-0)",
            boxShadow: "var(--nex-shadow-sm)"
          }}
        >
          Try NEX AI →
        </button>
      </div>
    </section>
  );
}
