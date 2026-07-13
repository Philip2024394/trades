"use client";

// TradeQABlock — trades-themed port of Hammerex's QABlock.
//
// Renders a public Q&A thread under the PDP. Anyone can ask a
// question — no sign-in required, just an optional display name. The
// trade responds via their editor (Phase 9b covers the merchant-side
// answer flow); until an answer lands, questions display standalone
// with a "Waiting for response" chip.
//
// Reads the question thread shape returned by the PDP server loader
// (hammerex_xrated_questions + attached hammerex_xrated_answers).
// Optimistic on Ask — the question pops into the list the moment the
// server confirms so the shopper sees their contribution.

import { useState } from "react";
import type { HammerexXratedQuestion } from "@/lib/supabase";
import { AlertTriangle, Loader2, Send, MessageCircleQuestion } from "lucide-react";

export function TradeQABlock({
  productId,
  productName,
  initialQuestions,
  tradeDisplayName
}: {
  productId: string;
  productName: string;
  initialQuestions: HammerexXratedQuestion[];
  tradeDisplayName: string;
}) {
  const [questions, setQuestions] = useState<HammerexXratedQuestion[]>(
    initialQuestions
  );
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = draft.trim();
    if (q.length < 3 || posting) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/trade-off/products/qa/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          body: q,
          asked_by: name.trim().length > 0 ? name.trim() : null
        })
      });
      const json = (await res.json()) as
        | { ok: true; questionId: string; createdAt: string }
        | { ok: false; error: string };
      if (!json.ok) {
        setError(
          json.error === "invalid_body_length"
            ? "Question must be 3–500 characters."
            : json.error === "product_not_available"
              ? "This product is no longer live."
              : "Couldn't post your question. Try again."
        );
        return;
      }
      // Optimistic insert at the top so the shopper sees their question
      // land instantly. Refresh on next page load will reconcile with
      // the DB order.
      setQuestions((prev) => [
        {
          id: json.questionId,
          product_id: productId,
          asked_by: name.trim().length > 0 ? name.trim() : null,
          body: q,
          flag_count: 0,
          moderation_status: "live",
          moderated_at: null,
          deleted_at: null,
          created_at: json.createdAt,
          answers: []
        },
        ...prev
      ]);
      setDraft("");
      setPosted(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <section
      id="qa"
      className="border-t border-[#1B1A17]/10 bg-[#FBF6EC] py-10"
    >
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-black text-[#1B1A17] md:text-[22px]">
              Questions &amp; answers
            </h2>
            <p className="mt-1 text-[12.5px] text-[#1B1A17]/60">
              Answered by {tradeDisplayName} and by people who own this.
            </p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#1B1A17]/10 bg-white p-4 shadow-sm"
        >
          <label className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-700">
            Ask a question about {productName}
          </label>
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value.slice(0, 500));
              if (posted) setPosted(false);
            }}
            placeholder={`e.g. Does this include delivery to my postcode? Is it in stock?`}
            rows={3}
            className="w-full resize-y rounded-lg border border-[#1B1A17]/10 bg-[#FBF6EC]/60 px-3 py-2 text-[13.5px] leading-[1.5] text-[#1B1A17] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-300/40"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              placeholder="Your name (optional)"
              className="h-10 flex-1 rounded-full border border-[#1B1A17]/10 bg-white px-3 text-[13px] text-[#1B1A17] outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={posting || draft.trim().length < 3}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-amber-400 px-5 text-[13px] font-black text-[#0A0A0A] shadow-sm transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {posting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  Ask
                </>
              )}
            </button>
          </div>
          {error && (
            <p
              role="alert"
              className="flex items-start gap-1.5 rounded-lg border border-red-300 bg-red-50 px-2 py-1.5 text-[12px] font-semibold text-red-800"
            >
              <AlertTriangle
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                aria-hidden
              />
              {error}
            </p>
          )}
          {posted && !error && (
            <p className="rounded-lg border border-emerald-400/40 bg-emerald-50 px-2 py-1.5 text-[12px] font-semibold text-emerald-900">
              Your question is live. {tradeDisplayName} typically replies
              within one business day.
            </p>
          )}
        </form>

        {questions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#1B1A17]/15 bg-white p-10 text-center">
            <MessageCircleQuestion
              className="mx-auto h-6 w-6 text-[#1B1A17]/30"
              aria-hidden
            />
            <p className="mt-2 text-[13.5px] font-black text-[#1B1A17]">
              No questions yet — yours could be the first.
            </p>
            <p className="mt-1 text-[12px] text-[#1B1A17]/60">
              {tradeDisplayName} usually replies within one business day.
            </p>
          </div>
        ) : (
          <ol className="space-y-3">
            {questions.map((q) => (
              <li
                key={q.id}
                className="rounded-2xl border border-[#1B1A17]/10 bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13.5px] font-black text-[#1B1A17]">
                    Q: {q.body}
                  </p>
                  {q.answers.length === 0 && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-800"
                      style={{ background: "#FFF7E0" }}
                    >
                      Awaiting reply
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11.5px] text-[#1B1A17]/50">
                  — {q.asked_by ?? "Anonymous"}
                </p>
                {q.answers.length > 0 && (
                  <ul className="mt-3 space-y-3 border-t border-[#1B1A17]/8 pt-3">
                    {q.answers.map((a) => (
                      <li key={a.id}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[13px] leading-[1.55] text-[#1B1A17]">
                            A: {a.body}
                          </p>
                          {a.by_vendor && (
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-900 shadow-sm"
                              style={{ background: "#FFB300" }}
                            >
                              Trade
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11.5px] text-[#1B1A17]/50">
                          — {a.by_vendor
                            ? tradeDisplayName
                            : a.by_name ?? "Verified customer"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
