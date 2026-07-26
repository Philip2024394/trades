"use client";

// NEX Merchant Assistant — chat UI (Phase 7 · Increment 2).
//
// Basic read-only chat surface: message stream + input. Writes land in
// Increment 3 when the write tool executors ship. For now the merchant
// can ask NEX to list their products, preview drafts, and converse —
// no product changes possible yet.
//
// Kept intentionally minimal — layout / theming polish arrives in
// Increment 7. This file's job is to prove the round-trip works.
//
// Reference: docs/brains/PHASE_7_IMPLEMENTATION_PLAN.md · Section 8

import { useCallback, useEffect, useRef, useState } from "react";
import { DraftPreviewCard, type Draft } from "./DraftPreviewCard";
import { BannerPreview } from "./BannerPreview";
import type {
  BannerVisualStyle,
  MerchantAssistantBanner,
} from "@/lib/nex/merchant-assistant/types";

type Role = "user" | "assistant";

type ChatMessage = {
  role: Role;
  text: string;
  /** When the assistant reply created a draft, the card renders inline. */
  draft?: Draft | null;
  /** When the assistant reply generated a banner, the preview renders inline. */
  banner?: MerchantAssistantBanner | null;
};

type ToolCall = {
  tool: string;
  input: Record<string, unknown>;
  result: unknown;
};

type ApiResponse = {
  ok: boolean;
  thread_id?: string;
  response?: string;
  tool_calls?: ToolCall[];
  draft?: Draft | null;
  banner?: MerchantAssistantBanner | null;
  usage?: { input_tokens: number; output_tokens: number; iterations: number };
  error?: string;
};

export function MerchantAssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [lastToolCalls, setLastToolCalls] = useState<ToolCall[]>([]);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, pending]);

  const send = useCallback(async () => {
    const message = input.trim();
    if (!message || pending) return;

    setInput("");
    setErrorBanner(null);
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setPending(true);

    // Build the history in the shape the endpoint expects
    const history = messages.map((m) => ({
      role: m.role,
      content: m.text,
    }));

    try {
      const res = await fetch("/api/nex/merchant-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, thread_id: threadId }),
      });
      const data = (await res.json()) as ApiResponse;
      if (data.thread_id) setThreadId(data.thread_id);

      if (!res.ok || !data.ok) {
        const msg =
          data.error === "not_authenticated"
            ? "You need to sign in as a merchant to use NEX."
            : data.error === "rate_limited"
            ? "Please slow down — you've hit the rate limit (60 requests / 5 min)."
            : data.error === "anthropic_unavailable"
            ? "NEX is temporarily unavailable. Please try again in a moment."
            : "Something went wrong. Try again.";
        setErrorBanner(msg);
        setPending(false);
        return;
      }

      setLastToolCalls(data.tool_calls ?? []);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.response ?? "(no response)",
          draft: data.draft ?? null,
          banner: data.banner ?? null,
        },
      ]);
    } catch {
      setErrorBanner("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }, [input, messages, pending]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="flex h-[calc(100vh-72px)] flex-col bg-[#faf7f2]">
      {/* Header */}
      <div className="border-b border-black/10 bg-white px-4 py-3">
        <div className="text-sm font-semibold text-black">NEX Merchant Assistant</div>
        <div className="text-xs text-black/60">
          Phase 7 · Increment 2 — read-only preview (list + preview only)
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="mx-auto max-w-lg rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/70">
            <div className="font-medium text-black">Try asking:</div>
            <ul className="mt-2 space-y-1">
              <li>· "List my products"</li>
              <li>· "Show me products in draft state"</li>
              <li>· "Preview product [id]"</li>
            </ul>
            <div className="mt-3 text-xs text-black/50">
              Product create / update / publish will unlock in the next increment.
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="mb-3">
            <div
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-black text-white"
                    : "bg-white text-black shadow-sm"
                }`}
              >
                {m.text}
              </div>
            </div>
            {m.role === "assistant" && m.draft && (
              <div className="mt-2 flex justify-start">
                <DraftPreviewCard
                  draft={m.draft}
                  onEditRequested={() =>
                    setInput(
                      `NEX please update the ${m.draft?.name} listing —`
                    )
                  }
                />
              </div>
            )}
            {m.role === "assistant" && m.banner && (
              <div className="mt-2 flex justify-start">
                <BannerPreview
                  banner={m.banner}
                  onRegenerateRequested={(nextStyle) =>
                    setInput(
                      `NEX please rework this banner in a more ${nextStyle} style`
                    )
                  }
                />
              </div>
            )}
          </div>
        ))}
        {pending && (
          <div className="mb-3 flex justify-start">
            <div className="rounded-2xl bg-white px-4 py-2 text-sm text-black/50 shadow-sm">
              …
            </div>
          </div>
        )}
      </div>

      {/* Tool audit strip (dev-only visibility) */}
      {lastToolCalls.length > 0 && (
        <div className="border-t border-black/10 bg-white/60 px-4 py-2 text-[10px] text-black/50">
          Last tools:{" "}
          {lastToolCalls
            .map((c) => `${c.tool}${(c.result as { ok?: boolean }).ok ? " ✓" : " ✗"}`)
            .join(" · ")}
        </div>
      )}

      {/* Error */}
      {errorBanner && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {errorBanner}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-black/10 bg-white px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 resize-none rounded-2xl border border-black/15 bg-white px-3 py-2 text-sm focus:border-black/40 focus:outline-none"
            placeholder="Ask NEX about your products…"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={pending}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={pending || !input.trim()}
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:bg-black/30"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
