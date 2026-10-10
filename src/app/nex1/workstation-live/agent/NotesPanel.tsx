"use client";

// src/app/nex1/workstation-live/agent/NotesPanel.tsx
//
// NEX1 · Agent 9 · Session Historian · 2026-09-17.
// Founder-authorised via frontier §17 queue after C10 Phase 2.
//
// PURPOSE
//   Surfaces the C10 knowledge graph as a founder-facing panel · Preferences,
//   Corrections, Refused prompts, Unresolved questions. Read-only view · the
//   graph itself lives server-side and auto-populates from real turns
//   (`capability-conversation-detectors.ts` + orchestrator wire).
//
//   Endpoint: GET /api/nex1/conversation-graph?conversation_id=<task_id>
//
// DISCIPLINE · zero LLM · zero fabricated content · every row comes straight
// from the graph snapshot. No client-side inference · no synthesised text.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface FounderPreference {
  id: string;
  text: string;
  captured_turn: number;
  captured_at: string;
  kind: "explicit" | "inferred";
  derived_from_thread_id: string | null;
}
interface RefusedPrompt {
  turn: number;
  at: string;
  prompt: string;
  reason: string;
  detail: string | null;
}
interface UnresolvedQuestion {
  id: string;
  asked_turn: number;
  asked_at: string;
  question: string;
  asked_by: "nex1" | "system";
  resolved: boolean;
  resolved_turn: number | null;
  resolved_answer: string | null;
}
interface Correction {
  turn: number;
  at: string;
  kind: "intent" | "target" | "value" | "wording" | "other";
  from_value: string;
  to_value: string;
  context: string | null;
}

interface GraphSnapshot {
  ok: true;
  source: "NEX1_NATIVE";
  zero_llm: true;
  snapshot: {
    conversation_id: string;
    turn_id: number;
    active_target: string | null;
    active_thread_id: string | null;
    counts: {
      bindings: number;
      threads: number;
      preferences: number;
      refused_prompts: number;
      unresolved_questions: number;
      resolved_questions: number;
      corrections: number;
      decisions: number;
      mutations: number;
    };
    preferences: FounderPreference[];
    refused_prompts: RefusedPrompt[];
    unresolved_questions: UnresolvedQuestion[];
    resolved_questions: UnresolvedQuestion[];
    corrections: Correction[];
    bindings: unknown[];
  };
}

interface Props {
  activeTaskId: string | null;
}

interface Suggestion {
  suggested_slug: string | null;
  confidence: number;
  matched_keywords: string[];
  ranked_alternatives: { slug: string; matched: string[]; score: number }[];
  source_normalised: string;
}

const TEACH_SLUG_CHOICES = [
  "fix_bug", "add_feature", "explain",
  "refactor", "add_test", "add_migration", "add_api_route",
] as const;

