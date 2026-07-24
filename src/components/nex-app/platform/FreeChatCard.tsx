"use client";

// FreeChatCard — hero-adjacent CTA per platform mockup.
// Cream background (not orange gradient) with dark chat-bubble icon,
// orange "FREE CHAT" title, subtext, and a bold orange circle arrow
// button on the right. Tap opens Messenger immediately, zero AI call.

import { useRouter } from "next/navigation";
import { ArrowRight, MessageCircle } from "lucide-react";

export function FreeChatCard() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push("/nex-app/messages")}
      className="w-full rounded-2xl px-3 py-2 text-left transition-transform active:scale-[0.99]"
      style={{
        background: "var(--nex-cream-elev)",
        border: "1px solid var(--nex-neutral-200)",
        boxShadow: "var(--nex-shadow-sm)"
      }}
      aria-label="Open Free Chat — messaging with no AI required"
    >
      <div className="flex items-center gap-2.5">
        <span
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full"
          style={{ background: "var(--nex-neutral-900)", color: "var(--nex-accent-500)" }}
          aria-hidden
        >
          <MessageCircle size={17} strokeWidth={2} fill="var(--nex-accent-500)" />
        </span>
        <div className="flex-1 leading-tight">
          <div className="text-[12.5px] font-black tracking-tight"
               style={{ color: "var(--nex-accent-500)" }}>
            FREE CHAT
          </div>
          <div className="text-[10.5px]" style={{ color: "var(--nex-neutral-700)" }}>
            Chat with anyone, anytime
          </div>
        </div>
        <span
          className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full"
          style={{
            background: "linear-gradient(135deg, var(--nex-accent-500) 0%, var(--nex-accent-600) 100%)",
            color: "var(--nex-neutral-0)",
            boxShadow: "var(--nex-shadow-sm)"
          }}
          aria-hidden
        >
          <ArrowRight size={16} strokeWidth={2.5} />
        </span>
      </div>
    </button>
  );
}
