"use client";

// PlatformAskBar — global Ask NEX input on the platform landing.
// Routes user input through the Intent Router BEFORE anything hits
// the AI. Navigation / database / messenger intents resolve without
// LLM cost. Only actual questions reach the AI composer.

import { Search, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { classifyIntent } from "@/lib/nex/intent-router";

export function PlatformAskBar() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [routing, setRouting] = useState<string | null>(null);

  function submit() {
    const text = value.trim();
    if (!text) return;
    const intent = classifyIntent(text);
    setRouting(intent.reason);

    if (intent.kind === "navigation" && intent.target) {
      router.push(intent.target);
      return;
    }
    if (intent.kind === "messenger") {
      router.push("/nex-app/messages");
      return;
    }
    if (intent.kind === "brain" && intent.target) {
      // Route to the specific Brain (staircases → its route; general → general route)
      // and pass the question as a chat seed.
      const brainRoute = intent.target === "staircases" ? "staircase" : intent.target;
      router.push(`/nex-app/brains/${brainRoute}?q=${encodeURIComponent(text)}`);
      return;
    }
    if (intent.kind === "database" && intent.target) {
      // Database routes not yet built — bounce to a placeholder for now
      router.push(`/nex-app/data/${intent.target}`);
      return;
    }
    // AI fallback — router already promotes this to the General Brain
    // when General is live. This branch only fires if no Brains at all
    // are registered (should not happen in a normal deployment).
    router.push(`/nex-app/brains/general?q=${encodeURIComponent(text)}`);
    setValue("");
  }

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-full pl-3.5 pr-1 py-1"
        style={{
          background: "var(--nex-neutral-0)",
          boxShadow: "var(--nex-shadow-sm)",
          border: "1px solid var(--nex-neutral-200)"
        }}
      >
        <Search size={16} strokeWidth={1.75} style={{ color: "var(--nex-neutral-400)" }} />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder="Ask anything or search..."
          aria-label="Ask NEX"
          className="flex-1 bg-transparent py-1.5 text-[13px] outline-none placeholder:text-[color:var(--nex-neutral-400)]"
          style={{ color: "var(--nex-neutral-900)" }}
        />
        <button
          type="button"
          onClick={submit}
          aria-label="Ask NEX"
          className="grid h-7 w-10 place-items-center rounded-full transition-transform active:scale-95"
          style={{
            background: "linear-gradient(135deg, var(--nex-accent-500), var(--nex-accent-700))",
            color: "var(--nex-neutral-0)"
          }}
        >
          <SlidersHorizontal size={14} strokeWidth={2.25} />
        </button>
      </div>
      {routing && (
        <div className="mt-1 pl-4 text-[10px]" style={{ color: "var(--nex-neutral-400)" }}>
          Routing: {routing}
        </div>
      )}
    </div>
  );
}
