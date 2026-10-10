// src/lib/nex-agent/code-engine/capability-post-verdict-reflection.ts
//
// NEX1 · Iteration 4 · ε · Post-verdict reflection substrate (Ledger B).
//
// PURPOSE
//   When a verdict lands with matched=false, this capability auto-invokes
//   the BRB neurologist + pathology + boundary_interface specialists on
//   the recent verdict window, extracts a structural finding, and
//   persists a ReflectionEntry keyed by the exact feature-vector the
//   brain saw at prediction time.
//
//   The persisted entry contains ONLY:
//     · the observation-features the brain had (no engineer interpretation)
//     · the specialists' emitted `kind` values (no Claude-authored labels)
//     · counts (matched/failed/unknown) from the local verdict window
//     · timestamps + provenance
//
//   Nothing in the entry names a "missing feature" or a "root cause".
//   Retrieval consumers see structural evidence, not conclusions.
//
// R11-B: reflection entries are INFERRED evidence · never SUPPORTING.
// Zero-LLM. Deterministic.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { registerAgent, recordHeartbeat } from "./capability-agent-registry";
import { loadAllVerdicts, recordVerdict as rawRecordVerdict, type PredictionVerdictEntry, type PredictionFeatures } from "./capability-prediction-verdict-store";
import { getSpecialist } from "./brb/capability-brb-network-router";

registerAgent({
  id: "post_verdict_reflection",
  name: "Post-verdict reflection · auto-invokes specialists on matched=false",
  cognitive_layer: "metacognition",
  description: "When a verdict is recorded with matched=false, invokes neurologist + pathology + boundary_interface specialists on the recent verdict window. Persists their structural findings keyed by observation-features. Emits no diagnostic vocabulary.",
});

// ── Types ──────────────────────────────────────────────────────────────

export interface ReflectionEntry {
  readonly entry_id: string;
  readonly reflection_key: string;           // sha16 of canonicalised features
  readonly timestamp: string;                // ISO
  readonly triggering_verdict_id: string;
  readonly triggering_features: PredictionFeatures;
  readonly window_size: number;              // # verdicts in the window
  readonly window_matched: number;
  readonly window_failed: number;
  readonly window_unknown: number;
  readonly specialist_findings: ReadonlyArray<{
    readonly specialist_id: string;
    readonly kind: string;                    // whatever the specialist emitted · never Claude-authored
    readonly confidence: number;
  }>;
  readonly evidence_kind: "INFERRED";
  readonly r11b_marker: "REFLECTION_MUST_NOT_ENTER_R4_SUPPORTING_COUNT";
}

// ── Paths ──────────────────────────────────────────────────────────────

export function getReflectionsPath(repo_root?: string): string {
  const rr = repo_root ?? process.cwd();
  return path.join(rr, "data", "nex1-reflections", "entries.jsonl");
}

// ── Key derivation ────────────────────────────────────────────────────

export function reflectionKey(features: PredictionFeatures): string {
  const keys = Object.keys(features).sort();
  const canonical = "{" + keys.map((k) => JSON.stringify(k) + ":" + JSON.stringify(features[k])).join(",") + "}";
  return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

// ── Reflection · triggered from recordVerdictWithReflection ────────────

function loadRecentVerdictsForFeatures(features: PredictionFeatures, repo_root?: string, limit = 50): readonly PredictionVerdictEntry[] {
  const key = reflectionKey(features);
  const all = loadAllVerdicts(repo_root);
  const matching = all.filter((v) => reflectionKey(v.features_the_brain_had_at_prediction_time) === key);
  return matching.slice(Math.max(0, matching.length - limit));
}

function invokeSpecialistsOnWindow(
  window: readonly PredictionVerdictEntry[],
): ReflectionEntry["specialist_findings"] {
  const specialistsToConsult = ["neurologist", "brain_pathology_specialist", "boundary_interface_specialist"];
  const findings: Array<{ specialist_id: string; kind: string; confidence: number }> = [];

  // Compose the input each specialist expects · uniform, no per-specialist tailoring
  const records = window.map((v) => ({
    features: v.features_the_brain_had_at_prediction_time,
    prediction_label: v.prediction_label,
    prediction_confidence: v.prediction_confidence,
    matched: v.matched,
    timestamp: v.timestamp_predicted,
  }));
  const failed = records.filter((r) => r.matched === false);

  const input = {
    verdict_records: records,
    records,
    failed_records: failed,
    // boundary_interface expects expected/provided fields · we pass the
    // brain's own feature keys as both, so it can compare cell coherence.
    expected_fields: window.length > 0 ? Object.keys(window[0].features_the_brain_had_at_prediction_time) : [],
    provided_fields: window.length > 0 ? Object.keys(window[0].features_the_brain_had_at_prediction_time) : [],
  };

  for (const sid of specialistsToConsult) {
    const brain = getSpecialist(sid);
    if (!brain) continue;
    try {
      const a = brain.analyse(input);
      findings.push({ specialist_id: a.specialist_id, kind: a.kind, confidence: a.confidence });
    } catch {
      // silent · specialists must not break the reflection pipeline
    }
  }
  return findings;
}

/**
 * The wrapper the callers use INSTEAD of raw recordVerdict when they
 * want auto-reflection on matched=false. Passes through the original
 * verdict-record semantics. On matched=false, computes and persists a
 * ReflectionEntry.
 */
export function recordVerdictWithReflection(args: {
  readonly entry_id: string;
  readonly ground_truth_label: string | number | boolean | null;
  readonly repo_root?: string;
}): { readonly matched: boolean | null; readonly reflection_entry: ReflectionEntry | null } {
  const v = rawRecordVerdict({
    entry_id: args.entry_id,
    ground_truth_label: args.ground_truth_label,
    repo_root: args.repo_root,
  });
  if (v.matched !== false || v.joined === null) {
    return { matched: v.matched, reflection_entry: null };
  }
  const features = v.joined.features_the_brain_had_at_prediction_time;
  const window = loadRecentVerdictsForFeatures(features, args.repo_root);
  const findings = invokeSpecialistsOnWindow(window);
  const reflection: ReflectionEntry = {
    entry_id: "refl_" + crypto.randomBytes(6).toString("hex"),
    reflection_key: reflectionKey(features),
    timestamp: new Date().toISOString(),
    triggering_verdict_id: args.entry_id,
    triggering_features: features,
    window_size: window.length,
    window_matched: window.filter((w) => w.matched === true).length,
    window_failed: window.filter((w) => w.matched === false).length,
    window_unknown: window.filter((w) => w.matched === null).length,
    specialist_findings: findings,
    evidence_kind: "INFERRED",
    r11b_marker: "REFLECTION_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
  };
  appendReflection(reflection, args.repo_root);
  return { matched: v.matched, reflection_entry: reflection };
}

// ── Store operations ──────────────────────────────────────────────────

function appendReflection(rec: ReflectionEntry, repo_root?: string): void {
  const p = getReflectionsPath(repo_root);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(rec) + "\n", "utf8");
  recordHeartbeat({
    agent_id: "post_verdict_reflection",
    event_type: "append_reflection",
    event_data: { reflection_key: rec.reflection_key, specialists: rec.specialist_findings.length },
  });
}

export function loadAllReflections(repo_root?: string): readonly ReflectionEntry[] {
  const p = getReflectionsPath(repo_root);
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, "utf8");
  const out: ReflectionEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line) as ReflectionEntry); } catch { /* skip corrupted line */ }
  }
  return out;
}

export const POST_VERDICT_REFLECTION_VERSION = "post-verdict-reflection.v1";
