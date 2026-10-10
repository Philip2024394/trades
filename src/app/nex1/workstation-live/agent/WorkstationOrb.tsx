"use client";

// src/app/nex1/workstation-live/agent/WorkstationOrb.tsx
//
// NEX1 · Workstation Orb · visual layer over already-real capabilities.
// Founder-authorised 2026-09-19 (Step 8 · locked roadmap).
//
// FOUNDER CONSTITUTION
//   ORB = UNDERSTAND / POINT / EXPLAIN / OFFER
//   ORB ≠ silently click / silently decide / silently change project
//
//   Rule 6 · absolute · every action requires an explicit customer click on
//   the real underlying control. The Orb only:
//     1. reads the canonical semantic graph
//     2. lists customer-facing capabilities honestly (available / not-yet)
//     3. accepts an intent question and resolves it deterministically
//     4. HIGHLIGHTS the real DOM target for the customer to press themselves
//
// NEVER SILENTLY:
//   · invokes another button
//   · changes activeProjectId
//   · fires Save / Run / Verify / Export
//   · modifies preview state
//   · sends chat messages
//
// The Orb is a MAGNIFYING GLASS, not a hand.

import { useEffect, useMemo, useState } from "react";
import {
  listUiElements,
  seedWorkstationUiTargets,
  type SemanticUiElement,
} from "@/lib/nex-registry/nex-ui-semantic-graph";
import {
  resolveIntentGrounded,
  type LiveUiState,
  type GroundedIntentResolutionOutcome,
} from "@/lib/nex-registry/nex-guide";

// ── Live-DOM probe (real querySelectorAll · never fabricated) ─────────
function probeLiveState(): LiveUiState {
  const visible = new Set<string>();
  if (typeof document !== "undefined") {
    for (const el of Array.from(document.querySelectorAll("[data-nex-ui]"))) {
      const attr = el.getAttribute("data-nex-ui");
      if (!attr) continue;
      const selector = `[data-nex-ui="${attr}"]`;
      // "Visible" means: attached to the document AND (for buttons) not disabled.
      // The Orb never asserts visual bounding-box visibility · that's a browser
      // decision. Attachment + not-disabled is the honest floor.
      const isDisabled = (el as HTMLButtonElement).disabled === true;
      if (!isDisabled) visible.add(selector);
    }
  }
  return {
    visible_selectors: visible,
    probed_at_iso: new Date().toISOString(),
    viewport: "desktop",
  };
}

// ── Temporary DOM highlight (no click · no invocation) ────────────────
function highlightTarget(cssSelector: string, durationMs: number = 3200): void {
  if (typeof document === "undefined") return;
  const el = document.querySelector(cssSelector) as HTMLElement | null;
  if (!el) return;
  const prevOutline = el.style.outline;
  const prevOffset = el.style.outlineOffset;
  const prevBox = el.style.boxShadow;
  const prevTransition = el.style.transition;
  el.style.outline = "3px solid #4ac9ff";
  el.style.outlineOffset = "3px";
  el.style.boxShadow = "0 0 0 6px rgba(74,201,255,0.28), 0 0 24px rgba(74,201,255,0.55)";
  el.style.transition = "outline 200ms ease, box-shadow 300ms ease";
  // Restore after duration · never permanent
  window.setTimeout(() => {
    el.style.outline = prevOutline;
    el.style.outlineOffset = prevOffset;
    el.style.boxShadow = prevBox;
    el.style.transition = prevTransition;
  }, durationMs);
}

