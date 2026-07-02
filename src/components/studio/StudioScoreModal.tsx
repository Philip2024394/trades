"use client";

// StudioScoreModal — the 6-dimension design score.
//
// Runs the client-side scoring engine (Module 15) on the current
// layout when opened, then renders:
//   • Big overall score ring at top
//   • 6 dimension bars with per-dimension score
//   • Findings grouped by severity (error / warn / info)
//   • Per-section drilldown with expandable finding lists
//
// Deterministic, offline, zero AI required. Later a Module 16+ can add
// an "Improve score" button that routes through the AI Gateway to
// suggest patches for the lowest-scoring dimensions.

import { useMemo, useState } from "react";
import type { StudioLayoutJson } from "@/lib/studio/schema";
import { scorePage } from "@/lib/studio/scoring";
import {
  SCORE_DIMENSIONS,
  SCORE_DIMENSION_LABELS,
  type ScoreDimension,
  type ScoreFinding,
  type SectionScoreResult
} from "@/lib/studio/scoring/types";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const AMBER = "#F59E0B";
const RED = "#DC2626";

function scoreColour(n: number): string {
  if (n >= 80) return GREEN;
  if (n >= 60) return AMBER;
  return RED;
}

function scoreLabel(n: number): string {
  if (n >= 90) return "Excellent";
  if (n >= 80) return "Good";
  if (n >= 60) return "OK";
  if (n >= 40) return "Needs work";
  return "Poor";
}

type Props = {
  layout: StudioLayoutJson;
  onClose: () => void;
  onJumpToSection?: (instanceId: string) => void;
};

