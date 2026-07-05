"use client";

// Business Discovery — the free-text alternative to trade cards.
//
// Merchant types a paragraph about their business. LLM extracts trade
// + outcomes + coverage + suggested modules (retrieval-constrained
// against real registries — hallucinations dropped silently). We then
// deep-link into the wizard pre-filled.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithRetry } from "@/lib/studio/fetchWithRetry";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const NEUTRAL = "#525252";

type Discovery = {
  tradeSlug: string | null;
  outcomes: string[];
  coverage: {
    national: boolean;
    postcode: string | null;
    radiusMi: number | null;
  };
  modules: string[];
  merchantName: string | null;
  confidence: number;
  reasoning: string;
};

type ApiResponse =
  | { ok: true; discovery: Discovery }
  | { ok: false; error: string; detail?: string };

const SAMPLE = "We hire out excavators and dumpers across Yorkshire. Also sell used machinery. Need more enquiries and quote requests online.";

export function BusinessDiscoveryInput() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Discovery | null>(null);

  async function analyze() {
    if (text.trim().length < 8) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetchWithRetry("/api/studio/business-discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: text.trim() })
      });
      const json = (await res.json()) as ApiResponse;
      if (!json.ok) {
        setError(json.detail ?? json.error);
        setBusy(false);
        return;
      }
      setResult(json.discovery);
    } catch (err) {
      setError((err as Error).message ?? "network");
    } finally {
      setBusy(false);
    }
  }

  function jumpToWizard() {
    if (!result?.tradeSlug) return;
    const url = new URL(
      "/studio/blueprints/wizard",
      window.location.origin
    );
    url.searchParams.set("trade", result.tradeSlug);
    if (result.outcomes.length > 0) {
      url.searchParams.set("outcomes", result.outcomes.join(","));
    }
    if (!result.coverage.national && result.coverage.postcode) {
      url.searchParams.set("postcode", result.coverage.postcode);
    }
    if (!result.coverage.national && result.coverage.radiusMi) {
      url.searchParams.set("radius", String(result.coverage.radiusMi));
    }
    if (result.coverage.national) {
      url.searchParams.set("national", "1");
    }
    router.push(url.toString());
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-3">
        <p
          className="text-[10px] font-extrabold uppercase tracking-widest"
          style={{ color: YELLOW }}
        >
          Describe your business
        </p>
        <p className="mt-0.5 text-[11px] text-neutral-600">
          Type a paragraph. We'll pick your trade, goals, coverage +
          suggested modules — retrieval-constrained, no hallucinations.
        </p>
      </div>
      <div className="p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={SAMPLE}
          rows={3}
          className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-neutral-900"
        />
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setText(SAMPLE)}
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: NEUTRAL }}
          >
            Try an example
          </button>
          <button
            type="button"
            onClick={analyze}
            disabled={busy || text.trim().length < 8}
            className="inline-flex h-10 items-center rounded-xl px-4 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95 disabled:opacity-40"
            style={{ background: YELLOW }}
          >
            {busy ? "Analysing…" : "Analyse →"}
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700"
          >
            {error}
          </p>
        )}

        {result && (
          <div className="mt-4 rounded-xl border-2 border-neutral-900 bg-neutral-900 p-4 text-white">
            <p
              className="text-[9px] font-extrabold uppercase tracking-widest"
              style={{ color: YELLOW }}
            >
              What we picked up
            </p>
            <dl className="mt-2 space-y-2 text-[12px]">
              {result.tradeSlug ? (
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="opacity-70">Trade</dt>
                  <dd className="font-extrabold">
                    {result.tradeSlug}{" "}
                    <span
                      className="ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                      style={{ background: GREEN }}
                    >
                      {(result.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </dd>
                </div>
              ) : (
                <p className="text-amber-300">
                  Couldn't confidently pick a trade — add a bit more
                  detail (e.g. "we're plant hire" or "carpenter") and try
                  again.
                </p>
              )}

              {result.outcomes.length > 0 && (
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="opacity-70">Goals</dt>
                  <dd className="text-right font-extrabold">
                    {result.outcomes.join(" · ")}
                  </dd>
                </div>
              )}

              {(result.coverage.national ||
                result.coverage.postcode) && (
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="opacity-70">Coverage</dt>
                  <dd className="text-right font-extrabold">
                    {result.coverage.national
                      ? "National"
                      : `${result.coverage.postcode ?? ""}${
                          result.coverage.radiusMi
                            ? ` · ${result.coverage.radiusMi} mi`
                            : ""
                        }`}
                  </dd>
                </div>
              )}

              {result.modules.length > 0 && (
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="opacity-70">Modules</dt>
                  <dd className="text-right font-extrabold">
                    {result.modules.join(" · ")}
                  </dd>
                </div>
              )}

              {result.merchantName && (
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="opacity-70">Business</dt>
                  <dd className="text-right font-extrabold">
                    {result.merchantName}
                  </dd>
                </div>
              )}

              {result.reasoning && (
                <p className="mt-2 border-t border-white/10 pt-2 text-[10px] italic text-white/80">
                  Why: {result.reasoning}
                </p>
              )}
            </dl>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                onClick={jumpToWizard}
                disabled={!result.tradeSlug}
                className="inline-flex flex-1 items-center justify-center rounded-xl px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95 disabled:opacity-40"
                style={{ background: YELLOW }}
              >
                Build my site →
              </button>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-transparent px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-widest text-white/80"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
