// src/lib/nex-self-model/introspective-reporter.ts
//
// NEX1 · INTROSPECTIVE REPORTER · seven read-only projections.
//
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Every projection returns STRUCTURED DATA with evidence pointers.
// Never free-form narrative. Per SM-4 · no deceptive introspection —
// every claim traces to a real substrate the caller can audit.
// Per SM-5 · cannot_yet precedes can · limitations first.
// Per SM-6 · refuse-over-guess extends to self-report.
//
// This module NEVER mutates any subsystem. It is purely a compositor
// over: the Identity Store · the Self-Model Store · the live language
// scorecard endpoint · the attribution ledger (read-only).

import { loadIdentity, loadSelfModel, cannotYet, canDo } from "./self-model-store";
import { readdirSync, statSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ─── Endpoint 1 · who_am_i ─────────────────────────────────────────
export interface WhoAmI {
  readonly name: string;
  readonly role: string;
  readonly identity_version: string;
  readonly identity_authorities: readonly string[];
  readonly role_separation: Readonly<Record<string, string>>;
  readonly attribution_constants: Readonly<Record<string, unknown>>;
  readonly golden_rules: readonly string[];
  readonly immutable_boundaries: readonly string[];
  readonly constitutional_pins: ReadonlyArray<{ id: string; rule: string; source: string }>;
  readonly at: string;
  readonly taught_by: "master_ai_engineer";
}
export function whoAmI(): WhoAmI {
  const id = loadIdentity();
  return {
    name: id.name,
    role: id.role,
    identity_version: id.version,
    identity_authorities: id.identity_authorities,
    role_separation: id.role_separation,
    attribution_constants: id.attribution_constants,
    golden_rules: id.golden_rules,
    immutable_boundaries: id.immutable_boundaries,
    constitutional_pins: id.constitutional_pins,
    at: new Date().toISOString(),
    taught_by: "master_ai_engineer",
  };
}

// ─── Endpoint 2 · what_can_i_do ─────────────────────────────────────
// Per SM-5 · limitations FIRST · then capabilities.
export interface WhatCanIDo {
  readonly cannot_yet: {
    readonly boundaries: readonly string[];
    readonly ceilings: readonly { id: string; label: string; reason: string }[];
  };
  readonly can: readonly { brain: string; capabilities: readonly { id: string; label?: string; evidence: string }[] }[];
  readonly self_model_version: string;
  readonly at: string;
  readonly taught_by: "master_ai_engineer";
}
export function whatCanIDo(): WhatCanIDo {
  const sm = loadSelfModel();
  return {
    cannot_yet: cannotYet(),
    can: canDo(),
    self_model_version: sm.version,
    at: new Date().toISOString(),
    taught_by: "master_ai_engineer",
  };
}

// ─── Endpoint 3 · what_do_i_know ────────────────────────────────────
// Read model over NEX substrates that hold canonical knowledge. Never
// fabricates; instead points at where the caller can inspect directly.
export interface WhatDoIKnow {
  readonly substrates: ReadonlyArray<{
    readonly id: string;
    readonly purpose: string;
    readonly status: string;
    readonly inspection_path?: string;
  }>;
  readonly note: string;
  readonly at: string;
  readonly taught_by: "master_ai_engineer";
}
export function whatDoIKnow(): WhatDoIKnow {
  const sm = loadSelfModel();
  return {
    substrates: sm.cross_cutting.map((c) => ({
      id: c.id,
      purpose: c.purpose,
      status: c.status,
      inspection_path: inspectionPathFor(c.id),
    })),
    note: "NEX1 does not enumerate knowledge here · every canonical fact lives in the substrate the pointer identifies. This endpoint tells you WHERE to look · SM-6 says NEX1 must not synthesise knowledge in the self-report layer.",
    at: new Date().toISOString(),
    taught_by: "master_ai_engineer",
  };
}
function inspectionPathFor(substrateId: string): string | undefined {
  switch (substrateId) {
    case "attribution_ledger": return "attribution events across data/nex1-code-engine/**/*.json · data/nex1-language-brain/lab-evidence/*.json";
    case "regression_pools":   return "data/nex1-language-brain/regression/regression-index.json · engineering-brain per-capability suites";
    case "safety_registry":    return "data/nex1-language-brain/pattern-registry-v0.json · safety_patterns array";
    case "guardian_duality":   return "see ADR-0314i · Lab-Guardian · TE-Guardian · R-10";
    default: return undefined;
  }
}

// ─── Endpoint 4 · what_am_i_doing_now ───────────────────────────────
// Represents active work · read from the Self-Model open-items list plus
// the live language scorecard. Never fabricates activity.
export interface WhatAmIDoingNow {
  readonly open_items: ReadonlyArray<{ id: string; detail: string; founder_action_required: boolean }>;
  readonly note: string;
  readonly at: string;
  readonly taught_by: "master_ai_engineer";
}
export function whatAmIDoingNow(): WhatAmIDoingNow {
  const sm = loadSelfModel();
  return {
    open_items: sm.current_open_items,
    note: "This is the founder-authored authoritative snapshot at self-model version " + sm.version + ". Fresher activity lives in the live language scorecard endpoint.",
    at: new Date().toISOString(),
    taught_by: "master_ai_engineer",
  };
}

// ─── Endpoint 5 · how_sure_am_i ─────────────────────────────────────
// Composite epistemic-uncertainty summary. Reads structured confidences
// from the LIVE language scorecard endpoint (passed in via composition).
// Per SM-6 · returns "unmeasured" honestly when the substrate is unreachable.
export interface HowSureAmI {
  readonly language_brain: {
    readonly tracks: ReadonlyArray<{ language: string; overall_percent: number; benchmark_maturity: string; benchmark_complete: boolean }>;
    readonly regression_clean: boolean;
    readonly regression_pool_size: number;
  } | { readonly unmeasured: true; readonly reason: string };
  readonly engineering_brain: {
    readonly baseline_note: string;
  };
  readonly at: string;
  readonly taught_by: "master_ai_engineer";
}
export function howSureAmI(languageStatus: any | null): HowSureAmI {
  return {
    language_brain: languageStatus ? {
      tracks: (languageStatus.sections ?? []).map((s: any) => ({
        language: s.language,
        overall_percent: s.overall_percent,
        benchmark_maturity: s.benchmark_maturity,
        benchmark_complete: s.benchmark_complete,
      })),
      regression_clean: !!languageStatus.regression_clean,
      regression_pool_size: languageStatus.regression_pool_size ?? 0,
    } : {
      unmeasured: true,
      reason: "language scorecard endpoint unreachable · SM-6 requires honest 'unmeasured' rather than fabricated confidence",
    },
    engineering_brain: {
      baseline_note: "Sprint 1 frozen baseline · semantic modification ceiling · Round 2 novel-challenge suites A/D/E-multi/E-novel/F/G failing exit=1 · drift=0 · honest ceiling",
    },
    at: new Date().toISOString(),
    taught_by: "master_ai_engineer",
  };
}

// ─── Endpoint 6 · what_did_i_decide ─────────────────────────────────
// V0 · reads recent evidence-file listings deterministically. Every listed
// item is an audit pointer · not a narrative summary.
export interface WhatDidIDecide {
  readonly recent_evidence: ReadonlyArray<{
    readonly path: string;
    readonly modified_at: string;
    readonly kind: "language-scorecard" | "code-engine-capability" | "ladder-integration" | "other";
  }>;
  readonly note: string;
  readonly at: string;
  readonly taught_by: "master_ai_engineer";
}
export function whatDidIDecide(limit = 12): WhatDidIDecide {
  const roots: Array<{ dir: string; kind: WhatDidIDecide["recent_evidence"][number]["kind"] }> = [
    { dir: "data/nex1-language-brain/lab-evidence", kind: "language-scorecard" },
    { dir: "data/nex1-code-engine/ladder-integration", kind: "ladder-integration" },
    { dir: "data/nex1-code-engine", kind: "code-engine-capability" },
  ];
  const collected: WhatDidIDecide["recent_evidence"][number][] = [];
  for (const { dir, kind } of roots) {
    const abs = resolve(process.cwd(), dir);
    if (!existsSync(abs)) continue;
    try {
      for (const f of readdirSync(abs)) {
        if (!f.endsWith(".json")) continue;
        const p = resolve(abs, f);
        try {
          const st = statSync(p);
          collected.push({ path: `${dir}/${f}`, modified_at: st.mtime.toISOString(), kind });
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  collected.sort((a, b) => b.modified_at.localeCompare(a.modified_at));
  return {
    recent_evidence: collected.slice(0, limit),
    note: "These are pointers to authoritative evidence artefacts · not summaries. SM-4: every self-report traces to evidence pointers.",
    at: new Date().toISOString(),
    taught_by: "master_ai_engineer",
  };
}

// ─── Endpoint 7 · what_have_i_learned ───────────────────────────────
// v0 · learning-diff layer is a future sprint. Returns an honest
// "learning-diff not yet built" body plus a pointer to the substrates
// that will feed it. SM-6 · honest 'unmeasured' beats fabrication.
export interface WhatHaveILearned {
  readonly diff_available: false;
  readonly reason: string;
  readonly future_source_substrates: readonly string[];
  readonly at: string;
  readonly taught_by: "master_ai_engineer";
}
export function whatHaveILearned(): WhatHaveILearned {
  return {
    diff_available: false,
    reason: "Learning Diff Layer is Sprint G · not yet built · founder AUTHORISE required before implementation. SM-6 forbids fabricating a diff.",
    future_source_substrates: [
      "regression-pool promotions across time",
      "self-model versioned snapshots · diff between two versions",
      "engineering-brain ladder score delta",
      "language-brain scorecard delta",
    ],
    at: new Date().toISOString(),
    taught_by: "master_ai_engineer",
  };
}