export function StudioScoreModal({ layout, onClose, onJumpToSection }: Props) {
  const result = useMemo(() => scorePage(layout), [layout]);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[6vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Design score"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-neutral-200 p-5">
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            ◇ AI Design Score
          </p>
          <h2 className="mt-1 text-[18px] font-extrabold text-neutral-900">
            How this page scores
          </h2>
          <p className="mt-1 text-[12px] text-neutral-500">
            {result.sectionScores.length} section
            {result.sectionScores.length === 1 ? "" : "s"} · {" "}
            {result.pageFindings.length +
              result.sectionScores.reduce(
                (n, s) => n + s.findings.length,
                0
              )}{" "}
            finding
            {result.pageFindings.length +
              result.sectionScores.reduce(
                (n, s) => n + s.findings.length,
                0
              ) ===
            1
              ? ""
              : "s"}
          </p>
        </header>

        <div className="p-5">
          {/* Overall ring + label */}
          <div className="flex items-center gap-6">
            <ScoreRing value={result.overall} />
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                Overall
              </p>
              <p
                className="mt-0.5 text-[24px] font-extrabold"
                style={{ color: scoreColour(result.overall) }}
              >
                {result.overall} / 100
              </p>
              <p className="text-[12px] font-bold text-neutral-600">
                {scoreLabel(result.overall)}
              </p>
            </div>
          </div>

          {/* 6 dimensions */}
          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SCORE_DIMENSIONS.map((dim) => (
              <DimensionBar
                key={dim}
                dimension={dim}
                score={result.dimensions[dim]}
              />
            ))}
          </div>

          {/* Page-level findings */}
          {result.pageFindings.length > 0 && (
            <div className="mt-6">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                Page-level findings
              </p>
              <ul className="mt-2 space-y-2">
                {result.pageFindings.map((f, i) => (
                  <li key={i}>
                    <FindingRow finding={f} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Section-by-section */}
          <div className="mt-6">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              Section scores
            </p>
            <ul className="mt-2 space-y-2">
              {result.sectionScores.map((sec) => (
                <li key={sec.instanceId}>
                  <SectionRow
                    section={sec}
                    open={expanded === sec.instanceId}
                    onToggle={() =>
                      setExpanded(
                        expanded === sec.instanceId ? null : sec.instanceId
                      )
                    }
                    onJump={
                      onJumpToSection
                        ? () => {
                            onJumpToSection(sec.instanceId);
                            onClose();
                          }
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <footer className="flex items-center justify-end border-t border-neutral-200 p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-100"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Ring ────────────────────────────────────────────────────

function ScoreRing({ value }: { value: number }) {
  const size = 90;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 100);
  const colour = scoreColour(value);
  return (
    <svg width={size} height={size} className="shrink-0" viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="#E5E5E5"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={colour}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circ.toFixed(2)}
        strokeDashoffset={offset.toFixed(2)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="52%"
        dominantBaseline="middle"
        textAnchor="middle"
        style={{
          fontSize: 22,
          fontWeight: 900,
          fill: colour,
          fontFamily: "system-ui, sans-serif"
        }}
      >
        {value}
      </text>
    </svg>
  );
}

// ─── Dimension bar ──────────────────────────────────────────

function DimensionBar({
  dimension,
  score
}: {
  dimension: ScoreDimension;
  score: number;
}) {
  const colour = scoreColour(score);
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-700">
          {SCORE_DIMENSION_LABELS[dimension]}
        </p>
        <p
          className="text-[13px] font-extrabold"
          style={{ color: colour }}
        >
          {score}
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full transition-[width] duration-500"
          style={{ width: `${score}%`, background: colour }}
        />
      </div>
    </div>
  );
}

// ─── Section row ────────────────────────────────────────────

function SectionRow({
  section,
  open,
  onToggle,
  onJump
}: {
  section: SectionScoreResult;
  open: boolean;
  onToggle: () => void;
  onJump?: () => void;
}) {
  const colour = scoreColour(section.overall);
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-3 text-left hover:bg-neutral-50"
      >
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white"
          style={{ background: colour }}
        >
          {section.overall}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-extrabold text-neutral-900">
            {section.sectionName}
          </p>
          <p className="truncate font-mono text-[10px] text-neutral-400">
            {section.sectionId}
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-bold text-neutral-500">
          {section.findings.length} finding
          {section.findings.length === 1 ? "" : "s"}
        </span>
        <span
          aria-hidden="true"
          className="text-[13px] text-neutral-400"
        >
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div className="border-t border-neutral-100 bg-neutral-50 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SCORE_DIMENSIONS.map((dim) => (
              <div key={dim} className="rounded-md bg-white px-2 py-1.5">
                <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
                  {SCORE_DIMENSION_LABELS[dim]}
                </p>
                <p
                  className="text-[13px] font-extrabold"
                  style={{ color: scoreColour(section.dimensions[dim]) }}
                >
                  {section.dimensions[dim]}
                </p>
              </div>
            ))}
          </div>

          {section.findings.length > 0 && (
            <ul className="mt-3 space-y-2">
              {section.findings.map((f, i) => (
                <li key={i}>
                  <FindingRow finding={f} />
                </li>
              ))}
            </ul>
          )}

          {onJump && (
            <div className="mt-3 text-right">
              <button
                type="button"
                onClick={onJump}
                className="inline-flex h-8 items-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
                style={{ background: YELLOW }}
              >
                Jump to section →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Finding row ────────────────────────────────────────────

function FindingRow({ finding }: { finding: ScoreFinding }) {
  const glyph =
    finding.severity === "error" ? "⚠" : finding.severity === "warn" ? "⚠" : "ℹ";
  const bg =
    finding.severity === "error"
      ? "rgba(220,38,38,0.08)"
      : finding.severity === "warn"
        ? "rgba(245,158,11,0.10)"
        : "rgba(59,130,246,0.08)";
  const fg =
    finding.severity === "error"
      ? RED
      : finding.severity === "warn"
        ? AMBER
        : "#3B82F6";
  return (
    <div
      className="flex items-start gap-2 rounded-md p-2 text-[12px] leading-relaxed"
      style={{ background: bg, color: fg }}
    >
      <span aria-hidden="true" className="pt-0.5 text-[13px]">
        {glyph}
      </span>
      <p className="flex-1 font-bold">
        {finding.message}{" "}
        <span className="ml-1 text-[10px] font-normal uppercase tracking-widest opacity-70">
          {SCORE_DIMENSION_LABELS[finding.dimension]}
        </span>
      </p>
    </div>
  );
}
