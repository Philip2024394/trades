"use client";

// AskSiteBookButton — floating yellow button, bottom-right of every
// SiteBook page. Opens a sheet with a plain-English ask/reply UI.
//
// Rules:
//   1 · One question: "Ask a question about my house / project"
//   2 · Replaces guessing / searching / remembering
//   3 · No thread management surface, no "manage tools" panel —
//       just input + reply + one action button
//
// UX flow:
//   1. Homeowner taps the yellow ● pill in the bottom-right corner
//   2. Sheet slides up (mobile) or opens as a right-anchored panel
//      (desktop). Auto-focuses the input.
//   3. Types a question, hits Enter or Send.
//   4. Reply lands with a suggested action pill (e.g. "Open Home Care →").
//   5. Homeowner can ask another question OR tap the action to jump.
//
// No thread history in v1 — the sheet resets on close. When Pro tier
// AI is wired in Phase 2 we'll add persistent threads.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Send, X, MessageCircle } from "lucide-react";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

type Reply = {
  question: string;
  answer:   string;
  action?:  { label: string; href: string };
};

const SUGGESTED = [
  "When is my boiler service due?",
  "How much have I spent on the kitchen?",
  "Find me a local plumber",
  "How does the warranty vault work?"
];

export function AskSiteBookButton() {
  const [open,    setOpen]    = useState(false);
  const [q,       setQ]       = useState<string>("");
  const [busy,    setBusy]    = useState(false);
  const [reply,   setReply]   = useState<Reply | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const inputRef              = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    // Autofocus on open — a bit delayed for the transition
    setTimeout(() => inputRef.current?.focus(), 60);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const res  = await fetch("/api/homeowner/ai/ask", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ question })
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setError(prettyError(data.error));
        setBusy(false);
        return;
      }
      setReply({ question, answer: data.answer, action: data.action });
      setQ("");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await ask(q);
  }

  return (
    <>
      {/* Floating pill — bottom-right, above sticky footers (z-45) */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto fixed bottom-6 right-4 z-[45] inline-flex h-14 items-center gap-2 rounded-full pl-3.5 pr-5 text-neutral-900 shadow-2xl transition hover:brightness-95 sm:right-6"
          style={{ backgroundColor: BRAND_YELLOW, boxShadow: `0 12px 32px -8px ${BRAND_YELLOW}77, 0 4px 12px rgba(0,0,0,0.15)` }}
          aria-label="Ask SiteBook"
        >
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-900"
            style={{ backgroundColor: "rgba(255,255,255,0.4)" }}
          >
            <Sparkles size={16} strokeWidth={2.5}/>
          </span>
          <span className="text-[12.5px] font-black uppercase tracking-wider">Ask SiteBook</span>
        </button>
      )}

      {/* Sheet */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-end sm:p-6" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" style={{ maxHeight: "88vh" }}>
            {/* Header */}
            <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-900" style={{ backgroundColor: BRAND_YELLOW }}>
                  <Sparkles size={14} strokeWidth={2.5}/>
                </span>
                <div>
                  <p className="text-[13px] font-black text-neutral-900">Ask SiteBook</p>
                  <p className="text-[10.5px] font-bold text-neutral-500">Plain English · one question at a time</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
                aria-label="Close"
              >
                <X size={14} strokeWidth={2.5}/>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {reply ? (
                <>
                  <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">You asked</p>
                  <p className="mt-1 text-[13px] text-neutral-800">{reply.question}</p>

                  <div className="mt-4 rounded-2xl p-4" style={{ backgroundColor: "#FFFBEB", border: "2px solid " + BRAND_YELLOW }}>
                    <div className="flex items-start gap-2">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: BRAND_YELLOW, color: "#0A0A0A" }}>
                        <Sparkles size={12} strokeWidth={2.6}/>
                      </span>
                      <p className="text-[13px] leading-relaxed text-neutral-800">{reply.answer}</p>
                    </div>
                    {reply.action && (
                      <div className="mt-3 pl-9">
                        {reply.action.href.startsWith("/") ? (
                          <Link
                            href={reply.action.href}
                            onClick={() => setOpen(false)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm"
                            style={{ backgroundColor: BRAND_GREEN }}
                          >
                            {reply.action.label}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const target = reply.action?.href ?? "";
                              const id = target.startsWith("#") ? target.slice(1) : "";
                              if (id) document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                              setOpen(false);
                            }}
                            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm"
                            style={{ backgroundColor: BRAND_GREEN }}
                          >
                            {reply.action.label}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => { setReply(null); setQ(""); setTimeout(() => inputRef.current?.focus(), 40); }}
                    className="mt-4 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
                  >
                    <MessageCircle size={11} strokeWidth={2.5}/> Ask another question
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[13px] leading-relaxed text-neutral-700">
                    Ask anything about your house or projects — costs, trades, warranties, what&rsquo;s coming up. Plain English, no jargon.
                  </p>

                  <div className="mt-4">
                    <p className="text-[9.5px] font-black uppercase tracking-[0.22em] text-neutral-500">Try one of these</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {SUGGESTED.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => ask(s)}
                          disabled={busy}
                          className="inline-flex items-center rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-bold text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-50"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {error && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-800">{error}</p>
              )}
            </div>

            {/* Input */}
            <form onSubmit={submit} className="border-t p-3" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
                  rows={1}
                  placeholder="Ask anything about your house…"
                  className="flex-1 resize-none rounded-2xl border-2 border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[13px] leading-relaxed outline-none focus:bg-white focus:border-neutral-900"
                />
                <button
                  type="submit"
                  disabled={!q.trim() || busy}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-neutral-900 shadow-sm transition hover:brightness-95 disabled:opacity-40"
                  style={{ backgroundColor: BRAND_YELLOW }}
                  aria-label="Send"
                >
                  <Send size={14} strokeWidth={2.5}/>
                </button>
              </div>
              <p className="mt-1.5 text-center text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">
                Answers are guidance — verify anything critical with a professional
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function prettyError(code: string): string {
  switch (code) {
    case "empty":          return "Type a question first.";
    case "too-long":       return "Question too long (max 500 characters).";
    case "quota-exceeded": return "You've hit today's Ask limit. Upgrade to Pro for more.";
    case "not-authed":     return "Please sign in first.";
    default:               return "Couldn't answer that. Try again in a moment.";
  }
}
