"use client";

// Author Mode · Philip's primary authoring surface (2026-08-01)
//
// One paste box · one button · Brain Processor runs the whole pipeline:
//   raw notes → grammar/spell fix → structure into ## sections →
//   detect ambiguities → save as approved · ready immediately.
//
// Only interrupts when the LLM cannot determine meaning with confidence.

import { useCallback, useState } from "react";

type AuthorDiffEntry = {
  original_snippet: string;
  published_body:   string;
  published_heading: string;
};

type ConflictWarning = {
  new_section:      string;
  existing_file:    string;
  existing_section: string;
  summary:          string;
};

type BrainResult = {
  ok: true;
  file_slug: string;
  topic_name: string;
  sections_written: number;
  summary_bullets: string[];
  author_diff: AuthorDiffEntry[];
  conflicts: ConflictWarning[];
  md_path: string;
} | {
  ok: true;
  ambiguities: Array<{ phrase: string; options: string[] }>;
} | {
  ok: false;
  error: string;
};

export function AuthorModeClient() {
  const [topic, setTopic] = useState("");
  const [raw, setRaw] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<BrainResult | null>(null);
  const [recentResults, setRecentResults] = useState<Array<{ topic: string; bullets: string[]; at: string }>>([]);

  const process = useCallback(async () => {
    if (raw.trim().length < 40) return;
    setResult(null);
    setProcessing(true);
    try {
      const res = await fetch("/api/admin/nex/authoring/brain-process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ raw, topic: topic || undefined }),
      });
      const j: BrainResult = await res.json();
      setResult(j);
      if (j.ok && "topic_name" in j) {
        setRecentResults((prev) => [
          { topic: j.topic_name, bullets: j.summary_bullets, at: new Date().toLocaleTimeString() },
          ...prev,
        ].slice(0, 8));
        setRaw("");
        setTopic("");
      }
    } catch (e: unknown) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "processing failed" });
    } finally {
      setProcessing(false);
    }
  }, [raw, topic]);

  return (
    <section className="rounded-2xl border-2 border-neutral-900 bg-white p-5 shadow-md">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h2 className="text-[14px] font-black uppercase tracking-[0.14em] text-neutral-900">
            🧠 Author Mode
          </h2>
          <p className="mt-1 text-[11px] text-neutral-500">
            Paste raw notes. The Brain Processor fixes grammar, structures topics, and publishes directly. No approval loops · no manual ratification. Interrupts only when meaning is genuinely ambiguous.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-neutral-500">
            Topic hint (optional)
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Oak Staircase · Business Ops · Installation Process — leave blank to let the processor decide"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
            disabled={processing}
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-neutral-500">
            Raw notes · paste anything · bullets · unfinished thoughts · full articles
          </label>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste your notes here · grammar, spelling, and structure will be handled automatically. Just get your knowledge into Nex."
            rows={18}
            spellCheck={true}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
            disabled={processing}
          />
          <p className="mt-1 text-[10.5px] text-neutral-500">
            {raw.length} characters · minimum 40 to process
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={process}
            disabled={processing || raw.trim().length < 40}
            className="rounded-full bg-neutral-900 px-5 py-2.5 text-[13px] font-black text-white hover:bg-neutral-800 disabled:opacity-40"
          >
            {processing ? "Processing…" : "Process & publish to Brain"}
          </button>
          {processing && (
            <span className="text-[11px] text-neutral-500">
              Fixing grammar · structuring topics · saving to Brain…
            </span>
          )}
        </div>

        {/* Result · success or ambiguity */}
        {result && result.ok && "topic_name" in result && (
          <div className="space-y-3">
            {/* SUCCESS · summary */}
            <div className="rounded-xl border border-green-300 bg-green-50 p-4">
              <p className="text-[11px] font-black uppercase tracking-wider text-green-800">
                ✓ Published to Brain · {result.topic_name}
              </p>
              <ul className="mt-2 space-y-1">
                {result.summary_bullets.map((b, i) => (
                  <li key={i} className="text-[12px] text-neutral-800">• {b}</li>
                ))}
                <li className="text-[12px] text-neutral-800">• {result.sections_written} sections indexed</li>
              </ul>
              <p className="mt-2 text-[11px] text-neutral-500">
                Nex will use this on next customer request. File: <code className="rounded bg-white px-1.5 py-0.5">{result.file_slug}.md</code>
              </p>
            </div>

            {/* CONFLICTS · shown at top when present because they need attention */}
            {result.conflicts.length > 0 && (
              <div className="rounded-xl border-2 border-red-400 bg-red-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-wider text-red-800">
                  ⚠ {result.conflicts.length} possible knowledge contradiction{result.conflicts.length === 1 ? "" : "s"} detected
                </p>
                <p className="mt-1 text-[11px] text-neutral-700">
                  Your new content may disagree with existing knowledge. Review these · edit the source that's wrong · or ignore if both statements are correct in context.
                </p>
                <ul className="mt-3 space-y-2">
                  {result.conflicts.map((c, i) => (
                    <li key={i} className="rounded-lg bg-white p-3 text-[12px]">
                      <p className="font-black text-neutral-900">{c.summary}</p>
                      <p className="mt-1 text-neutral-600">
                        New section: <span className="font-black">"{c.new_section}"</span> · vs · existing file <code className="rounded bg-neutral-100 px-1">{c.existing_file}</code> section <span className="font-black">"{c.existing_section}"</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* AUTHOR DIFF · verify meaning preserved · collapsible */}
            {result.author_diff.length > 0 && (
              <details className="rounded-xl border border-neutral-200 bg-white p-3">
                <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-neutral-500">
                  🔎 Author Diff · see what changed from your raw notes ({result.author_diff.length} sections)
                </summary>
                <div className="mt-3 space-y-3">
                  {result.author_diff.map((d, i) => (
                    <div key={i} className="rounded-lg border border-neutral-200 p-3">
                      <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-neutral-500">{d.published_heading}</p>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="rounded-md bg-neutral-50 p-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Your original</p>
                          <p className="mt-1 whitespace-pre-line text-[12px] text-neutral-700">{d.original_snippet || "(no source phrase captured)"}</p>
                        </div>
                        <div className="rounded-md bg-blue-50 p-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-blue-800">Published</p>
                          <p className="mt-1 whitespace-pre-line text-[12px] text-neutral-800">{d.published_body}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {result && result.ok && "ambiguities" in result && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-900">
              ⚠ Need your judgement · {result.ambiguities.length} ambiguity·ies detected
            </p>
            <p className="mt-1 text-[12px] text-neutral-700">
              The Brain Processor couldn't resolve these with confidence. Reword the source notes to clarify, then re-process.
            </p>
            <ul className="mt-2 space-y-2">
              {result.ambiguities.map((a, i) => (
                <li key={i} className="rounded-lg bg-white p-2 text-[12px]">
                  <p className="font-black text-neutral-900">"{a.phrase}"</p>
                  <p className="text-neutral-600">Possible meanings: {a.options.join(" · ")}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result && !result.ok && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-3">
            <p className="text-[11px] font-black text-red-800">Error: {result.error}</p>
          </div>
        )}
      </div>

      {/* Recent processing history */}
      {recentResults.length > 0 && (
        <div className="mt-5 border-t border-neutral-200 pt-4">
          <p className="mb-2 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
            Recent publications this session
          </p>
          <ul className="space-y-1.5">
            {recentResults.map((r, i) => (
              <li key={i} className="text-[11px]">
                <span className="font-black text-neutral-900">{r.topic}</span>
                <span className="text-neutral-500"> · {r.at} · {r.bullets.slice(0, 2).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
