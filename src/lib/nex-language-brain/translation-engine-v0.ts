// src/lib/nex-language-brain/translation-engine-v0.ts
//
// NEX1 · TRANSLATION ENGINE v0 · INTENT-PRESERVING TRANSLATION (IPT).
//
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Founder rules (2026-09-12):
//   · Deterministic. Never invents meaning. No LLM.
//   · EN ↔ ID initially. Registry-scaffolded languages refuse until
//     progression gate allows.
//   · Fails closed. If the utterance can't be routed to a recognised intent
//     AND doesn't decompose to a covered emission template, REFUSE with a
//     structured reason. "Translate this weird phrase" produces refusal ·
//     not a manufactured answer.
//
// Design:
//   input utterance in language X
//     → intent-bridge (Path A · deterministic)
//     → { intent_kind, slots, detected_language }
//     → emission template for language Y indexed by intent_kind
//     → output utterance in language Y (semantically preserved by construction)
//
// Reversibility contract:
//   IPT(X→Y) ∘ IPT(Y→X)  MUST resolve to the SAME { intent_kind, slots }.
//   The round-trip check is a first-class test, not a "nice to have".

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { processLanguageInput } from "./intent-bridge-v0";
import { checkProgressionGate, loadLanguageRegistry } from "./language-registry";
import type { Nex1LanguageRegistry, Nex1RecognisedIntentKind } from "./language-types";

export type IPTLanguage = "english" | "bahasa_indonesia";

// registry id (from language-registry.json) → IPT emission language
const REGISTRY_TO_IPT: Record<string, IPTLanguage> = {
  english: "english",
  bahasa_indonesia: "bahasa_indonesia",
};
// IPT language → BCP-47-ish tag we use in templates
const IPT_TAG: Record<IPTLanguage, "en" | "id"> = {
  english: "en",
  bahasa_indonesia: "id",
};

interface EmissionTemplateDoc {
  version: string;
  language: "en" | "id";
  templates: Record<string, { template: string; required_slots: string[] }>;
}

let TEMPLATES_CACHE: Partial<Record<IPTLanguage, EmissionTemplateDoc>> = {};
function loadTemplates(lang: IPTLanguage): EmissionTemplateDoc {
  if (TEMPLATES_CACHE[lang]) return TEMPLATES_CACHE[lang]!;
  const tag = IPT_TAG[lang];
  const p = resolve(process.cwd(), `data/nex1-language-brain/emission-templates/${tag}.json`);
  const doc = JSON.parse(readFileSync(p, "utf8")) as EmissionTemplateDoc;
  TEMPLATES_CACHE[lang] = doc;
  return doc;
}

export function _resetTemplatesCacheForTest(): void {
  TEMPLATES_CACHE = {};
}

export type IPTRefusalClass =
  | "refused_intent_bridge_did_not_recognise"    // language brain refused/clarified · nothing to translate
  | "refused_intent_kind_not_in_template"        // recognised intent has no emission template in target
  | "refused_missing_required_slot"              // slot required by target template is absent
  | "refused_source_target_identical"            // no-op translation attempts fail-closed
  | "refused_progression_gate_blocked"           // language not authorised (scaffolded)
  | "refused_round_trip_drift";                  // round-trip check failed · IPT rejects rather than emit drifted text

export interface IPTResult {
  readonly ok: boolean;
  readonly source_language: IPTLanguage;
  readonly target_language: IPTLanguage;
  readonly source_utterance: string;
  readonly emitted_utterance?: string;
  readonly intent_kind?: Nex1RecognisedIntentKind;
  readonly slots?: Readonly<Record<string, string>>;
  readonly evidence: {
    readonly matched_pattern_id?: string;
    readonly template_id?: string;
    readonly round_trip_verified: boolean;
    readonly confidence: number;
  };
  readonly refusal?: {
    readonly class: IPTRefusalClass;
    readonly reason: string;
  };
  readonly taught_by: "master_ai_engineer";
}

export interface IPTInput {
  readonly utterance: string;
  readonly source: IPTLanguage;
  readonly target: IPTLanguage;
  readonly registry: Nex1LanguageRegistry;
  /** If true (default) run a source→target→source round-trip check and reject on drift. */
  readonly verify_round_trip?: boolean;
}

/**
 * @summary Translate one utterance from source → target by preserving intent.
 * Path A only. Fails closed on any uncertainty.
 */
