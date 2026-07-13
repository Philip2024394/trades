"use client";

// StudioAppRecommendModal — the "Describe your app (3 min)" flow.
//
// One text field, four suggestion chips, then either:
//   · AI returns 1–3 App matches → merchant picks → route to detail
//   · AI returns zero matches → merchant can submit as a fresh App idea
//     (goes to admin review queue) or fall back to full App Store
//
// Retrieval-first by design: the API only ever surfaces slugs from the
// live appRegistry. The AI cannot invent Apps.
//
// Non-blocking: ESC / backdrop / X close. Nothing is persisted until
// the merchant explicitly clicks Install (routes to standard flow) or
// Submit idea (routes to /api/studio/apps/submit).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchWithRetry } from "@/lib/studio/fetchWithRetry";
import { StudioErrorBoundary } from "./StudioErrorBoundary";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const GREEN = "#10B981";
const RED = "#DC2626";

type Match = {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  confidence: number;
  reasoning: string;
  installed: boolean;
};

type RecommendResponse =
  | {
      ok: true;
      matches: Match[];
      corpusSize: number;
      provider?: string;
      latencyMs?: number;
    }
  | { ok: false; error: string; detail?: string };

type SubmitResponse =
  | { ok: true; submissionId: string }
  | { ok: false; error: string };

type Stage =
  | { kind: "describe" }
  | { kind: "thinking" }
  | { kind: "results"; matches: Match[]; corpusSize: number }
  | { kind: "submit-idea" }
  | { kind: "submitted" }
  | { kind: "error"; message: string };

const SUGGESTION_CHIPS = [
  "Newsletter signup on my home page",
  "Show my team with photos and roles",
  "Delivery zones + postcode checker",
  "Photo gallery of finished jobs"
];

export function StudioAppRecommendModal({ onClose }: { onClose: () => void }) {
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "describe" });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  async function submitDescription() {
    const trimmed = description.trim();
    if (trimmed.length < 4) return;
    setStage({ kind: "thinking" });
    try {
      const res = await fetchWithRetry("/api/studio/apps/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed })
      });
      const json = (await res.json()) as RecommendResponse;
      if (!res.ok || !json.ok) {
        setStage({
          kind: "error",
          message:
            "error" in json
              ? `${json.error}${json.detail ? ` — ${json.detail}` : ""}`
              : `HTTP ${res.status}`
        });
        return;
      }
      setStage({
        kind: "results",
        matches: json.matches,
        corpusSize: json.corpusSize
      });
    } catch (err) {
      setStage({
        kind: "error",
        message: (err as Error).message ?? "network"
      });
    }
  }

  async function submitIdea() {
    setStage({ kind: "thinking" });
    try {
      const res = await fetchWithRetry("/api/studio/apps/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() })
      });
      const json = (await res.json()) as SubmitResponse;
      if (!res.ok || !json.ok) {
        setStage({
          kind: "error",
          message: "error" in json ? json.error : `HTTP ${res.status}`
        });
        return;
      }
      setStage({ kind: "submitted" });
    } catch (err) {
      setStage({
        kind: "error",
        message: (err as Error).message ?? "network"
      });
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Describe your app"
      className="fixed inset-0 z-[500] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <StudioErrorBoundary label="App Recommend Modal">
          <Header stage={stage} onClose={onClose} />

          <div className="flex-1 overflow-y-auto px-6 pb-8 pt-4 sm:px-8">
            {stage.kind === "describe" && (
              <DescribeStage
                description={description}
                setDescription={setDescription}
                textareaRef={textareaRef}
                onSubmit={() => void submitDescription()}
              />
            )}
            {stage.kind === "thinking" && <ThinkingStage />}
            {stage.kind === "results" && (
              <ResultsStage
                matches={stage.matches}
                corpusSize={stage.corpusSize}
                onSubmitIdea={() => setStage({ kind: "submit-idea" })}
                onRestart={() => {
                  setDescription("");
                  setStage({ kind: "describe" });
                }}
              />
            )}
            {stage.kind === "submit-idea" && (
              <SubmitIdeaStage
                description={description}
                onConfirm={() => void submitIdea()}
                onBack={() =>
                  setStage((prev) =>
                    prev.kind === "results"
                      ? prev
                      : { kind: "results", matches: [], corpusSize: 0 }
                  )
                }
              />
            )}
            {stage.kind === "submitted" && <SubmittedStage onClose={onClose} />}
            {stage.kind === "error" && (
              <ErrorStage
                message={stage.message}
                onRetry={() => void submitDescription()}
                onClose={onClose}
              />
            )}
          </div>
        </StudioErrorBoundary>
      </div>
    </div>
  );
}

