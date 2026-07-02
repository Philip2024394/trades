"use client";

// StudioBrandExtractWizard — paste-existing-URL → review candidates →
// apply as brand tokens.
//
// Zero cold-start friction. Merchants who already have a live site
// (WordPress, Wix, Squarespace, plain HTML) get colours + fonts +
// (later) icons + logos seeded from their existing brand in one flow.
//
// The wizard NEVER auto-applies. Merchant reviews each candidate,
// ticks the ones they want, hits Apply — those POST individually to
// /api/studio/tokens (Module 4).

import { useState } from "react";
import type { BrandExtractionCandidates } from "@/lib/studio/brandExtractor";
import { contrastRatio, gradeContrast } from "@/lib/studio/scoring/contrast";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const RED = "#DC2626";
const BLUE = "#3B82F6";
const AMBER = "#F59E0B";

type Phase =
  | { kind: "idle" }
  | { kind: "fetching"; url: string }
  | { kind: "results"; candidates: BrandExtractionCandidates }
  | { kind: "error"; message: string }
  | { kind: "applied"; applied: string[]; failed: string[] };

export function StudioBrandExtractWizard() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function extract() {
    setPhase({ kind: "fetching", url });
    try {
      const res = await fetch("/api/studio/brand/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const json = (await res.json()) as
        | { ok: true; candidates: BrandExtractionCandidates }
        | { ok: false; error: string };
      if (!res.ok || !json.ok) {
        setPhase({
          kind: "error",
          message: "error" in json ? json.error : `HTTP ${res.status}`
        });
        return;
      }
      // Auto-tick every returned token candidate.
      setSelected(new Set(Object.keys(json.candidates.tokens)));
      setPhase({ kind: "results", candidates: json.candidates });
    } catch (err) {
      setPhase({
        kind: "error",
        message: (err as Error)?.message ?? "network"
      });
    }
  }

  async function applySelected() {
    if (phase.kind !== "results") return;
    const tokens = phase.candidates.tokens;
    const applied: string[] = [];
    const failed: string[] = [];
    for (const key of Object.keys(tokens)) {
      if (!selected.has(key)) continue;
      const value = tokens[key as keyof typeof tokens];
      if (value === undefined) continue;
      // Split "kind.key" → the tokens API expects those as separate fields.
      const [kind, subkey] = key.split(".");
      try {
        const res = await fetch("/api/studio/tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, key: subkey, value })
        });
        const json = (await res.json()) as { ok: boolean };
        if (res.ok && json.ok) applied.push(key);
        else failed.push(key);
      } catch {
        failed.push(key);
      }
    }
    setPhase({ kind: "applied", applied, failed });
  }

  function reset() {
    setUrl("");
    setSelected(new Set());
    setPhase({ kind: "idle" });
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div>
        <p
          className="text-[10px] font-extrabold uppercase tracking-widest"
          style={{ color: YELLOW }}
        >
          Brand extractor
        </p>
        <p className="mt-0.5 text-[12px] text-neutral-500">
          Already have a live site? Paste its URL — we&rsquo;ll pull colours and
          fonts to seed your Studio brand.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && url.trim()) void extract();
          }}
          placeholder="https://yourbusiness.co.uk"
          className="h-10 flex-1 rounded-lg border border-neutral-300 bg-white px-3 text-[13px] font-medium focus:border-neutral-500 focus:outline-none"
          disabled={phase.kind === "fetching"}
        />
        {phase.kind === "results" || phase.kind === "applied" ? (
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center rounded-xl border border-neutral-300 px-3 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-50"
          >
            Start over
          </button>
        ) : (
          <button
            type="button"
            onClick={extract}
            disabled={!url.trim() || phase.kind === "fetching"}
            className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:brightness-110"
            style={{ background: "#0A0A0A" }}
          >
            {phase.kind === "fetching" ? "Fetching…" : "Analyse →"}
          </button>
        )}
      </div>

      {phase.kind === "error" && (
        <p
          role="alert"
          className="mt-4 rounded-xl px-3 py-2 text-[12px] font-bold"
          style={{ background: "rgba(220,38,38,0.08)", color: RED }}
        >
          Extraction failed · {phase.message}
        </p>
      )}

      {phase.kind === "fetching" && (
        <p
          className="mt-4 rounded-xl px-3 py-2 text-[12px] font-bold"
          style={{ background: "rgba(59,130,246,0.08)", color: BLUE }}
        >
          Fetching {phase.url}…
        </p>
      )}

      {phase.kind === "results" && (
        <ResultsPanel
          candidates={phase.candidates}
          selected={selected}
          onToggle={(key) => {
            setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            });
          }}
          onApply={applySelected}
        />
      )}

      {phase.kind === "applied" && (
        <AppliedPanel applied={phase.applied} failed={phase.failed} onReset={reset} />
      )}
    </section>
  );
}