export function NotesPanel({ activeTaskId }: Props) {
  const [snapshot, setSnapshot] = useState<GraphSnapshot["snapshot"] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error" | "no_task">("idle");
  const [error, setError] = useState<string>("");
  const [reloadTick, setReloadTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  // C2 Phase 4 · teach-from-refused UI state
  const [teachingKey, setTeachingKey] = useState<string | null>(null);
  const [teachSuggestion, setTeachSuggestion] = useState<Suggestion | null>(null);
  const [teachSource, setTeachSource] = useState<string>("");
  const [teachSlug, setTeachSlug] = useState<string>("fix_bug");
  const [teachStatus, setTeachStatus] = useState<"idle" | "loading" | "posting" | "done" | "error">("idle");
  const [taughtKeys, setTaughtKeys] = useState<Set<string>>(new Set());
  // Auto-suggest banner state · closes the C10→C2 self-improvement loop.
  const [bannerDismissed, setBannerDismissed] = useState<Set<string>>(new Set());
  const [bannerSuggestions, setBannerSuggestions] = useState<Map<string, Suggestion>>(new Map());
  const [bannerPosting, setBannerPosting] = useState<string | null>(null);
  const [bannerTaught, setBannerTaught] = useState<Set<string>>(new Set());
  // Per-banner slug override · founder can pick a different target without
  // dismissing the banner. Falls back to the suggestion's slug when unset.
  const [bannerSlugChoice, setBannerSlugChoice] = useState<Map<string, string>>(new Map());
  // Verdict-history · chronological envelope trail for the active task.
  interface HistoryEntry { ts: string; envelope: { verdict?: string; confidence?: number; reason?: string; next_action_hint?: string | null } }
  const [envelopeHistory, setEnvelopeHistory] = useState<HistoryEntry[]>([]);
  // Dismissed-banner management · full list of persistent dismissals so
  // founder can restore any of them. Fetched alongside the initial hydration.
  const [persistedDismissals, setPersistedDismissals] = useState<string[]>([]);
  const [dismissalsCollapsed, setDismissalsCollapsed] = useState<boolean>(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    if (!activeTaskId) {
      setStatus("no_task");
      setSnapshot(null);
      return;
    }
    setStatus("loading");
    setError("");
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const u = new URL("/api/nex1/conversation-graph", window.location.origin);
      u.searchParams.set("conversation_id", activeTaskId);
      const res = await fetch(u.toString(), { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as GraphSnapshot;
      if (!data.ok || !data.snapshot) throw new Error("bad response shape");
      setSnapshot(data.snapshot);
      setStatus("ok");
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
      setError(String((e as Error)?.message ?? e));
      setStatus("error");
    }
  }, [activeTaskId]);

  // Auto-fetch on mount + on task change + on manual reload.
  useEffect(() => { void fetchSnapshot(); }, [fetchSnapshot, reloadTick]);

  // Fetch verdict history for the active task · every submit + every
  // classification generates one envelope, so multi-round tasks show a trail.
  useEffect(() => {
    if (!activeTaskId) { setEnvelopeHistory([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const u = new URL("/api/nex1/envelope-history", window.location.origin);
        u.searchParams.set("task_id", activeTaskId);
        const res = await fetch(u.toString(), { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data.ok && Array.isArray(data.entries)) {
          setEnvelopeHistory(data.entries as HistoryEntry[]);
        }
      } catch { /* soft-fail · panel just shows empty trail */ }
    })();
    return () => { cancelled = true; };
  }, [activeTaskId, reloadTick]);

  // Hydrate persistent banner dismissals once on mount so "Not this one"
  // clicks from prior sessions still suppress the banner. Also populates the
  // manage-dismissals list so the founder can restore.
  const refreshDismissals = useCallback(async () => {
    try {
      const res = await fetch("/api/nex1/banner-dismissals", { cache: "no-store" });
      const data = await res.json();
      if (data.ok && Array.isArray(data.prefixes)) {
        setBannerDismissed(new Set(data.prefixes.filter((p: unknown): p is string => typeof p === "string")));
        setPersistedDismissals(data.prefixes.filter((p: unknown): p is string => typeof p === "string").sort());
      }
    } catch { /* soft-fail · session-only fallback still works */ }
  }, []);
  useEffect(() => { void refreshDismissals(); }, [refreshDismissals]);

  const restoreDismissal = useCallback(async (prefix: string) => {
    setRestoring(prefix);
    try {
      await fetch("/api/nex1/banner-dismissals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix }),
      });
      // Optimistic: drop from local state, then re-fetch to confirm.
      setBannerDismissed((prev) => { const next = new Set(prev); next.delete(prefix); return next; });
      setPersistedDismissals((prev) => prev.filter((p) => p !== prefix));
      await refreshDismissals();
    } catch { /* stay in current state · founder can retry */ }
    setRestoring(null);
  }, [refreshDismissals]);

  const total = useMemo(() => {
    if (!snapshot) return 0;
    const c = snapshot.counts;
    return c.preferences + c.corrections + c.refused_prompts + c.unresolved_questions + c.resolved_questions;
  }, [snapshot]);

  // C2 Phase 4 · teach-from-refused handlers ────────────────────────────
  const deriveInitialSource = useCallback((prompt: string): string => {
    // Take first 2 meaningful words as the initial source (founder can edit).
    const cleaned = prompt.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    const words = cleaned.split(" ").filter((w) => w.length > 1);
    return words.slice(0, 2).join(" ") || prompt.slice(0, 30);
  }, []);

  const openTeach = useCallback(async (key: string, prompt: string) => {
    setTeachingKey(key);
    setTeachStatus("loading");
    setTeachSuggestion(null);
    setTeachSource(deriveInitialSource(prompt));
    try {
      const res = await fetch("/api/nex1/paraphrase/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase: prompt }),
      });
      const data = await res.json();
      if (data.ok) {
        const s: Suggestion = {
          suggested_slug: data.suggested_slug ?? null,
          confidence: data.confidence ?? 0,
          matched_keywords: data.matched_keywords ?? [],
          ranked_alternatives: data.ranked_alternatives ?? [],
          source_normalised: data.source_normalised ?? "",
        };
        setTeachSuggestion(s);
        if (s.suggested_slug) setTeachSlug(s.suggested_slug);
      }
      setTeachStatus("idle");
    } catch {
      setTeachStatus("error");
    }
  }, [deriveInitialSource]);

  const cancelTeach = useCallback(() => {
    setTeachingKey(null);
    setTeachSuggestion(null);
    setTeachSource("");
    setTeachStatus("idle");
  }, []);

  // ── Auto-suggest banner logic ──────────────────────────────────────
  // Deterministic prefix extractor · same shape as deriveInitialSource
  // but exposed so the banner and the group key stay in lock-step.
  const prefixOf = useCallback((prompt: string): string => {
    const cleaned = prompt.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    const words = cleaned.split(" ").filter((w) => w.length > 1);
    return words.slice(0, 2).join(" ");
  }, []);

  // Group current refused_prompts by first-2-token prefix. Only surface a
  // banner when a prefix appears ≥ 2 times · the founder said this twice, we
  // should stop refusing next time.
  const banners = useMemo(() => {
    if (!snapshot) return [] as { prefix: string; count: number; example: string }[];
    const groups = new Map<string, { count: number; example: string }>();
    for (const r of snapshot.refused_prompts) {
      const p = prefixOf(r.prompt);
      if (!p) continue;
      const g = groups.get(p);
      if (g) { g.count += 1; } else { groups.set(p, { count: 1, example: r.prompt }); }
    }
    return Array.from(groups.entries())
      .filter(([p, g]) => g.count >= 2 && !bannerDismissed.has(p) && !bannerTaught.has(p))
      .sort((a, b) => b[1].count - a[1].count)
      .map(([prefix, g]) => ({ prefix, count: g.count, example: g.example }));
  }, [snapshot, bannerDismissed, bannerTaught, prefixOf]);

  // Fetch suggestion for any banner we haven't cached yet.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const b of banners) {
        if (bannerSuggestions.has(b.prefix)) continue;
        try {
          const res = await fetch("/api/nex1/paraphrase/suggest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phrase: b.example }),
          });
          const data = await res.json();
          if (cancelled) return;
          if (data.ok) {
            setBannerSuggestions((prev) => {
              const next = new Map(prev);
              next.set(b.prefix, {
                suggested_slug: data.suggested_slug ?? null,
                confidence: data.confidence ?? 0,
                matched_keywords: data.matched_keywords ?? [],
                ranked_alternatives: data.ranked_alternatives ?? [],
                source_normalised: data.source_normalised ?? "",
              });
              return next;
            });
          }
        } catch { /* soft-fail · banner stays without suggestion */ }
      }
    })();
    return () => { cancelled = true; };
  }, [banners, bannerSuggestions]);

  const dismissBanner = useCallback((prefix: string) => {
    // Optimistic UI · update state immediately.
    setBannerDismissed((prev) => {
      const next = new Set(prev);
      next.add(prefix);
      return next;
    });
    // Fire-and-forget durable append. Failure keeps in-session dismissal
    // but next reload the banner would return · acceptable soft-fail.
    void fetch("/api/nex1/banner-dismissals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix }),
    }).catch(() => { /* silent */ });
  }, []);

  const acceptBanner = useCallback(async (prefix: string, slug: string) => {
    setBannerPosting(prefix);
    try {
      const res = await fetch("/api/nex1/paraphrase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: prefix,
          target_slug: slug,
          provenance: `founder taught via auto-suggest banner · ${new Date().toISOString()}`,
          kind: "founder_correction",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setBannerTaught((prev) => {
          const next = new Set(prev);
          next.add(prefix);
          return next;
        });
      }
    } catch { /* swallow · founder can retry */ }
    setBannerPosting(null);
  }, []);

  const confirmTeach = useCallback(async (key: string) => {
    if (!teachSource.trim()) { setTeachStatus("error"); return; }
    setTeachStatus("posting");
    try {
      const res = await fetch("/api/nex1/paraphrase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: teachSource.trim(),
          target_slug: teachSlug,
          provenance: `founder taught via NotesPanel · refused-prompt · ${new Date().toISOString()}`,
          kind: "founder_correction",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTaughtKeys((prev) => new Set(prev).add(key));
        setTeachStatus("done");
        setTimeout(() => cancelTeach(), 800);
      } else {
        setTeachStatus("error");
      }
    } catch {
      setTeachStatus("error");
    }
  }, [teachSource, teachSlug, cancelTeach]);

  return (
    <div className="naw-notes-root">
      <div className="naw-notes-header">
        <div>
          <div className="naw-notes-title">NEX1's Notes</div>
          <div className="naw-notes-sub">
            {activeTaskId ? <>task <code>{activeTaskId.slice(0, 8)}…</code> · {total} record{total === 1 ? "" : "s"}</> : "no active task"}
          </div>
        </div>
        <button
          type="button"
          className="naw-notes-reload"
          onClick={() => setReloadTick((n) => n + 1)}
          disabled={status === "loading" || !activeTaskId}
          title="Refresh notes"
        >↻</button>
      </div>

      {status === "no_task" && (
        <div className="naw-notes-empty">
          Pick a task from the History tab or type a new prompt · NEX1 will
          collect preferences, corrections, refused prompts, and unresolved
          questions here as you work.
        </div>
      )}
      {status === "loading" && !snapshot && (
        <div className="naw-notes-empty">Loading …</div>
      )}
      {status === "error" && (
        <div className="naw-notes-error">Error · {error} · hit ↻ to retry.</div>
      )}

      {snapshot && (
        <div className="naw-notes-body">
          {/* Preferences */}
          <div className="naw-notes-section">
            <div className="naw-notes-section-title">
              <span>◇ Preferences</span>
              <span className="naw-notes-count">{snapshot.preferences.length}</span>
            </div>
            {snapshot.preferences.length === 0 && (
              <div className="naw-notes-hint">
                Say "always use X not Y", "prefer X over Y", or "never use Z" and I'll remember it here.
              </div>
            )}
            {snapshot.preferences.map((p) => (
              <div key={p.id} className="naw-notes-item naw-notes-item--pref">
                <div className="naw-notes-item-body">{p.text}</div>
                <div className="naw-notes-item-meta">
                  <span className="naw-notes-tag">{p.kind}</span>
                  <span>turn {p.captured_turn}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Corrections */}
          <div className="naw-notes-section">
            <div className="naw-notes-section-title">
              <span>⇄ Corrections</span>
              <span className="naw-notes-count">{snapshot.corrections.length}</span>
            </div>
            {snapshot.corrections.length === 0 && (
              <div className="naw-notes-hint">
                Say "actually X, not Y" or pick a clarification option · corrections land here.
              </div>
            )}
            {snapshot.corrections.map((c, i) => (
              <div key={i} className="naw-notes-item naw-notes-item--corr">
                <div className="naw-notes-item-body">
                  <span className="naw-corr-from">{c.from_value}</span>
                  <span className="naw-corr-arrow"> → </span>
                  <span className="naw-corr-to">{c.to_value}</span>
                </div>
                <div className="naw-notes-item-meta">
                  <span className="naw-notes-tag">{c.kind}</span>
                  <span>turn {c.turn}</span>
                  {c.context && <span className="naw-notes-context" title={c.context}>{c.context.slice(0, 40)}{c.context.length > 40 ? "…" : ""}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Unresolved questions */}
          <div className="naw-notes-section">
            <div className="naw-notes-section-title">
              <span>? Unresolved questions</span>
              <span className="naw-notes-count naw-notes-count--amber">{snapshot.unresolved_questions.length}</span>
            </div>
            {snapshot.unresolved_questions.length === 0 && (
              <div className="naw-notes-hint">Nothing pending · NEX1 has no open questions.</div>
            )}
            {snapshot.unresolved_questions.map((q) => (
              <div key={q.id} className="naw-notes-item naw-notes-item--q">
                <div className="naw-notes-item-body">{q.question}</div>
                <div className="naw-notes-item-meta">
                  <span className="naw-notes-tag">{q.asked_by}</span>
                  <span>turn {q.asked_turn}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Resolved questions · shown collapsed count only */}
          {snapshot.resolved_questions.length > 0 && (
            <div className="naw-notes-section">
              <div className="naw-notes-section-title">
                <span>✓ Resolved questions</span>
                <span className="naw-notes-count naw-notes-count--green">{snapshot.resolved_questions.length}</span>
              </div>
              {snapshot.resolved_questions.slice(0, 5).map((q) => (
                <div key={q.id} className="naw-notes-item naw-notes-item--resolved">
                  <div className="naw-notes-item-body">
                    <span style={{ opacity: 0.55 }}>Q:</span> {q.question}
                    <br />
                    <span style={{ opacity: 0.55 }}>A:</span> {q.resolved_answer}
                  </div>
                  <div className="naw-notes-item-meta">
                    <span>asked turn {q.asked_turn}</span>
                    <span>resolved turn {q.resolved_turn ?? "?"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Auto-suggest banners · closes the C10→C2 self-improvement loop */}
          {banners.length > 0 && (
            <div className="naw-notes-section">
              <div className="naw-notes-section-title">
                <span>💡 NEX1 noticed a pattern</span>
                <span className="naw-notes-count naw-notes-count--amber">{banners.length}</span>
              </div>
              {banners.map((b) => {
                const s = bannerSuggestions.get(b.prefix);
                const suggested = s?.suggested_slug ?? "fix_bug";
                const chosen = bannerSlugChoice.get(b.prefix) ?? suggested;
                const posting = bannerPosting === b.prefix;
                return (
                  <div key={b.prefix} className="naw-banner">
                    <div className="naw-banner-body">
                      <span className="naw-banner-icon">💡</span>
                      <div className="naw-banner-text">
                        You&apos;ve said <code>&quot;{b.prefix}&quot;</code> {b.count} times · shall I map it to <strong>{chosen}</strong>?
                        {s && s.matched_keywords.length > 0 && (
                          <div className="naw-banner-hint">
                            matched keywords: {s.matched_keywords.slice(0, 3).join(", ")}
                            {suggested !== chosen && <span> · you&apos;re overriding NEX1&apos;s suggestion (<em>{suggested}</em>)</span>}
                          </div>
                        )}
                        {s && !s.suggested_slug && (
                          <div className="naw-banner-hint">(no keyword hit · pick a slug and I&apos;ll teach it)</div>
                        )}
                      </div>
                    </div>
                    <div className="naw-banner-actions">
                      <select
                        className="naw-banner-select"
                        value={chosen}
                        disabled={posting}
                        onChange={(e) => {
                          const v = e.target.value;
                          setBannerSlugChoice((prev) => { const next = new Map(prev); next.set(b.prefix, v); return next; });
                        }}
                        title="Change the target intent · overrides NEX1's suggestion"
                      >
                        {TEACH_SLUG_CHOICES.map((sl) => (
                          <option key={sl} value={sl}>{sl}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="naw-banner-dismiss"
                        onClick={() => dismissBanner(b.prefix)}
                        disabled={posting}
                        title="Not this one · don't nag me about this prefix again this session"
                      >Not this one</button>
                      <button
                        type="button"
                        className="naw-banner-accept"
                        onClick={() => void acceptBanner(b.prefix, chosen)}
                        disabled={posting}
                      >{posting ? "Teaching…" : `Teach as ${chosen} →`}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Refused prompts */}
          <div className="naw-notes-section">
            <div className="naw-notes-section-title">
              <span>✕ Refused prompts</span>
              <span className="naw-notes-count naw-notes-count--red">{snapshot.refused_prompts.length}</span>
            </div>
            {snapshot.refused_prompts.length === 0 && (
              <div className="naw-notes-hint">No refusals so far · NEX1 has classified every prompt.</div>
            )}
            {snapshot.refused_prompts.map((r, i) => {
              const key = `${r.turn}:${i}`;
              const isTeaching = teachingKey === key;
              const wasTaught = taughtKeys.has(key);
              return (
                <div key={key} className="naw-notes-item naw-notes-item--refused">
                  <div className="naw-notes-item-body">"{r.prompt}"</div>
                  <div className="naw-notes-item-meta">
                    <span className="naw-notes-tag naw-notes-tag--red">{r.reason}</span>
                    <span>turn {r.turn}</span>
                    {r.detail && <span className="naw-notes-context" title={r.detail}>{r.detail.slice(0, 40)}{r.detail.length > 40 ? "…" : ""}</span>}
                    {!isTeaching && !wasTaught && (
                      <button
                        type="button"
                        className="naw-notes-teach-btn"
                        onClick={() => void openTeach(key, r.prompt)}
                        title="Teach NEX1 what this phrase means so it doesn't refuse next time"
                      >Teach ↗</button>
                    )}
                    {wasTaught && <span className="naw-notes-taught-badge">✓ taught</span>}
                  </div>
                  {isTeaching && (
                    <div className="naw-notes-teach-panel">
                      <div className="naw-notes-teach-row">
                        <label>Source phrase</label>
                        <input
                          type="text"
                          value={teachSource}
                          onChange={(e) => setTeachSource(e.target.value)}
                          placeholder="e.g. sort out"
                          className="naw-notes-teach-input"
                        />
                      </div>
                      <div className="naw-notes-teach-row">
                        <label>Maps to intent</label>
                        <select
                          value={teachSlug}
                          onChange={(e) => setTeachSlug(e.target.value)}
                          className="naw-notes-teach-select"
                        >
                          {TEACH_SLUG_CHOICES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      {teachSuggestion?.suggested_slug && (
                        <div className="naw-notes-teach-hint">
                          <span>NEX1 suggests: <strong>{teachSuggestion.suggested_slug}</strong></span>
                          {teachSuggestion.matched_keywords.length > 0 && (
                            <span> · matched: {teachSuggestion.matched_keywords.slice(0, 3).join(", ")}</span>
                          )}
                        </div>
                      )}
                      {teachStatus === "loading" && <div className="naw-notes-teach-hint">Loading suggestion…</div>}
                      {teachStatus === "error" && <div className="naw-notes-teach-error">Something went wrong · try again.</div>}
                      <div className="naw-notes-teach-actions">
                        <button
                          type="button"
                          className="naw-notes-teach-cancel"
                          onClick={cancelTeach}
                          disabled={teachStatus === "posting"}
                        >Cancel</button>
                        <button
                          type="button"
                          className="naw-notes-teach-confirm"
                          onClick={() => void confirmTeach(key)}
                          disabled={teachStatus === "posting" || !teachSource.trim()}
                        >{teachStatus === "posting" ? "Teaching…" : teachStatus === "done" ? "Taught ✓" : "Teach"}</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Dismissed banner patterns · restore any that no longer apply */}
          {persistedDismissals.length > 0 && (
            <div className="naw-notes-section">
              <button
                type="button"
                className="naw-notes-section-title naw-dismissed-toggle"
                onClick={() => setDismissalsCollapsed((c) => !c)}
                aria-expanded={!dismissalsCollapsed}
              >
                <span>{dismissalsCollapsed ? "▸" : "▾"} Dismissed patterns</span>
                <span className="naw-notes-count">{persistedDismissals.length}</span>
              </button>
              {!dismissalsCollapsed && (
                <>
                  <div className="naw-notes-hint">
                    Founder said &quot;not this one&quot; · pattern won&apos;t auto-suggest until restored.
                  </div>
                  {persistedDismissals.map((prefix) => (
                    <div key={prefix} className="naw-dismissed-item">
                      <code className="naw-dismissed-prefix">&quot;{prefix}&quot;</code>
                      <button
                        type="button"
                        className="naw-dismissed-restore"
                        onClick={() => void restoreDismissal(prefix)}
                        disabled={restoring === prefix}
                        title="Restore · next occurrence will surface a banner again"
                      >{restoring === prefix ? "Restoring…" : "Restore ↺"}</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Verdict trail · every envelope for this task in chronological order */}
          <div className="naw-notes-section">
            <div className="naw-notes-section-title">
              <span>◐ Verdict trail</span>
              <span className="naw-notes-count">{envelopeHistory.length}</span>
            </div>
            {envelopeHistory.length === 0 && (
              <div className="naw-notes-hint">
                Each classification / plan / refusal for this task lands here with its confidence and next-action hint.
              </div>
            )}
            {envelopeHistory.map((h, i) => {
              const v = h.envelope?.verdict ?? "unknown";
              const conf = typeof h.envelope?.confidence === "number" ? Math.round(h.envelope.confidence * 100) : null;
              return (
                <div key={h.ts + ":" + i} className={`naw-verdict-item naw-verdict-${v.replace(/_/g, "-")}`}>
                  <div className="naw-verdict-header">
                    <span className="naw-verdict-badge">{v}</span>
                    {conf !== null && <span className="naw-verdict-conf">{conf}%</span>}
                    <span className="naw-verdict-ts">{new Date(h.ts).toLocaleTimeString()}</span>
                  </div>
                  {h.envelope?.reason && <div className="naw-verdict-reason">{h.envelope.reason}</div>}
                  {h.envelope?.next_action_hint && (
                    <div className="naw-verdict-hint">→ {h.envelope.next_action_hint}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer · counts + zero-LLM assurance */}
          <div className="naw-notes-footer">
            <span>{snapshot.counts.bindings} bindings · {snapshot.counts.threads} threads · {snapshot.counts.decisions} decisions · {snapshot.counts.mutations} mutations</span>
            <span className="naw-notes-badge">NEX1_NATIVE · zero LLM</span>
          </div>
        </div>
      )}
    </div>
  );
}