// ─── Stages ──────────────────────────────────────────────

function Header({ stage, onClose }: { stage: Stage; onClose: () => void }) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-neutral-200 px-6 py-5 sm:px-8">
      <div className="min-w-0">
        <p
          className="text-[10px] font-extrabold uppercase tracking-widest"
          style={{ color: YELLOW }}
        >
          {stage.kind === "results" || stage.kind === "submit-idea"
            ? "Your matches"
            : "AI recommender · under 3 min"}
        </p>
        <h2 className="mt-1 text-[20px] font-extrabold text-neutral-900 sm:text-[22px]">
          {stage.kind === "results"
            ? "Best fits from the App Store"
            : stage.kind === "submit-idea"
              ? "Submit as a new App idea"
              : stage.kind === "submitted"
                ? "Idea submitted"
                : "Describe your app"}
        </h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-neutral-200 text-neutral-700 transition hover:bg-neutral-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </header>
  );
}

function DescribeStage({
  description,
  setDescription,
  textareaRef,
  onSubmit
}: {
  description: string;
  setDescription: (s: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onSubmit: () => void;
}) {
  const disabled = description.trim().length < 4;
  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-neutral-700">
        In plain English, tell us what you want on your site. We&rsquo;ll
        search the App Store and show you the best fits. Nothing gets
        added until you say so.
      </p>
      <textarea
        ref={textareaRef}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSubmit();
        }}
        placeholder="e.g. I want a signup form on my home page so visitors get my monthly quote-form newsletter"
        rows={4}
        maxLength={600}
        className="w-full resize-none rounded-2xl border border-neutral-300 bg-white p-4 text-[14px] leading-relaxed text-neutral-900 outline-none transition focus:border-neutral-900"
      />
      <div className="flex flex-wrap gap-2">
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setDescription(chip)}
            className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[11px] font-bold text-neutral-700 transition hover:border-neutral-900 hover:bg-white"
          >
            {chip}
          </button>
        ))}
      </div>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] text-neutral-400">
          Cmd/Ctrl + Enter to search · {description.length} / 600
        </p>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 shadow-lg transition disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: YELLOW,
            boxShadow: `0 6px 20px ${YELLOW}66`
          }}
        >
          Find matches →
        </button>
      </div>
    </div>
  );
}

function ThinkingStage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div
        className="grid h-14 w-14 place-items-center rounded-full"
        style={{ background: `${YELLOW}22` }}
      >
        <span
          aria-hidden="true"
          className="tmpl-recommend-spinner block h-6 w-6 rounded-full"
          style={{ borderWidth: 3, borderStyle: "solid", borderColor: `${YELLOW} transparent ${YELLOW} transparent` }}
        />
      </div>
      <p className="text-[13px] font-bold text-neutral-700">
        Searching the App Store…
      </p>
      <p className="text-[11px] text-neutral-500">
        Usually 5–10 seconds
      </p>
      <style>{`
        @keyframes tmpl-recommend-spin { to { transform: rotate(360deg); } }
        .tmpl-recommend-spinner { animation: tmpl-recommend-spin 0.9s linear infinite; }
      `}</style>
    </div>
  );
}