// ── Small orb chip · always visible in the workstation ────────────────
export function WorkstationOrb() {
  const [open, setOpen] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [intent, setIntent] = useState("");
  const [outcome, setOutcome] = useState<GroundedIntentResolutionOutcome | null>(null);
  const [elements, setElements] = useState<readonly SemanticUiElement[]>([]);

  // The semantic graph is seeded once per module load; ensure it's ready.
  useEffect(() => {
    if (!seeded) {
      // Only seed if the graph is empty · never overwrite an existing seed.
      const existing = listUiElements({ scope: "workstation" });
      if (existing.length === 0) seedWorkstationUiTargets();
      setElements(listUiElements({ scope: "workstation" }));
      setSeeded(true);
    }
  }, [seeded]);

  const { available, unavailable } = useMemo(() => {
    const av: SemanticUiElement[] = [];
    const un: SemanticUiElement[] = [];
    for (const el of elements) {
      if (el.availability === "not_available") un.push(el);
      else av.push(el);
    }
    return { available: av, unavailable: un };
  }, [elements]);

  const handleAsk = () => {
    const text = intent.trim();
    if (text.length === 0) {
      setOutcome(null);
      return;
    }
    const live = probeLiveState();
    const r = resolveIntentGrounded({ text, scope: "workstation", live_state: live });
    setOutcome(r);
    if (r.outcome === "RESOLVED" && r.target.css_selector) {
      highlightTarget(r.target.css_selector);
    }
  };

  return (
    <div
      data-nex-ui="workstation-nex-orb"
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 800,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {open && (
        <div
          role="dialog"
          aria-label="NEX Orb · Guide"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            right: 0,
            bottom: 60,
            width: 380,
            maxHeight: "70vh",
            overflowY: "auto",
            background: "rgba(15,15,20,0.98)",
            color: "#eaeaea",
            border: "1px solid rgba(74,201,255,0.28)",
            borderRadius: 12,
            padding: 16,
            boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 4px rgba(74,201,255,0.08)",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "#4ac9ff" }}>
            NEX Orb · Guide
          </div>
          <div style={{ opacity: 0.7, marginBottom: 10 }}>
            I point at real controls. I never press them. Rule 6 · you decide.
          </div>

          {/* Ask input */}
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAsk(); }}
              placeholder="How do I…?"
              data-nex-ui="workstation-orb-input"
              style={{
                width: "100%",
                padding: "8px 10px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 6,
                color: "#eaeaea",
                fontSize: 12,
                fontFamily: "inherit",
              }}
            />
            <button
              type="button"
              onClick={handleAsk}
              data-nex-ui="workstation-orb-ask"
              style={{
                marginTop: 6,
                width: "100%",
                padding: "6px 10px",
                background: "rgba(74,201,255,0.14)",
                border: "1px solid rgba(74,201,255,0.4)",
                borderRadius: 6,
                color: "#4ac9ff",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >Point me to it</button>
          </div>

          {/* Resolution outcome · honest 4-state display */}
          {outcome && (
            <div
              data-nex-ui="workstation-orb-outcome"
              style={{
                marginBottom: 12,
                padding: 10,
                background: outcome.outcome === "RESOLVED" ? "rgba(74,201,255,0.08)"
                  : outcome.outcome === "AMBIGUOUS" ? "rgba(251,191,60,0.08)"
                  : "rgba(248,113,113,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
              }}
            >
              {outcome.outcome === "RESOLVED" && (
                <>
                  <div style={{ color: "#4ac9ff", fontWeight: 600 }}>Found: {outcome.target.customer_label}</div>
                  <div style={{ opacity: 0.75, marginTop: 4 }}>{outcome.target.purpose}</div>
                  <div style={{ opacity: 0.5, marginTop: 4, fontSize: 11 }}>The control is highlighted on screen · press it yourself.</div>
                </>
              )}
              {outcome.outcome === "AMBIGUOUS" && (
                <>
                  <div style={{ color: "#fbbf3c", fontWeight: 600 }}>Several matches · which one?</div>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {outcome.candidates.map((c) => (
                      <li key={c.ui_element_id}>{c.customer_label} — {c.purpose}</li>
                    ))}
                  </ul>
                </>
              )}
              {outcome.outcome === "NOT_AVAILABLE" && (
                <>
                  <div style={{ color: "#f87171", fontWeight: 600 }}>Not available right now</div>
                  <div style={{ opacity: 0.75, marginTop: 4 }}>
                    NEX knows what you mean, but the control isn&apos;t currently in this Workstation.
                  </div>
                  {outcome.matched_but_not_live.length > 0 && (
                    <div style={{ opacity: 0.6, marginTop: 6, fontSize: 11 }}>
                      Semantic matches (not yet live): {outcome.matched_but_not_live.map((m) => m.customer_label).join(" · ")}
                    </div>
                  )}
                </>
              )}
              {outcome.outcome === "NOT_FOUND" && (
                <>
                  <div style={{ color: "#f87171", fontWeight: 600 }}>Not found</div>
                  <div style={{ opacity: 0.75, marginTop: 4 }}>{outcome.rationale}</div>
                </>
              )}
            </div>
          )}

          {/* Available capabilities · real DOM targets */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#4ac9ff", marginBottom: 4 }}>Available now ({available.length})</div>
            <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11 }}>
              {available.map((el) => (
                <li key={el.ui_element_id} style={{ marginBottom: 3 }}>
                  <button
                    type="button"
                    onClick={() => { if (el.css_selector) highlightTarget(el.css_selector); }}
                    title={`Point at "${el.customer_label}" · ${el.purpose}`}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#eaeaea",
                      padding: 0,
                      fontSize: 11,
                      cursor: el.css_selector ? "pointer" : "default",
                      fontFamily: "inherit",
                      textAlign: "left",
                    }}
                  >{el.customer_label}</button>
                  <span style={{ opacity: 0.5 }}> — {el.purpose.slice(0, 60)}{el.purpose.length > 60 ? "…" : ""}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Unavailable · honestly displayed */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#f87171", marginBottom: 4 }}>Not yet available ({unavailable.length})</div>
            <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11, opacity: 0.7 }}>
              {unavailable.map((el) => (
                <li key={el.ui_element_id} style={{ marginBottom: 3 }}>
                  <span style={{ textDecoration: "line-through" }}>{el.customer_label}</span>
                  <span style={{ opacity: 0.7 }}> — {el.purpose.slice(0, 60)}{el.purpose.length > 60 ? "…" : ""}</span>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: 12, textAlign: "right" }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "#eaeaea",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >Close</button>
          </div>
        </div>
      )}

      {/* The Orb chip itself · click to open */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-nex-ui="workstation-nex-orb-toggle"
        title="NEX Orb · point at controls · never presses them"
        aria-label="NEX Orb · open guide"
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "1px solid rgba(74,201,255,0.55)",
          background: "radial-gradient(circle at 40% 35%, rgba(147,225,255,0.95), rgba(74,201,255,0.85) 40%, rgba(30,90,140,0.75) 100%)",
          color: "#0b1220",
          fontSize: 18,
          fontWeight: 800,
          boxShadow: "0 0 0 4px rgba(74,201,255,0.14), 0 8px 28px rgba(74,201,255,0.32)",
          cursor: "pointer",
        }}
      >◉</button>
    </div>
  );
}
