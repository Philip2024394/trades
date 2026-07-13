// Platform Copilot — right-panel AI client.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  The copilot renders on every workspace route.
//    Its interface with the AI Dispatcher is the platform contract.
//    Each App only contributes tools; the copilot UI is universal.
//
// 2. Which future Apps benefit?  Every App. The copilot dispatches
//    to the tools every App declares. Zero App-specific UI.
//
// 3. Which doc authorises?  ADR-052 + PLATFORM_ARCHITECTURE §7 "AI
//    Platform Service" + TRADE_CENTER_2_SPEC.md §21 workspace mode.

"use client";

import { useEffect, useState } from "react";
import { Send, Wand2, X, Wrench, ChevronDown } from "lucide-react";

type Message =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      route?: { model: string; taskClass: string; reason: string };
      toolCalls?: Array<{ id: string; toolName: string; args: unknown; result?: unknown; error?: string }>;
    };

export type CopilotProps = {
  /** Prompt seed — when set, copilot auto-opens and sends immediately. */
  seedPrompt?: string;
  /** Called when the copilot is dismissed. */
  onClose?: () => void;
  /** Called when a message roundtrip completes. */
  onDispatch?: (input: string) => void;
};

export function Copilot({ seedPrompt, onClose, onDispatch }: CopilotProps) {
  const [open, setOpen] = useState<boolean>(Boolean(seedPrompt));
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!seedPrompt) return;
    setOpen(true);
    void submit(seedPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedPrompt]);

  // Global keybind — ⌘\ opens / closes the panel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function submit(prompt: string) {
    if (!prompt.trim() || pending) return;
    setPending(true);
    setError(null);
    setMessages((m) => [...m, { role: "user", content: prompt }]);
    setDraft("");
    onDispatch?.(prompt);
    try {
      const res = await fetch("/api/ai/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, userTier: "professional" })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "unknown-error");
        return;
      }
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.text,
          route: data.route,
          toolCalls: data.toolCalls
        }
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  return (
    <aside
      className="fixed right-0 top-0 z-40 flex h-screen w-96 flex-col border-l bg-white shadow-2xl"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
      role="complementary"
      aria-label="Copilot"
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 border-b px-4 py-3"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: "#0A0A0A" }}
        >
          <Wand2 size={14} color="#FFB300"/>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-black text-neutral-900">Copilot</div>
          <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
            Powered by every registered App
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onClose?.();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
          aria-label="Close copilot"
        >
          <X size={14}/>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="rounded-lg border p-3 text-[12px] text-neutral-600" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
            Ask about products, merchants, orders, quotes — anything the
            registered Apps expose as a tool. Try:
            <ul className="mt-2 space-y-1 text-[11px] text-neutral-500">
              <li>· "Find alternatives to a 14 inch trowel"</li>
              <li>· "Compare the OX plastering hawk with the Marshalltown"</li>
              <li>· "How many bags of plaster for a 3m by 4m wall?"</li>
            </ul>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageRow key={i} message={m}/>
        ))}
        {pending && (
          <div className="mt-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-neutral-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400"/>
            Thinking…
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-lg bg-red-50 p-2 text-[11px] font-bold text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="border-t p-3"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(draft);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask the copilot…"
            className="flex-1 rounded-full border bg-white px-3 py-2 text-[13px] text-neutral-900 focus:outline-none"
            style={{ borderColor: "rgba(139,69,19,0.20)" }}
          />
          <button
            type="submit"
            disabled={!draft.trim() || pending}
            className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm disabled:opacity-50"
            style={{ backgroundColor: "#166534" }}
          >
            <Send size={11}/>
            Ask
          </button>
        </form>
      </div>
    </aside>
  );
}

function MessageRow({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="mt-3 flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-neutral-100 px-3 py-2 text-[12.5px] text-neutral-900">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3">
      <div
        className="rounded-2xl rounded-tl-sm border p-3 text-[12.5px] text-neutral-800"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.route && (
          <div className="mt-2 flex flex-wrap items-center gap-1 text-[9px] font-black uppercase tracking-wider text-neutral-500">
            <span className="rounded bg-neutral-100 px-1.5 py-0.5">{message.route.model}</span>
            <span>·</span>
            <span>{message.route.taskClass}</span>
            <span>·</span>
            <span className="text-neutral-400">{message.route.reason}</span>
          </div>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.toolCalls.map((tc) => (
              <div
                key={tc.id}
                className="flex items-start gap-1.5 rounded-md bg-neutral-50 p-2 text-[10.5px]"
              >
                <Wrench size={11} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
                <div className="min-w-0 flex-1">
                  <div className="font-black text-neutral-800">{tc.toolName}</div>
                  {tc.error ? (
                    <div className="mt-0.5 text-red-600">Error: {tc.error}</div>
                  ) : (
                    <div className="mt-0.5 truncate text-neutral-500">
                      Handler invoked ✓
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
