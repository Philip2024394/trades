"use client";

// src/app/nexapp/nex-agent/SeoAgentPanel.tsx
//
// SEO Agent side panel · lists actionable SEO suggestions for the current
// project · one "flashes" for 20 seconds when a task completes to signal
// "NEX just introduced this into your code".

import { useEffect, useMemo, useState } from "react";
import {
  detectProjectType,
  suggestSeo,
  pickIntroductionFlash,
  type SeoSuggestion,
} from "@/lib/nex-agent/seo-agent";

export interface SeoAgentPanelProps {
  readonly activePrompt: string;
  readonly activeTaskId: string | null;
  readonly taskStatus: string | null;
  readonly pageFiles: readonly string[];
}

const DISMISSED_KEY = "naw:seo:dismissed";
const FLASH_MS = 20_000;

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) as string[] : []);
  } catch { return new Set(); }
}

function saveDismissed(s: Set<string>): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(s))); } catch { /* */ }
}

export function SeoAgentPanel({ activePrompt, activeTaskId, taskStatus, pageFiles }: SeoAgentPanelProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [flashId, setFlashId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<boolean>(true);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  useEffect(() => { setDismissed(loadDismissed()); }, []);

  const ctx = useMemo(() => detectProjectType({
    prompt: activePrompt || "",
    pageFiles,
  }), [activePrompt, pageFiles]);

  const suggestions = useMemo(() => suggestSeo(ctx, 20).filter((s) => !dismissed.has(s.id)), [ctx, dismissed]);

  // When task reaches applied state, flash one suggestion for 20s
  useEffect(() => {
    if (!activeTaskId) return;
    if (taskStatus !== "applied_verified" && taskStatus !== "applied_needs_review") return;
    if (suggestions.length === 0) return;
    const pick = pickIntroductionFlash(suggestions, activeTaskId);
    if (!pick) return;
    setFlashId(pick.id);
    const t = setTimeout(() => setFlashId(null), FLASH_MS);
    return () => clearTimeout(t);
  }, [activeTaskId, taskStatus, suggestions]);

  const dismiss = (id: string) => {
    setDismissed((prev) => { const n = new Set(prev); n.add(id); saveDismissed(n); return n; });
  };

  return (
    <section className="naw-side-section">
      <button
        type="button"
        className="naw-side-section-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="naw-side-section-icon" style={{ color: "#22C55E" }}>◎</span>
        <span className="naw-side-section-title">SEO Agent</span>
        <span className="naw-side-section-count">{suggestions.length}</span>
        <span className="naw-side-section-toggle">{expanded ? "▼" : "▶"}</span>
      </button>
      {expanded && (
        <div className="naw-side-section-body">
          <div className="naw-seo-context">
            <span className="naw-seo-context-label">Project</span>
            <span className="naw-seo-context-value">{ctx.projectType}</span>
            {ctx.hasNextJs && <span className="naw-seo-context-chip">Next.js</span>}
          </div>
          {suggestions.length === 0 ? (
            <div className="naw-seo-empty">
              All suggestions dismissed · type a prompt to reset context.
            </div>
          ) : (
            <ul className="naw-seo-list">
              {suggestions.slice(0, 20).map((s) => {
                const isFlashing = flashId === s.id;
                const isOpen = expandedItemId === s.id;
                return (
                  <li
                    key={s.id}
                    className={`naw-seo-item severity-${s.severity} ${isFlashing ? "flashing" : ""}`}
                    onClick={() => setExpandedItemId(isOpen ? null : s.id)}
                  >
                    <div className="naw-seo-item-head">
                      <span className={`naw-seo-severity naw-seo-severity-${s.severity}`}>{s.severity}</span>
                      <span className="naw-seo-item-title">{s.title}</span>
                      <button
                        type="button"
                        className="naw-seo-dismiss"
                        onClick={(e) => { e.stopPropagation(); dismiss(s.id); }}
                        title="Dismiss this suggestion permanently"
                        aria-label={`Dismiss ${s.title}`}
                      >×</button>
                    </div>
                    <div className="naw-seo-item-category">{s.category.replace(/-/g, " ")}</div>
                    {isFlashing && (
                      <div className="naw-seo-item-flash-label">
                        ✨ Introduced by NEX1
                      </div>
                    )}
                    {isOpen && (
                      <div className="naw-seo-item-detail">
                        <div className="naw-seo-item-rationale">{s.rationale}</div>
                        {s.example && (
                          <pre className="naw-seo-item-example">{s.example}</pre>
                        )}
                        {s.targetFile && (
                          <div className="naw-seo-item-target">Target: <code>{s.targetFile}</code></div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
