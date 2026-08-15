// NEX App Builder · Chat surface (Philip 2026-08-14).
//
// The customer-facing entry point to the App Builder engine. Speaks in
// plain English. Technical Blueprint state stays underneath — never
// shown as "identity.displayName REQUIRED" or similar.

"use client";

import { useState, useRef, useEffect } from "react";
import type { AppBlueprint } from "@/lib/app-builder/blueprint-schema";
import type { ChatQuestion } from "@/lib/app-builder/chat/question-generator";

type Msg =
  | { role: "nex"; text: string; kind?: "welcome" | "question" | "info" | "progress" | "preview" | "error" }
  | { role: "customer"; text: string };

type BuildQaShot = { pageId: string; viewport: string; url: string };
type VerdictHighlight = { observation: string; source: string; path?: string; safeValue?: unknown };
type VerdictSummary = {
  worker: string;
  displayName: string;
  status: "ok" | "warn" | "blocked" | "failed";
  state: "HEALTHY" | "DEGRADED" | "BLOCKED_INPUT" | "BLOCKED_CONFIG" | "BLOCKED_UPSTREAM" | "FAILED" | "PENDING" | "UNKNOWN";
  diagnosis: string;
  decision: string;
  evidenceCount: number;
  evidenceHighlights: VerdictHighlight[];
  durationMs: number;
};
type OperatorVerdictSurface = {
  runId: string;
  ranAt: string;
  overall: string;
  totalDurationMs: number;
  verdicts: VerdictSummary[];
  counts: Record<VerdictSummary["state"], number>;
};
type BuildResult = {
  overall: string;
  pages: Array<{ id: string; sectionCount: number }>;
  qa: { pass: number; fail: number; screenshots: BuildQaShot[]; failures: Array<{ pageId: string; detail?: string }> } | null;
  surface?: { overall: string; sections: Array<{ heading: string; items: Array<{ symbol: string; text: string }> }>; actionItems: Array<{ priority: string; text: string }> };
  verdicts?: OperatorVerdictSurface;
};

type TemplateCandidate = { id: string; label: string; description: string };

// Emoji-only glyphs — kept in the client so a slow-network user still sees
// the cards while templates load. The template list itself comes from the
// server (single source of truth in intent-router.ts).
const TEMPLATE_GLYPH: Record<string, string> = {
  staircase: "🪜",
  plumbing: "🔧",
  electrician: "⚡",
  kitchen: "🍳",
  photographer: "📷",
  furniture: "🪑",
  renderer: "🧱"
};

const WELCOME =
  "Hi. I can build you a website. Pick a category below, or tell me what your business does in your own words.";

