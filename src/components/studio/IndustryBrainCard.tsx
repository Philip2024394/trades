"use client";

// Industry Brain card — ask any trade-relevant question.
//
// The Knowledge Graph in one input box. Retrieval-first: no LLM
// hallucinations, every claim is cited to a real node with a real
// source URL. When the Graph can't answer honestly, the card says so
// and offers to escalate to a human.

import { useState } from "react";
import { fetchWithRetry } from "@/lib/studio/fetchWithRetry";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const AMBER = "#F59E0B";
const NEUTRAL = "#525252";

type UsedNode = {
  id: string;
  title: string;
  citation: string;
  layer: "merchant" | "package" | "domain" | "global";
};

type AnswerResponse = {
  ok: true;
  answer: string;
  citations: string[];
  confidence: number;
  escalate: boolean;
  nodesUsed: UsedNode[];
  layersUsed: string[];
};

type ErrorResponse = { ok: false; error: string; detail?: string };

type ApiResponse = AnswerResponse | ErrorResponse;

const SAMPLES = [
  "Do landlords need an annual gas safety check?",
  "What warranty comes with a MCS-registered heat pump?",
  "Do I need Waste Carrier registration for tile removal?",
  "How often should landlords do an EICR?"
];

export function IndustryBrainCard() {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnswerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    if (question.trim().length < 4) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetchWithRetry(
        "/api/studio/industry-brain/answer",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: question.trim() })
        }
      );
      const json = (await res.json()) as ApiResponse;
      if (!json.ok) {
        setError(json.detail ?? json.error);
        return;
      }
      setResult(json);
    } catch (err) {
      setError((err as Error).message ?? "network");
    } finally {
      setBusy(false);
    }
  }

  function renderAnswer(text: string) {
    // Render citation refs as pills; text stays plain otherwise.
    const parts = text.split(/(\[[^\]]+\])/g);
    return parts.map((p, i) => {
      const match = p.match(/^\[(.+)\]$/);
      if (match) {
        return (
          <sup
            key={i}
            className="mx-0.5 inline-flex items-center rounded-md bg-neutral-100 px-1 py-0.5 text-[9px] font-mono font-bold text-neutral-700"
            title={match[1]}
          >
            {match[1].split(".").slice(-1)[0].slice(0, 12)}
          </sup>
        );
      }
      return <span key={i}>{p}</span>;
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-3">
        <p
          className="text-[10px] font-extrabold uppercase tracking-widest"
          style={{ color: YELLOW }}
        >
          Industry Brain
        </p>
        <p className="mt-0.5 text-[11px] text-neutral-600">
          Ask any trade-relevant question. Answers grounded in the
          Knowledge Graph — every claim cited to a real source. When we
          can't answer honestly, we say so.
        </p>
      </div>

      <div className="p-5">
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) void ask();
            }}
            placeholder="e.g. Do landlords need an annual gas safety check?"
            className="flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-neutral-900"
          />
          <button
            type="button"
            onClick={ask}
            disabled={busy || question.trim().length < 4}
            className="inline-flex h-10 items-center rounded-xl px-4 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95 disabled:opacity-40"
            style={{ background: YELLOW }}
          >
            {busy ? "Thinking…" : "Ask"}
          </button>
        </div>

        <ul className="mt-2 flex flex-wrap gap-1">
          {SAMPLES.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => setQuestion(s)}
                className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600 transition hover:bg-neutral-200"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700"
          >
            {error}
          </p>
        )}

        {result && (
          <div className="mt-4 rounded-xl border-2 border-neutral-900 bg-neutral-900 p-4 text-white">
            <div className="flex items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest"
                style={{
                  background: result.escalate
                    ? AMBER
                    : result.confidence >= 0.7
                      ? GREEN
                      : NEUTRAL,
                  color: "#0A0A0A"
                }}
              >
                {result.escalate
                  ? "Escalate to a pro"
                  : `Confidence ${(result.confidence * 100).toFixed(0)}%`}
              </span>
              {result.layersUsed.length > 0 && (
                <span className="text-[9px] font-mono text-white/60">
                  layers: {result.layersUsed.join(" · ")}
                </span>
              )}
            </div>

            <p className="mt-3 text-[13px] leading-relaxed">
              {renderAnswer(result.answer)}
            </p>

            {result.nodesUsed.length > 0 && (
              <>
                <p
                  className="mt-4 text-[9px] font-extrabold uppercase tracking-widest"
                  style={{ color: YELLOW }}
                >
                  Cited sources ({result.nodesUsed.length})
                </p>
                <ul className="mt-1 space-y-1">
                  {result.nodesUsed.map((n) => (
                    <li key={n.id} className="text-[11px] text-white/80">
                      <span
                        className="mr-2 inline-block rounded px-1.5 py-0.5 text-[9px] font-mono"
                        style={{ background: "#2D2D2D" }}
                      >
                        {n.layer}
                      </span>
                      <span className="font-bold">{n.title}</span>
                      {n.citation.startsWith("http") && (
                        <>
                          {" — "}
                          <a
                            href={n.citation}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="underline decoration-dotted"
                            style={{ color: YELLOW }}
                          >
                            source ↗
                          </a>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
