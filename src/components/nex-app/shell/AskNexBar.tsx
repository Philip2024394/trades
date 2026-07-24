"use client";

// AskNexBar — the primary input on the canvas Discover surface (per
// Design Language v1.1 §6.6). Looks like a search bar, functions as a
// conversation starter. Typing focus opens the chat panel; first
// keystroke becomes the first message.

import { Search, SlidersHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import { useConversationState } from "../state/ConversationStateProvider";

export function AskNexBar({ noOuterMargin = false }: { noOuterMargin?: boolean } = {}) {
  const { config, sendUserMessage, openChat } = useConversationState();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const text = value.trim();
    if (!text) return;
    setValue("");
    await sendUserMessage(text);
  }

  const placeholder =
    config.trade_slug === "staircase"
      ? "Search staircases, styles, materials..."
      : `Ask NEX about ${config.trade_slug}...`;

  return (
    <div
      className={`${noOuterMargin ? "" : "mx-5"} flex items-center gap-2 rounded-full pl-3.5 pr-1 py-1`}
      style={{
        background: "var(--nex-neutral-0)",
        boxShadow: "var(--nex-shadow-sm)",
        border: "1px solid var(--nex-neutral-200)"
      }}
    >
      <Search size={16} strokeWidth={1.75} style={{ color: "var(--nex-neutral-400)" }} />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={openChat}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        placeholder={placeholder}
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
  );
}