export function AppBuilderChat() {
  const [messages, setMessages] = useState<Msg[]>([{ role: "nex", text: WELCOME, kind: "welcome" }]);
  const [input, setInput] = useState("");
  const [blueprint, setBlueprint] = useState<AppBlueprint | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<ChatQuestion | null>(null);
  const [readyToBuild, setReadyToBuild] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
  const [templateChoices, setTemplateChoices] = useState<TemplateCandidate[] | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<{ slug: string; redirectTo: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, building, buildResult, templateChoices]);

  // On mount, ask the server for the full starter-template catalog and
  // show it as landscape cards. Falls back silently on error (the free-text
  // prompt still works).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/nex-app-builder/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "welcome" })
        }).then((r) => r.json());
        if (!cancelled && res?.ok && Array.isArray(res.templates)) {
          setTemplateChoices(res.templates);
        }
      } catch {
        // silent — free-text prompt still works
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function sendPromptOrAnswer(text: string) {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "customer", text }]);
    setInput("");

    // If we're ready to build and the user affirms in natural language,
    // trigger the build instead of routing "yes" back into the intent
    // classifier (which returns the starter message and confuses the flow).
    if (readyToBuild && !pendingQuestion && blueprint && isAffirmative(text)) {
      await build();
      return;
    }

    // If a question is pending, treat this as the answer
    if (pendingQuestion && blueprint) {
      const res = await fetch("/api/nex-app-builder/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "answer", blueprint, answer: { fieldPath: pendingQuestion.fieldPath, value: text } })
      }).then((r) => r.json());

      if (!res.ok) {
        setMessages((m) => [...m, { role: "nex", text: res.hint ?? "That didn't quite work — try again?", kind: "error" }]);
        return;
      }
      setBlueprint(res.blueprint);
      setPendingQuestion(res.nextQuestion);
      setReadyToBuild(res.readyToBuild);
      setMessages((m) => [...m, { role: "nex", text: res.say, kind: res.readyToBuild ? "info" : "question" }]);
      return;
    }

    // Otherwise, treat as an initial prompt
    const res = await fetch("/api/nex-app-builder/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "prompt", prompt: text })
    }).then((r) => r.json());

    if (!res.ok) {
      setMessages((m) => [...m, { role: "nex", text: "Something went wrong. Try again?", kind: "error" }]);
      return;
    }

    if (res.kind === "matched") {
      // Phase 20 · unique-slug suffix per session (see pickTemplate).
      // Publish requires lowercase-hyphen slugs — no underscores allowed.
      const safeBaseId = String(res.blueprint.id ?? "app").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      const uniqueId = `${safeBaseId}-${Date.now().toString(36)}`;
      const uniqueBlueprint = { ...res.blueprint, id: uniqueId };
      setBlueprint(uniqueBlueprint);
      setPendingQuestion(res.nextQuestion);
      setReadyToBuild(res.readyToBuild);
      setTemplateChoices(null);
      setMessages((m) => [...m, { role: "nex", text: res.say, kind: res.nextQuestion ? "question" : "info" }]);
    } else if (res.kind === "ambiguous" || res.kind === "unknown") {
      setTemplateChoices(res.candidates ?? res.suggestions);
      setMessages((m) => [...m, { role: "nex", text: res.say, kind: "info" }]);
    } else if (res.kind === "empty") {
      // Free text was too short to route — re-surface the full template
      // catalog so the user can pick instead of guessing what to type.
      try {
        const welcome = await fetch("/api/nex-app-builder/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "welcome" })
        }).then((r) => r.json());
        if (welcome?.ok && Array.isArray(welcome.templates)) {
          setTemplateChoices(welcome.templates);
        }
      } catch { /* silent */ }
      setMessages((m) => [...m, { role: "nex", text: res.say, kind: "info" }]);
    } else {
      setMessages((m) => [...m, { role: "nex", text: res.say ?? "Tell me a bit more.", kind: "info" }]);
    }
  }

  async function pickTemplate(templateId: string) {
    setTemplateChoices(null);
    setMessages((m) => [...m, { role: "customer", text: `I want a ${templateId} website` }]);
    const res = await fetch("/api/nex-app-builder/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "pick-template", templateId })
    }).then((r) => r.json());
    if (res.ok) {
      // Phase 20 · every publish gets its own slug. Template blueprints
      // ship with hard-coded ids like "ab_staircase_completed"; without a
      // suffix the second publish in the same server session collides
      // with the first (registerBusiness returns 409). Suffix is
      // deterministic per browser session: `-<base36-timestamp>`.
      // Publish requires lowercase-hyphen slugs — no underscores allowed.
      const safeBaseId = String(res.blueprint.id ?? "app").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      const uniqueId = `${safeBaseId}-${Date.now().toString(36)}`;
      const uniqueBlueprint = { ...res.blueprint, id: uniqueId };
      setBlueprint(uniqueBlueprint);
      setPendingQuestion(res.nextQuestion);
      setReadyToBuild(res.readyToBuild);
      setMessages((m) => [...m, { role: "nex", text: res.say, kind: res.nextQuestion ? "question" : "info" }]);
    }
  }

  async function publish() {
    if (!blueprint) return;
    setPublishing(true);
    setMessages((m) => [...m, { role: "nex", text: "Publishing — registering your business and preparing your NEX workspace…", kind: "progress" }]);
    const res = await fetch("/api/nex-app-builder/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blueprint })
    }).then((r) => r.json());
    setPublishing(false);
    if (!res.ok) {
      setMessages((m) => [...m, { role: "nex", text: `Publish failed: ${res.error ?? "unknown error"}`, kind: "error" }]);
      return;
    }
    setPublished({ slug: res.slug, redirectTo: res.redirectTo });
    setMessages((m) => [...m, { role: "nex", text: res.say ?? `Published as "${res.slug}". Opening your workspace…`, kind: "info" }]);
    // Give the operator a beat to see the message, then hand off. Same-tab
    // navigation carries the signed owner cookie set by the publish route.
    window.setTimeout(() => { window.location.href = res.redirectTo; }, 600);
  }

  async function build() {
    if (!blueprint) return;
    setBuilding(true);
    setBuildResult(null);
    setMessages((m) => [...m, { role: "nex", text: "Building your website — this takes about 20 seconds while I check it in a real browser.", kind: "progress" }]);
    const res = await fetch("/api/nex-app-builder/build", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blueprint, executeQA: true })
    }).then((r) => r.json());
    setBuilding(false);
    if (!res.ok) {
      setMessages((m) => [...m, { role: "nex", text: "Build failed — sorry. Try again in a moment?", kind: "error" }]);
      return;
    }
    setBuildResult(res);
    const summary = `Done. Built ${res.pages.length} pages. Ran ${res.qa?.pass ?? 0} checks in a real browser — ${res.qa?.fail ?? 0} failed.`;
    setMessages((m) => [...m, { role: "nex", text: summary, kind: "preview" }]);
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px", fontFamily: "Inter, system-ui, sans-serif", color: "#1a1a1a" }}>
      <header style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 2, color: "#8a8a8a" }}>NEX App Builder</div>
        <h1 style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 600 }}>Build a website by chatting</h1>
      </header>

      <div ref={scrollRef} style={{ background: "#fafafa", border: "1px solid #e5e5e5", borderRadius: 12, padding: 16, height: "60vh", overflowY: "auto" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "customer" ? "flex-end" : "flex-start", marginBottom: 10 }}>
            <div style={{
              background: m.role === "customer" ? "#F97316" : "#fff",
              color: m.role === "customer" ? "#fff" : "#1a1a1a",
              padding: "10px 14px",
              borderRadius: 12,
              maxWidth: "78%",
              border: m.role === "customer" ? "none" : "1px solid #e5e5e5",
              fontSize: 15,
              lineHeight: 1.4,
              whiteSpace: "pre-wrap"
            }}>
              {m.text}
            </div>
          </div>
        ))}
        {templateChoices && templateChoices.length > 0 && (
          <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {templateChoices.map((c) => (
              <button
                key={c.id}
                onClick={() => pickTemplate(c.id)}
                data-testid={`template-card-${c.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  textAlign: "left",
                  padding: "14px 16px",
                  background: "#fff",
                  border: "1px solid #d4d4d4",
                  borderRadius: 12,
                  cursor: "pointer",
                  transition: "border-color 120ms, box-shadow 120ms"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#F97316"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(249,115,22,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#d4d4d4"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{
                  width: 44, height: 44, flexShrink: 0,
                  background: "#FEF3EC", borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22
                }} aria-hidden>
                  {TEMPLATE_GLYPH[c.id] ?? "🌐"}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a" }}>{c.label}</div>
                  <div style={{ fontSize: 12, color: "#666", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{c.description}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        {building && (
          <div style={{ background: "#fff8f0", border: "1px solid #F97316", borderRadius: 10, padding: 12, marginTop: 12, fontSize: 14 }}>
            🔨 Building & checking in Chromium…
          </div>
        )}
        {buildResult && (
          <div style={{ marginTop: 16, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#888", marginBottom: 8 }}>Preview · desktop screenshots</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {buildResult.qa?.screenshots.filter((s) => s.viewport === "desktop").map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener" style={{ display: "block" }}>
                  <img src={s.url} alt={s.pageId} style={{ width: "100%", height: 160, objectFit: "cover", border: "1px solid #ddd", borderRadius: 6 }} />
                  <div style={{ fontSize: 12, textAlign: "center", marginTop: 4, color: "#666" }}>{s.pageId}</div>
                </a>
              ))}
            </div>
            {buildResult.qa && buildResult.qa.fail > 0 && (
              <div style={{ marginTop: 12, padding: 10, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 13 }}>
                <strong>{buildResult.qa.fail} issue(s) to fix:</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                  {buildResult.qa.failures.slice(0, 5).map((f, i) => (
                    <li key={i}>{f.pageId}: {f.detail}</li>
                  ))}
                </ul>
              </div>
            )}
            {buildResult.verdicts && <VerdictPanel surface={buildResult.verdicts} />}
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={publish}
                disabled={publishing || !!published}
                data-testid="publish-app"
                style={{
                  padding: "12px 22px",
                  fontSize: 15,
                  fontWeight: 700,
                  background: published ? "#a3a3a3" : "#166534",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  cursor: published || publishing ? "default" : "pointer"
                }}
              >
                {published ? `Published as "${published.slug}"` : publishing ? "Publishing…" : "Publish this app"}
              </button>
              <div style={{ fontSize: 12, color: "#666" }}>
                {published
                  ? "Opening your workspace…"
                  : "Registers the business and hands you the owner workspace."}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <input
          type={pendingQuestion?.inputKind === "email" ? "email" : pendingQuestion?.inputKind === "tel" ? "tel" : pendingQuestion?.inputKind === "number" ? "number" : "text"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") sendPromptOrAnswer(input); }}
          placeholder={pendingQuestion?.placeholder ?? "Tell me about your business"}
          disabled={building}
          style={{ flex: 1, padding: "12px 14px", fontSize: 15, border: "1px solid #d4d4d4", borderRadius: 10, outline: "none" }}
        />
        <button
          onClick={() => sendPromptOrAnswer(input)}
          disabled={building || !input.trim()}
          style={{ padding: "12px 20px", fontSize: 15, fontWeight: 600, background: "#F97316", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer" }}
        >
          Send
        </button>
        {readyToBuild && (
          <button
            onClick={build}
            disabled={building}
            style={{ padding: "12px 20px", fontSize: 15, fontWeight: 600, background: "#166534", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer" }}
          >
            {building ? "Building…" : "Build & preview"}
          </button>
        )}
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: "#888", textAlign: "center" }}>
        NEX runs locally · your data isn't sent to third-party AI services · Playwright renders in a real browser
      </div>
    </div>
  );
}

// Natural-language affirmatives that mean "yes, start the build".
// Kept small and specific — anything ambiguous should fall through to the
// intent router so the operator gets a helpful message rather than a
// wrong-turn build.
const AFFIRMATIVES = new Set([
  "y", "yes", "yeah", "yep", "yup", "ok", "okay", "sure",
  "go", "build", "ready", "do it", "let's go", "lets go",
  "start", "begin", "build it", "confirmed", "confirm"
]);
function isAffirmative(text: string): boolean {
  return AFFIRMATIVES.has(text.trim().toLowerCase());
}

// ─── Phase 19C · Operator verdict panel ──────────────────────────────
//
// Renders the 8-state evidence taxonomy for the six workers. Never
// summarises or reinterprets — shows exactly what each worker emitted.
// Colour is a hint; the diagnosis + decision are the payload.

const STATE_COLOUR: Record<VerdictSummary["state"], { bg: string; border: string; text: string; label: string }> = {
  HEALTHY:          { bg: "#f0fdf4", border: "#86efac", text: "#166534", label: "Healthy" },
  DEGRADED:         { bg: "#fefce8", border: "#fde047", text: "#854d0e", label: "Degraded" },
  BLOCKED_INPUT:    { bg: "#fff7ed", border: "#fdba74", text: "#9a3412", label: "Needs input" },
  BLOCKED_CONFIG:   { bg: "#eff6ff", border: "#93c5fd", text: "#1e3a8a", label: "Needs config" },
  BLOCKED_UPSTREAM: { bg: "#f5f3ff", border: "#c4b5fd", text: "#5b21b6", label: "Blocked upstream" },
  FAILED:           { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", label: "Failed" },
  PENDING:          { bg: "#f8fafc", border: "#cbd5e1", text: "#334155", label: "Pending" },
  UNKNOWN:          { bg: "#fafafa", border: "#d4d4d4", text: "#525252", label: "Unknown" }
};

function VerdictPanel({ surface }: { surface: OperatorVerdictSurface }) {
  return (
    <div data-testid="verdict-panel" style={{ marginTop: 12, padding: 12, background: "#fafafa", border: "1px solid #e5e5e5", borderRadius: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div data-testid="verdict-overall" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#666" }}>NEX diagnostics · {surface.overall}</div>
        <div style={{ fontSize: 11, color: "#888" }}>{surface.totalDurationMs}ms · run {surface.runId}</div>
      </div>
      {surface.verdicts.map((v) => {
        const c = STATE_COLOUR[v.state];
        return (
          <div key={v.worker} data-testid={`verdict-card-${v.worker}`} data-state={v.state} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 6, padding: 10, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div data-testid={`verdict-card-${v.worker}-name`} style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{v.displayName}</div>
              <div data-testid={`verdict-card-${v.worker}-chip`} style={{ fontSize: 11, fontWeight: 600, color: c.text, background: "#fff", padding: "2px 8px", borderRadius: 10, border: `1px solid ${c.border}` }}>
                {c.label}
              </div>
            </div>
            <div data-testid={`verdict-card-${v.worker}-diagnosis`} style={{ fontSize: 13, color: "#333", marginBottom: 4 }}>
              <strong>Diagnosis.</strong> {v.diagnosis}
            </div>
            <div data-testid={`verdict-card-${v.worker}-decision`} style={{ fontSize: 13, color: "#333", marginBottom: v.evidenceHighlights.length > 0 ? 6 : 0 }}>
              <strong>Next.</strong> {v.decision}
            </div>
            {v.evidenceHighlights.length > 0 && (
              <details data-testid={`verdict-card-${v.worker}-evidence`} style={{ marginTop: 4 }}>
                <summary style={{ cursor: "pointer", fontSize: 12, color: "#555" }}>
                  {v.evidenceCount} evidence record(s) · show highlights
                </summary>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "#555" }}>
                  {v.evidenceHighlights.map((h, i) => (
                    <li key={i} style={{ marginBottom: 3 }}>
                      <span style={{ color: "#888" }}>[{h.source}{h.path ? ` · ${h.path}` : ""}]</span> {h.observation}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