export function translateIntentPreserving(input: IPTInput): IPTResult {
  const taught_by = "master_ai_engineer" as const;

  if (input.source === input.target) {
    return {
      ok: false,
      source_language: input.source,
      target_language: input.target,
      source_utterance: input.utterance,
      evidence: { round_trip_verified: false, confidence: 0 },
      refusal: {
        class: "refused_source_target_identical",
        reason: "source and target languages are identical · nothing to translate",
      },
      taught_by,
    };
  }

  // Progression gate check for BOTH source and target
  const langReg = loadLanguageRegistry();
  const sourceGate = checkProgressionGate({ language_id: input.source }, langReg);
  const targetGate = checkProgressionGate({ language_id: input.target }, langReg);
  if (!sourceGate.allowed || !targetGate.allowed) {
    return {
      ok: false,
      source_language: input.source,
      target_language: input.target,
      source_utterance: input.utterance,
      evidence: { round_trip_verified: false, confidence: 0 },
      refusal: {
        class: "refused_progression_gate_blocked",
        reason: !sourceGate.allowed ? sourceGate.reason : targetGate.reason,
      },
      taught_by,
    };
  }

  // Path A · deterministic intent recognition
  const obs = processLanguageInput(
    { utterance: input.utterance },
    { registry: input.registry },
  );
  if (obs.ok !== true) {
    return {
      ok: false,
      source_language: input.source,
      target_language: input.target,
      source_utterance: input.utterance,
      evidence: { round_trip_verified: false, confidence: 0 },
      refusal: {
        class: "refused_intent_bridge_did_not_recognise",
        reason: obs.ok === "clarify"
          ? `intent bridge emitted clarify · candidates=[${obs.clarification.candidates.map((c) => c.intent_kind).join(", ")}]`
          : `intent bridge refused · class=${obs.refusal.refusal_class}`,
      },
      taught_by,
    };
  }

  const intent = obs.intent;
  const targetDoc = loadTemplates(input.target);
  const template = targetDoc.templates[intent.kind];
  if (!template) {
    return {
      ok: false,
      source_language: input.source,
      target_language: input.target,
      source_utterance: input.utterance,
      intent_kind: intent.kind,
      slots: intent.slots,
      evidence: {
        matched_pattern_id: intent.matched_pattern_id,
        round_trip_verified: false,
        confidence: intent.confidence,
      },
      refusal: {
        class: "refused_intent_kind_not_in_template",
        reason: `no emission template for intent '${intent.kind}' in language '${input.target}'`,
      },
      taught_by,
    };
  }

  // Ensure required slots are all present
  for (const req of template.required_slots) {
    if (!intent.slots[req] || intent.slots[req].trim().length === 0) {
      return {
        ok: false,
        source_language: input.source,
        target_language: input.target,
        source_utterance: input.utterance,
        intent_kind: intent.kind,
        slots: intent.slots,
        evidence: {
          matched_pattern_id: intent.matched_pattern_id,
          template_id: `${input.target}:${intent.kind}`,
          round_trip_verified: false,
          confidence: intent.confidence,
        },
        refusal: {
          class: "refused_missing_required_slot",
          reason: `template '${input.target}:${intent.kind}' requires slot '${req}' but source utterance did not supply it`,
        },
        taught_by,
      };
    }
  }

  // Substitute
  const emitted = fillTemplate(template.template, intent.slots);

  // Round-trip verification (source → target → source · must resolve to same intent+slots)
  const verify = input.verify_round_trip !== false;
  let roundTripOK = false;
  if (verify) {
    const back = processLanguageInput({ utterance: emitted }, { registry: input.registry });
    if (back.ok === true
      && back.intent.kind === intent.kind
      && sameSlots(back.intent.slots, intent.slots, template.required_slots)) {
      roundTripOK = true;
    } else {
      return {
        ok: false,
        source_language: input.source,
        target_language: input.target,
        source_utterance: input.utterance,
        intent_kind: intent.kind,
        slots: intent.slots,
        emitted_utterance: emitted,
        evidence: {
          matched_pattern_id: intent.matched_pattern_id,
          template_id: `${input.target}:${intent.kind}`,
          round_trip_verified: false,
          confidence: intent.confidence,
        },
        refusal: {
          class: "refused_round_trip_drift",
          reason: `emitted '${emitted}' did not parse back to the original intent · IPT refuses to emit drifted text`,
        },
        taught_by,
      };
    }
  }

  return {
    ok: true,
    source_language: input.source,
    target_language: input.target,
    source_utterance: input.utterance,
    emitted_utterance: emitted,
    intent_kind: intent.kind,
    slots: intent.slots,
    evidence: {
      matched_pattern_id: intent.matched_pattern_id,
      template_id: `${input.target}:${intent.kind}`,
      round_trip_verified: roundTripOK,
      confidence: intent.confidence,
    },
    taught_by,
  };
}

function fillTemplate(template: string, slots: Readonly<Record<string, string>>): string {
  return template.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_, key: string) => {
    const v = slots[key];
    return v === undefined ? `{${key}}` : v;
  });
}

function sameSlots(
  a: Readonly<Record<string, string>>,
  b: Readonly<Record<string, string>>,
  required: readonly string[],
): boolean {
  for (const k of required) {
    if ((a[k] ?? "").trim() !== (b[k] ?? "").trim()) return false;
  }
  return true;
}

/**
 * @summary Free-text translation entry point. Founder-locked behaviour:
 *   · If the utterance decomposes to a recognised intent → IPT (safe path).
 *   · If not → REFUSE with a structured reason. Never manufacture.
 * The public API surface deliberately mirrors translateIntentPreserving so
 * callers cannot pick "unsafe mode". Free-text without intent grounding is
 * NOT supported in v0 and cannot be silently enabled.
 */
export function translateFreeTextFailsClosed(input: IPTInput): IPTResult {
  return translateIntentPreserving(input);
}