// ─── Results panel ───────────────────────────────────────────

function ResultsPanel({
  candidates,
  selected,
  onToggle,
  onApply
}: {
  candidates: BrandExtractionCandidates;
  selected: Set<string>;
  onToggle: (key: string) => void;
  onApply: () => void;
}) {
  const tokenEntries = Object.entries(candidates.tokens);

  return (
    <>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {tokenEntries.map(([key, value]) => (
          <CandidateRow
            key={key}
            tokenKey={key}
            value={value as string}
            selected={selected.has(key)}
            onToggle={() => onToggle(key)}
            allTokens={candidates.tokens}
          />
        ))}
      </div>

      {candidates.raw.colors.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            All colours we found ({candidates.raw.colors.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {candidates.raw.colors.map((c) => (
              <span
                key={c.hex}
                title={`${c.hex} · seen ${c.count}× `}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2 py-1"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-4 w-4 rounded-full border border-neutral-300"
                  style={{ background: c.hex }}
                />
                <span className="font-mono text-[10px] font-bold text-neutral-700">
                  {c.hex}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">
                  {c.count}×
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {candidates.raw.fonts.length > 0 && (
        <p className="mt-3 text-[11px] text-neutral-500">
          Google Fonts detected:{" "}
          <span className="font-mono font-bold text-neutral-800">
            {candidates.raw.fonts.join(", ")}
          </span>
        </p>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onApply}
          disabled={selected.size === 0}
          className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:brightness-110"
          style={{ background: GREEN }}
        >
          Apply {selected.size} candidate{selected.size === 1 ? "" : "s"} →
        </button>
      </div>
    </>
  );
}

function CandidateRow({
  tokenKey,
  value,
  selected,
  onToggle,
  allTokens
}: {
  tokenKey: string;
  value: string;
  selected: boolean;
  onToggle: () => void;
  allTokens: BrandExtractionCandidates["tokens"];
}) {
  const isColour = tokenKey.startsWith("color.");
  // For colours, compute contrast against the surface candidate (or
  // the merchant's existing white as a fallback) so the merchant sees
  // whether the pair passes WCAG AA before applying.
  const surface = (allTokens["color.surface"] as string | undefined) ?? "#FFFFFF";
  const contrast = isColour ? contrastRatio(value, surface) : 0;
  const grade = isColour && contrast > 0 ? gradeContrast(contrast) : null;
  const gradeColour =
    grade === "AAA"
      ? GREEN
      : grade === "AA" || grade === "AA-large"
        ? AMBER
        : RED;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition"
      style={{
        borderColor: selected ? "#0A0A0A" : "#E5E5E5",
        background: selected ? "rgba(10,10,10,0.03)" : "#FFFFFF"
      }}
    >
      <span
        aria-hidden="true"
        className="grid h-5 w-5 shrink-0 place-items-center rounded border-2 text-[11px] font-extrabold"
        style={{
          borderColor: selected ? "#0A0A0A" : "#A3A3A3",
          background: selected ? "#0A0A0A" : "#FFFFFF",
          color: selected ? "#FFFFFF" : "transparent"
        }}
      >
        ✓
      </span>
      {isColour ? (
        <span
          aria-hidden="true"
          className="inline-block h-10 w-10 shrink-0 rounded-lg border border-neutral-300"
          style={{ background: value }}
        />
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-neutral-300 bg-neutral-50 text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
          Font
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] font-bold text-neutral-500">
          {tokenKey}
        </p>
        <p className="truncate text-[12px] font-extrabold text-neutral-900">
          {value}
        </p>
        {grade && (
          <p
            className="mt-0.5 text-[10px] font-bold"
            style={{ color: gradeColour }}
          >
            Contrast on surface: {contrast.toFixed(2)}:1 · {grade}
          </p>
        )}
      </div>
    </button>
  );
}

function AppliedPanel({
  applied,
  failed,
  onReset
}: {
  applied: string[];
  failed: string[];
  onReset: () => void;
}) {
  return (
    <div
      className="mt-4 rounded-xl border p-4"
      style={{
        borderColor: failed.length ? "rgba(220,38,38,0.20)" : "rgba(16,185,129,0.20)",
        background: failed.length ? "rgba(220,38,38,0.04)" : "rgba(16,185,129,0.04)"
      }}
    >
      <p className="text-[13px] font-extrabold" style={{ color: GREEN }}>
        ✓ Applied {applied.length} token{applied.length === 1 ? "" : "s"} to your brand
      </p>
      {failed.length > 0 && (
        <p className="mt-1 text-[12px] font-bold" style={{ color: RED }}>
          {failed.length} token{failed.length === 1 ? "" : "s"} failed to save.
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-9 items-center rounded-xl border border-neutral-300 px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-50"
        >
          Start over
        </button>
      </div>
    </div>
  );
}