function ResultsStage({
  matches,
  corpusSize,
  onSubmitIdea,
  onRestart
}: {
  matches: Match[];
  corpusSize: number;
  onSubmitIdea: () => void;
  onRestart: () => void;
}) {
  if (matches.length === 0) {
    return (
      <div className="space-y-5 py-4">
        <div
          className="rounded-2xl border p-5"
          style={{ borderColor: "#FDE68A", background: "#FFFBEB" }}
        >
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: "#B45309" }}
          >
            No match found
          </p>
          <p className="mt-1 text-[15px] font-extrabold text-neutral-900">
            We couldn&rsquo;t find an App for that.
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-neutral-700">
            Searched {corpusSize} installable App{corpusSize === 1 ? "" : "s"}.
            Submit your idea and our team will review — good ones get built
            and added to the store for every merchant.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onSubmitIdea}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 shadow-lg transition"
            style={{ background: YELLOW, boxShadow: `0 4px 16px ${YELLOW}66` }}
          >
            Submit as new App idea →
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-neutral-300 px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-50"
          >
            Try again
          </button>
        </div>
        <Link
          href="/studio/apps"
          className="block text-center text-[11px] font-bold uppercase tracking-widest text-neutral-500 underline decoration-neutral-300 underline-offset-4 hover:text-neutral-800"
        >
          Or browse the full App Store →
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-neutral-700">
        Best fits from {corpusSize} installable App{corpusSize === 1 ? "" : "s"}.
        Open one to install it — nothing added to your site until you
        say so.
      </p>
      <ul className="space-y-3">
        {matches.map((m) => (
          <li key={m.slug}>
            <MatchCard match={m} />
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onSubmitIdea}
          className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 underline decoration-neutral-300 underline-offset-4 hover:text-neutral-800"
        >
          None of these fit — submit as new App idea →
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 underline decoration-neutral-300 underline-offset-4 hover:text-neutral-800"
        >
          ← Refine your description
        </button>
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  const pct = Math.round(match.confidence * 100);
  return (
    <Link
      href={`/studio/apps/${match.slug}`}
      className="group flex items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-md"
    >
      <div
        className="grid h-14 w-14 shrink-0 place-items-center rounded-xl text-[10px] font-extrabold uppercase tracking-widest text-neutral-900"
        style={{ background: YELLOW }}
      >
        {pct}%
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[15px] font-extrabold text-neutral-900">
            {match.name}
          </p>
          {match.installed && (
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
              style={{ background: GREEN }}
            >
              Installed
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[12px] text-neutral-600">{match.tagline}</p>
        {match.reasoning && (
          <p className="mt-2 text-[12px] leading-relaxed text-neutral-700">
            <span className="font-bold">Why: </span>
            {match.reasoning}
          </p>
        )}
      </div>
      <span
        className="hidden shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest text-neutral-900 transition group-hover:brightness-95 sm:inline-flex"
        style={{ background: YELLOW }}
      >
        {match.installed ? "Open" : "Install"} →
      </span>
    </Link>
  );
}

function SubmitIdeaStage({
  description,
  onConfirm,
  onBack
}: {
  description: string;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <div
        className="rounded-2xl border p-5"
        style={{ borderColor: "#E5E5E5", background: "#FAFAFA" }}
      >
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Your description
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-800">
          {description}
        </p>
      </div>
      <div className="rounded-2xl border border-neutral-200 p-4 text-[12px] leading-relaxed text-neutral-600">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          What happens next
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-[12px] text-neutral-700">
          <li>Our team reviews your idea (usually 24–48 hours).</li>
          <li>If it&rsquo;s a good fit, we build it and refine the design.</li>
          <li>It ships to the App Store — every merchant can install it.</li>
          <li>You&rsquo;re first to know when it&rsquo;s live.</li>
        </ol>
        <p className="mt-3 text-[10px] leading-relaxed text-neutral-500">
          By submitting, you agree the resulting App and its materials
          become the property of thenetworkers.app. See our{" "}
          <Link
            href="/legal/terms"
            className="underline decoration-neutral-400 underline-offset-2"
            target="_blank"
          >
            Terms
          </Link>
          .
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-300 px-4 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-50"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 shadow-lg transition"
          style={{ background: YELLOW, boxShadow: `0 4px 16px ${YELLOW}66` }}
        >
          Submit for review →
        </button>
      </div>
    </div>
  );
}

function SubmittedStage({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <span
        className="grid h-14 w-14 place-items-center rounded-full text-white"
        style={{ background: GREEN }}
        aria-hidden="true"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <p className="text-[20px] font-extrabold text-neutral-900">
        Idea submitted
      </p>
      <p className="max-w-sm text-[13px] leading-relaxed text-neutral-600">
        Our team will review within 24–48 hours. We&rsquo;ll email you
        when there&rsquo;s an update.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition"
        style={{ background: YELLOW }}
      >
        Close
      </button>
    </div>
  );
}

function ErrorStage({
  message,
  onRetry,
  onClose
}: {
  message: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 py-12 text-center"
    >
      <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: RED }}>
        Something went wrong
      </p>
      <p className="max-w-sm text-[13px] leading-relaxed text-neutral-700">
        {message}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition"
          style={{ background: YELLOW }}
        >
          Try again
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-300 px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}
