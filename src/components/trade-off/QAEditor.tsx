"use client";

// QAEditor — merchant-side Q&A management for a product.
//
// Same "mounts inside ShopModeEditor's per-product form once the row
// exists" pattern as PairsWithEditor / WhatInBoxEditor. Loads every
// question on the product (including moderation-hidden — trades want
// to know when something was flagged), lets the trade post an answer
// per question. Answers are appended (no edit / delete in Phase 9b —
// that's an admin moderation surface).
//
// Load / answer both go through /api/trade-off/products/qa/*.

import { useEffect, useState } from "react";
import {
  Loader2,
  Send,
  AlertTriangle,
  MessageCircleQuestion,
  CheckCircle2,
  ShieldAlert
} from "lucide-react";

type QuestionRow = {
  id: string;
  asked_by: string | null;
  body: string;
  moderation_status: "live" | "hidden" | "spam";
  flag_count: number;
  created_at: string;
  answers: Array<{
    id: string;
    body: string;
    by_vendor: boolean;
    by_name: string | null;
    created_at: string;
  }>;
};

export function QAEditor({
  slug,
  editToken,
  productId
}: {
  slug: string;
  editToken: string;
  productId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/trade-off/products/qa/list?slug=${encodeURIComponent(slug)}&edit_token=${encodeURIComponent(editToken)}&product_id=${encodeURIComponent(productId)}`;
      const res = await fetch(url);
      const json = (await res.json()) as
        | { ok: true; questions: QuestionRow[] }
        | { ok: false; error: string };
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setQuestions(json.questions);
    } catch {
      setError("Network error while loading Q&A.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, editToken, productId]);

  async function postAnswer(questionId: string) {
    const bodyRaw = (draft[questionId] ?? "").trim();
    if (bodyRaw.length < 3) return;
    setPosting(questionId);
    setError(null);
    try {
      const res = await fetch("/api/trade-off/products/qa/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          question_id: questionId,
          body: bodyRaw
        })
      });
      const json = (await res.json()) as
        | { ok: true }
        | { ok: false; error: string };
      if (!json.ok) {
        setError(
          json.error === "invalid_body_length"
            ? "Answer must be 3–1000 characters."
            : "Couldn't post your answer. Try again."
        );
        return;
      }
      setDraft((prev) => ({ ...prev, [questionId]: "" }));
      await refresh();
    } catch {
      setError("Network error while posting.");
    } finally {
      setPosting(null);
    }
  }

  const pendingCount = questions.filter(
    (q) => q.answers.length === 0 && q.moderation_status === "live"
  ).length;

  return (
    <section className="rounded-2xl border border-brand-line bg-brand-surface p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-brand-text">
            Customer Q&amp;A
          </h3>
          <p className="mt-0.5 text-[11px] text-brand-muted">
            Questions shoppers asked on this product&apos;s PDP. Reply to
            build trust — your answer badges as &ldquo;Trade&rdquo;.
          </p>
        </div>
        {pendingCount > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest text-black"
            style={{ background: "#FFB300" }}
          >
            <MessageCircleQuestion className="h-3 w-3" aria-hidden />
            {pendingCount} to answer
          </span>
        )}
      </header>

      {loading ? (
        <p className="mt-3 text-[12px] text-brand-muted">Loading…</p>
      ) : (
        <>
          {error && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[12px] text-red-500"
            >
              <AlertTriangle
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                aria-hidden
              />
              {error}
            </p>
          )}

          {questions.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-brand-line px-3 py-3 text-[12px] text-brand-muted">
              No questions yet. When a shopper asks on the PDP, it&apos;ll
              land here for you to reply.
            </p>
          ) : (
            <ol className="mt-3 space-y-3">
              {questions.map((q) => {
                const isHidden = q.moderation_status !== "live";
                return (
                  <li
                    key={q.id}
                    className={`rounded-xl border p-3 ${
                      isHidden
                        ? "border-red-500/30 bg-red-500/5"
                        : q.answers.length === 0
                          ? "border-brand-accent/40 bg-brand-accent/5"
                          : "border-brand-line bg-black/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[12.5px] font-black text-brand-text">
                        Q: {q.body}
                      </p>
                      {isHidden ? (
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-500"
                        >
                          <ShieldAlert className="h-3 w-3" aria-hidden />
                          {q.moderation_status}
                        </span>
                      ) : q.answers.length > 0 ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-green-500">
                          <CheckCircle2 className="h-3 w-3" aria-hidden />
                          Replied
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] text-brand-muted">
                      — {q.asked_by ?? "Anonymous"} ·{" "}
                      {new Date(q.created_at).toLocaleDateString()}
                    </p>

                    {q.answers.length > 0 && (
                      <ul className="mt-2 space-y-2 border-t border-brand-line pt-2">
                        {q.answers.map((a) => (
                          <li key={a.id}>
                            <p className="text-[12px] leading-[1.5] text-brand-text">
                              A: {a.body}
                            </p>
                            <p className="mt-0.5 text-[10.5px] text-brand-muted">
                              — {a.by_vendor ? "You (Trade)" : a.by_name ?? "Customer"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}

                    {!isHidden && (
                      <div className="mt-2 space-y-1.5 border-t border-brand-line pt-2">
                        <textarea
                          value={draft[q.id] ?? ""}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [q.id]: e.target.value.slice(0, 1000)
                            }))
                          }
                          placeholder="Reply as the Trade…"
                          rows={2}
                          className="block w-full resize-y rounded-md border border-brand-line bg-brand-surface px-2 py-1.5 text-[12.5px] text-brand-text outline-none focus:border-brand-accent"
                        />
                        <button
                          type="button"
                          onClick={() => postAnswer(q.id)}
                          disabled={
                            posting === q.id ||
                            (draft[q.id] ?? "").trim().length < 3
                          }
                          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-accent px-3 text-[11.5px] font-black text-black disabled:opacity-50"
                        >
                          {posting === q.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          ) : (
                            <Send className="h-3 w-3" aria-hidden />
                          )}
                          Post answer
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
