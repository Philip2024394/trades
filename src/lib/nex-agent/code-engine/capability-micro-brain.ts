// src/lib/nex-agent/code-engine/capability-micro-brain.ts
//
// NEX1 · Micro-Brain Pattern · Founder-authorised 2026-09-18.
//
// PURPOSE
//   Provide the shared shape of a "smaller brain inside the larger NEX1
//   brain." Biological analogue: cortical micro-columns — each ~50k
//   neurons, each running the SAME algorithm shape on DIFFERENT input.
//   Millions in a mammalian cortex. Deterministic. Composable.
//
//   Engineering translation for NEX1:
//     - Same algorithm shape per micro-brain: OBSERVE → RECOGNISE → PREDICT → LEARN
//     - Own persistent JSONL DB per micro-brain (via agent-registry)
//     - Own deterministic rulebook (pattern set) per micro-brain
//     - Own domain (test-shape / identifier-token / fix-outcome / …)
//     - Broadcastable via the cortex router (separate module)
//
//   Zero LLM. Deterministic. Own rulebook per instance. No external network.
//
// CONSTITUTIONAL PRESERVATION
//   - R11-B: micro-brain predictions are INFERRED · never enter R-4 SUPPORTING.
//   - Q7/Q8/Fix 23a/b/c/Schema V1/Fix 17/Fix 30/Fix 30B/Safety UNCHANGED.
//   - Each micro-brain is a pure function of its own DB + rulebook +
//     observation. No shared mutable state between micro-brains.

import fs from "node:fs";
import path from "node:path";
import {
  registerAgent,
  recordHeartbeat,
  getRegistryRoot,
  type CognitiveLayer,
} from "./capability-agent-registry";

// ── Shared shape ─────────────────────────────────────────────────────────

export interface MicroBrainObservation {
  /** Arbitrary observation payload · pure JSON, no functions, no cycles. */
  readonly kind: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface MicroBrainPrediction {
  readonly agent_id: string;
  readonly domain: string;
  /** null when this micro-brain has no confident prediction for the input. */
  readonly prediction: string | number | boolean | null;
  /** Deterministic confidence in [0..1]. Never authoritative. */
  readonly confidence: number;
  /** Which rules in the rulebook triggered · for audit. */
  readonly rule_hits: readonly string[];
  readonly evidence_kind: "INFERRED";
  readonly r11b_marker: "MICRO_BRAIN_PREDICTION_MUST_NOT_ENTER_R4_SUPPORTING_COUNT";
}

/** A single deterministic rule inside a micro-brain's rulebook. */
export interface MicroBrainRule<O = MicroBrainObservation> {
  readonly id: string;
  /** Pure predicate on the observation payload. */
  readonly matches: (obs: O) => boolean;
  /** Deterministic prediction when the rule fires. */
  readonly predict: (obs: O) => { value: string | number | boolean | null; confidence: number };
}

export interface MicroBrainConfig<O = MicroBrainObservation> {
  readonly id: string;
  readonly name: string;
  readonly domain: string;
  readonly cognitive_layer: CognitiveLayer;
  readonly description: string;
  readonly rulebook: readonly MicroBrainRule<O>[];
  /** Optional deterministic learn hook · defaults to no-op (rulebook is static). */
  readonly onLearn?: (feedback: {
    observation: O;
    predicted: MicroBrainPrediction;
    actual: string | number | boolean | null;
  }) => void;
}

export interface MicroBrain<O = MicroBrainObservation> {
  readonly id: string;
  readonly domain: string;
  readonly config: MicroBrainConfig<O>;
  observe(obs: O, repo_root?: string): void;
  predict(obs: O): MicroBrainPrediction;
  learn(feedback: {
    observation: O;
    predicted: MicroBrainPrediction;
    actual: string | number | boolean | null;
  }, repo_root?: string): void;
  readOwnDb(repo_root?: string): ReadonlyArray<Readonly<Record<string, unknown>>>;
}

// ── Factory ──────────────────────────────────────────────────────────────

export function createMicroBrain<O extends MicroBrainObservation>(
  config: MicroBrainConfig<O>,
): MicroBrain<O> {
  // Register in the central catalog + get own DB path.
  registerAgent({
    id: config.id,
    name: config.name,
    cognitive_layer: config.cognitive_layer,
    description: `[micro-brain · ${config.domain}] ${config.description}`,
  });

  return {
    id: config.id,
    domain: config.domain,
    config,
    observe(obs: O): void {
      recordHeartbeat({
        agent_id: config.id,
        event_type: "observe",
        event_data: { kind: obs.kind, data_keys: Object.keys(obs.data) },
      });
    },
    predict(obs: O): MicroBrainPrediction {
      const rule_hits: string[] = [];
      let bestValue: string | number | boolean | null = null;
      let bestConfidence = 0;
      for (const rule of config.rulebook) {
        try {
          if (rule.matches(obs)) {
            rule_hits.push(rule.id);
            const pr = rule.predict(obs);
            if (pr.confidence > bestConfidence) {
              bestConfidence = pr.confidence;
              bestValue = pr.value;
            }
          }
        } catch {
          /* micro-brain rules must never throw · silent skip */
        }
      }
      const prediction: MicroBrainPrediction = {
        agent_id: config.id,
        domain: config.domain,
        prediction: bestValue,
        confidence: bestConfidence,
        rule_hits,
        evidence_kind: "INFERRED",
        r11b_marker: "MICRO_BRAIN_PREDICTION_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
      };
      recordHeartbeat({
        agent_id: config.id,
        event_type: "predict",
        event_data: {
          prediction: bestValue,
          confidence: bestConfidence,
          rule_hits,
        },
      });
      return prediction;
    },
    learn(feedback): void {
      recordHeartbeat({
        agent_id: config.id,
        event_type: "learn",
        event_data: {
          predicted: feedback.predicted.prediction,
          actual: feedback.actual,
          correct: feedback.predicted.prediction === feedback.actual,
        },
      });
      if (config.onLearn) {
        try { config.onLearn(feedback); } catch { /* silent */ }
      }
    },
    readOwnDb(repo_root?: string): ReadonlyArray<Readonly<Record<string, unknown>>> {
      const dbPath = path.join(
        getRegistryRoot(repo_root),
        "agent-dbs",
        `${config.id}.jsonl`,
      );
      if (!fs.existsSync(dbPath)) return [];
      try {
        const raw = fs.readFileSync(dbPath, "utf8");
        return raw
          .split(/\r?\n/)
          .filter((l) => l.trim() !== "")
          .map((l) => {
            try { return JSON.parse(l) as Record<string, unknown>; } catch { return null; }
          })
          .filter((x): x is Record<string, unknown> => x !== null);
      } catch {
        return [];
      }
    },
  };
}

export const MICRO_BRAIN_VERSION = "microbrain.v1";
