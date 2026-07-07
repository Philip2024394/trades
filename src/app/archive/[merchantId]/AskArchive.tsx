// Ask-your-archive client island. One input, one submit, results.

"use client";

import { Loader2, Search, Sparkles } from "lucide-react";
import { useState } from "react";

type QueryHit = {
  record: {
    id: string;
    recordType: string;
    facets: Record<string, unknown>;
    postcode: string | null;
    updatedAt: string;
  };
  score: number;
  matchedBy: "structured" | "vector" | "both";
};

type AskResponse = {
  plan: {
    interpretation: string;
    facetMatch: Record<string, unknown>;
    postcodeStartsWith: string | null;
    recordType: string | null;
    searchPhrase: string;
  };
  hits: QueryHit[];
  answer: {
    summary: string;
    count: number;
    aggregate: {
      trades: string[];
      services: string[];
      materials: string[];
      postcodes: string[];
    };
  };
};

const EXAMPLES = [
  "Show me every sandstone patio in LS6",
  "How many kitchens did we finish this quarter?",
  "Which jobs used welsh slate?",
  "Recent extension jobs with 5-star reviews"
];

export function AskArchive({ merchantId }: { merchantId: string }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (q?: string) => {
    const text = (q ?? question).trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/memory/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId, question: text })
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = (await res.json()) as AskResponse;
      setResult(data);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 shrink-0 text-neutral-400" />
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.currentTarget.value)}
            placeholder="Ask anything about your work…"
            className="min-w-0 flex-1 border-0 bg-transparent p-1 text-[14px] outline-none placeholder:text-neutral-400"
          />
          <button
            type="submit"
            disabled={busy || !question.trim()}
            className="rounded-full bg-neutral-900 px-4 py-1.5 text-[12px] font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ask"}
          </button>
        </div>
      </form>

      {!result && !busy ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQuestion(ex);
                submit(ex);
              }}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-medium text-neutral-700 transition hover:border-neutral-400"
            >
              {ex}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-800">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mt-5 flex flex-col gap-4">
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
              <div>
                <div className="text-[13px] font-semibold text-neutral-900">
                  {result.answer.summary}
                </div>
                {result.plan.interpretation ? (
                  <div className="mt-1 text-[11px] text-neutral-700">
                    Interpreted as: {result.plan.interpretation}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {result.answer.count > 0 ? (
            <>
              <section>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Common tags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.answer.aggregate.trades.map((t) => (
                    <Chip key={`t-${t}`} color="amber">
                      {humanise(t)}
                    </Chip>
                  ))}
                  {result.answer.aggregate.services.map((s) => (
                    <Chip key={`s-${s}`} color="neutral">
                      {humanise(s)}
                    </Chip>
                  ))}
                  {result.answer.aggregate.materials.map((m) => (
                    <Chip key={`m-${m}`} color="blue">
                      {humanise(m)}
                    </Chip>
                  ))}
                  {result.answer.aggregate.postcodes.map((p) => (
                    <Chip key={`p-${p}`} color="emerald">
                      {p}
                    </Chip>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Records ({result.hits.length})
                </div>
                <ol className="flex flex-col gap-2">
                  {result.hits.map((hit) => (
                    <li
                      key={hit.record.id}
                      className="rounded-xl border border-neutral-200 bg-white p-3"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-[12px] font-semibold text-neutral-900">
                          {humanise(hit.record.recordType)} ·{" "}
                          {(hit.record.facets.trade as string)
                            ? humanise(hit.record.facets.trade as string)
                            : ""}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${matchColour(hit.matchedBy)}`}
                          >
                            {hit.matchedBy}
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            {(hit.score * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-neutral-600">
                        {hit.record.postcode ? (
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5">
                            {hit.record.postcode}
                          </span>
                        ) : null}
                        {(hit.record.facets.service as string) ? (
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5">
                            {humanise(hit.record.facets.service as string)}
                          </span>
                        ) : null}
                        {Array.isArray(hit.record.facets.materials)
                          ? (hit.record.facets.materials as string[])
                              .slice(0, 4)
                              .map((m) => (
                                <span
                                  key={m}
                                  className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-800"
                                >
                                  {humanise(m)}
                                </span>
                              ))
                          : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function Chip({
  children,
  color
}: {
  children: React.ReactNode;
  color: "amber" | "neutral" | "blue" | "emerald";
}) {
  const cls =
    color === "amber"
      ? "bg-amber-100 text-amber-900"
      : color === "blue"
      ? "bg-blue-100 text-blue-900"
      : color === "emerald"
      ? "bg-emerald-100 text-emerald-900"
      : "bg-neutral-100 text-neutral-800";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

function matchColour(
  m: "structured" | "vector" | "both"
): string {
  switch (m) {
    case "structured":
      return "bg-neutral-100 text-neutral-700";
    case "vector":
      return "bg-purple-100 text-purple-800";
    case "both":
      return "bg-emerald-100 text-emerald-800";
  }
}

function humanise(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
