"use client";

// Merchant pending-reviews UI. One card per review with a countdown
// timer, the reviewer summary, the review body, and three action
// buttons that POST to the endpoints we shipped.

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Star, MessageSquare, ShieldAlert, Check, X, Send, FileWarning } from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK, BRAND_RED } from "@/lib/brand/tokens";

type PendingReview = {
  id: string;
  reviewer: {
    displayName: string;
    tradeLabel: string;
    city: string;
  };
  overall: number;
  body: string;
  publishAt: string;
  createdAt: string;
};

export function PendingReviewsShell({
  merchantSlug,
  pending
}: {
  merchantSlug: string;
  pending: PendingReview[];
}) {
  return (
    <div className="pb-16">
      <section
        className="relative overflow-hidden border-b"
        style={{ backgroundColor: BRAND_BLACK, borderColor: `${BRAND_YELLOW}33` }}
      >
        <div className="mx-auto max-w-3xl px-3 py-6 md:px-6 md:py-8">
          <Link
            href={`/trade/${merchantSlug}/reviews`}
            className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-400 hover:text-white"
          >
            <ArrowLeft size={11} strokeWidth={2.5}/>
            Back to reviews
          </Link>
          <div className="mt-3 flex items-center gap-1.5">
            <FileWarning size={12} color={BRAND_YELLOW} strokeWidth={2.5}/>
            <span className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: BRAND_YELLOW }}>
              Pending reviews · 72h window
            </span>
          </div>
          <h1 className="mt-1 text-[22px] font-black leading-tight text-white md:text-[26px]">
            {pending.length === 0
              ? "Nothing pending — you're clear."
              : `${pending.length} review${pending.length === 1 ? "" : "s"} awaiting your response`}
          </h1>
          <p className="mt-2 max-w-xl text-[12px] leading-snug text-neutral-300 md:text-[13px]">
            Reviews under 4★ enter a 72-hour window before publishing. Reply publicly, dispute with evidence, or let the countdown finish and the review will go live.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-3 pt-6 md:px-6 md:pt-8">
        {pending.length === 0 ? (
          <EmptyState/>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((r) => (
              <li key={r.id}>
                <PendingReviewCard review={r}/>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PendingReviewCard({ review }: { review: PendingReview }) {
  const [mode, setMode] = useState<"idle" | "respond" | "dispute" | "responded" | "disputed">("idle");
  const [body, setBody] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = formatRemaining(review.publishAt);

  async function submitRespond() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/moderate/${review.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "unknown-error");
        return;
      }
      setMode("responded");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitDispute() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/moderate/${review.id}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rebuttal: body,
          evidenceUrls: evidenceUrl ? [evidenceUrl] : []
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "unknown-error");
        return;
      }
      setMode("disputed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article
      className="rounded-2xl border-2 bg-white shadow-sm"
      style={{ borderColor: mode === "responded" ? BRAND_GREEN_DARK : mode === "disputed" ? BRAND_RED : BRAND_YELLOW }}
    >
      <div className="border-b p-4" style={{ borderColor: "rgba(139,69,19,0.12)" }}>
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Star size={14} fill={BRAND_YELLOW} color={BRAND_YELLOW} strokeWidth={0}/>
            <span className="text-[18px] font-black tabular-nums text-neutral-900">
              {review.overall.toFixed(1)}
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
              from {review.reviewer.displayName}
            </span>
          </div>
          <span
            className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider"
            style={{ color: mode === "disputed" ? BRAND_RED : "#7A5300" }}
          >
            <Clock size={11} strokeWidth={2.5}/>
            {mode === "disputed" ? "disputed" : remaining}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-neutral-500">
          {review.reviewer.tradeLabel}{review.reviewer.city ? ` · ${review.reviewer.city}` : ""}
        </div>
      </div>

      <div className="border-b p-4" style={{ borderColor: "rgba(139,69,19,0.12)" }}>
        <p className="text-[13px] leading-relaxed text-neutral-800">
          "{review.body}"
        </p>
      </div>

      {mode === "responded" && (
        <div className="p-4 text-[12px] font-black uppercase tracking-wider" style={{ color: BRAND_GREEN_DARK }}>
          <Check size={13} strokeWidth={2.5} className="mr-1 inline"/>
          Public response saved. It will publish alongside the review when the window closes.
        </div>
      )}

      {mode === "disputed" && (
        <div className="p-4 text-[12px] font-black uppercase tracking-wider" style={{ color: BRAND_RED }}>
          <ShieldAlert size={13} strokeWidth={2.5} className="mr-1 inline"/>
          Dispute submitted. Review is frozen — admin will decide within 24h.
        </div>
      )}

      {mode === "idle" && (
        <div className="flex flex-wrap gap-2 p-4">
          <button
            type="button"
            onClick={() => setMode("respond")}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
            style={{ backgroundColor: BRAND_YELLOW }}
          >
            <MessageSquare size={12} strokeWidth={2.5}/>
            Respond publicly
          </button>
          <button
            type="button"
            onClick={() => setMode("dispute")}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[11px] font-black uppercase tracking-wider transition hover:bg-red-50"
            style={{ borderColor: `${BRAND_RED}66`, color: BRAND_RED }}
          >
            <ShieldAlert size={12} strokeWidth={2.5}/>
            Dispute with evidence
          </button>
        </div>
      )}

      {(mode === "respond" || mode === "dispute") && (
        <div className="border-t p-4" style={{ borderColor: "rgba(139,69,19,0.12)" }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
              {mode === "respond" ? "Your public response" : "Your rebuttal + evidence"}
            </span>
            <button
              type="button"
              onClick={() => { setMode("idle"); setError(null); }}
              className="text-neutral-400 hover:text-neutral-700"
              aria-label="Cancel"
            >
              <X size={14}/>
            </button>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 2000))}
            rows={mode === "dispute" ? 5 : 3}
            placeholder={mode === "respond"
              ? "Public, plain, honest. This publishes alongside the review."
              : "Explain what actually happened. Attach photos, WhatsApp exports, invoices — anything that supports your side."}
            className="w-full rounded-lg border p-3 text-[13px] leading-relaxed text-neutral-800 focus:outline-none focus:ring-2"
            style={{ borderColor: "rgba(139,69,19,0.20)", backgroundColor: "#FAFAFA" }}
          />
          {mode === "dispute" && (
            <input
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="Evidence URL (photo, screenshot, invoice)"
              className="mt-2 w-full rounded-lg border p-2.5 text-[12px] text-neutral-800 focus:outline-none focus:ring-2"
              style={{ borderColor: "rgba(139,69,19,0.20)", backgroundColor: "#FAFAFA" }}
            />
          )}
          {error && (
            <div className="mt-2 rounded-lg border p-2 text-[11px] text-red-700" style={{ borderColor: `${BRAND_RED}66`, backgroundColor: "#FEF2F2" }}>
              {error}
            </div>
          )}
          <button
            type="button"
            disabled={submitting || body.trim().length < (mode === "respond" ? 20 : 30)}
            onClick={mode === "respond" ? submitRespond : submitDispute}
            className="mt-3 inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: mode === "respond" ? BRAND_YELLOW : BRAND_RED, color: mode === "respond" ? BRAND_BLACK : "#FFFFFF" }}
          >
            <Send size={13} strokeWidth={2.5}/>
            {submitting ? "Sending..." : mode === "respond" ? "Publish response" : "Submit dispute · freezes review"}
          </button>
        </div>
      )}
    </article>
  );
}

function EmptyState() {
  return (
    <div
      className="mx-auto mt-6 max-w-md rounded-2xl border border-dashed p-8 text-center"
      style={{ borderColor: "rgba(139,69,19,0.25)", backgroundColor: "#FFFFFF" }}
    >
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${BRAND_GREEN_DARK}22` }}
      >
        <Check size={22} color={BRAND_GREEN_DARK} strokeWidth={2.5}/>
      </div>
      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.28em] text-neutral-500">
        All clear
      </p>
      <h3 className="mt-1 text-[16px] font-black text-neutral-900">
        No reviews in the 72h window.
      </h3>
      <p className="mt-1.5 text-[12px] leading-snug text-neutral-500">
        When a review under 4★ lands, you have 72 hours to respond, dispute, or let it publish. This is where they'll show up.
      </p>
    </div>
  );
}

function formatRemaining(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return "publishes now";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) {
    const mins = Math.floor(ms / (60 * 1000));
    return `${mins}m left`;
  }
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}
