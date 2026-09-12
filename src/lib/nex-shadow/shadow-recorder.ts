// src/lib/nex-shadow/shadow-recorder.ts
//
// NEX1 · SHADOW MODE · fire-and-forget recorder.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Discipline (SH-1 · SH-2 · SH-6):
//   · Called BESIDE the live chat path · never inside it.
//   · Runs the integration pipeline in observation mode.
//   · NEVER throws to the caller · every internal error is swallowed
//     silently and recorded as UNEVALUATED so the live path is untouched.
//   · Never mutates any subsystem · never modifies files outside
//     data/nex1-shadow/records/.
//   · Never returns anything the caller can use to alter live response ·
//     the return value is void.

import { randomBytes, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runPipeline } from "@/lib/nex-integration/pipeline";
import { examine } from "./examiner";
import { appendRecord } from "./store";
import type { ShadowRecord } from "./types";

// Version tags read from disk once · never at request time · avoids any
// live-path overhead. Fallback strings preserve isolation on missing files.
const VERSIONS = (() => {
  try {
    const canon = JSON.parse(readFileSync(resolve(process.cwd(), "data/nex1-origin-canon/canon-v0.1.0.json"), "utf8")).canon_version || "v0.1.0";
    const relevance = "v0.1.0"; // relevance version is codified in classifier · pinned
    const stories = JSON.parse(readFileSync(resolve(process.cwd(), "data/nex1-stories-brain/topics-v0.1.0.json"), "utf8")).version || "v0.1.0";
    return { pipeline_version: "v0.1.0", canon_version: canon, relevance_version: relevance, stories_brain_version: stories };
  } catch {
    return { pipeline_version: "v0.1.0", canon_version: "unknown", relevance_version: "unknown", stories_brain_version: "unknown" };
  }
})();

export interface ShadowObserveInput {
  readonly utterance: string;
  readonly session_id: string;
}

/**
 * @summary Observe an utterance without altering any live path. Returns void.
 * Any internal error is silently captured as UNEVALUATED so the live chat
 * pipeline (which called this) is never blocked or thrown into.
 */
export function observeShadow(input: ShadowObserveInput): void {
  // Fire-and-forget · we wrap the entire body in a try/catch and never rethrow.
  try {
    const utterance = input?.utterance ?? "";
    const session_id = input?.session_id || "shadow-anonymous";
    if (!utterance) return;

    let decision;
    try {
      decision = runPipeline({ utterance, session_id });
    } catch {
      // Pipeline itself failed · record as UNEVALUATED · never rethrow
      const fingerprint = fp(utterance);
      const rec: ShadowRecord = {
        record_id: newId(),
        at: new Date().toISOString(),
        session_id,
        input_fingerprint: fingerprint,
        utterance_preserved: utterance,
        pipeline_decision: {
          utterance, session_id,
          at: new Date().toISOString(),
          layer_decisions: [],
          final_disposition: "FAIL_CLOSED",
          refuses_at_layer: null,
          response_plan: null,
          attribution: { external_llm_used: false, independent_authorship_percent: 0, taught_by: "master_ai_engineer" },
          test_only: true,
        },
        examiner: {
          evaluation: "SHADOW_UNEVALUATED",
          matched_expectation_id: null,
          rationale: "pipeline execution failed during shadow observation · fail-safe · UNEVALUATED · live path unaffected",
        },
        attribution: {
          external_llm_used: false, test_only: false, shadow_mode: true, independent_authorship_percent: 0,
          ...VERSIONS,
        },
      };
      appendRecord(rec);
      return;
    }

    let exam;
    try {
      exam = examine(utterance, decision);
    } catch {
      exam = {
        evaluation: "SHADOW_UNEVALUATED" as const,
        matched_expectation_id: null,
        rationale: "examiner failed · fail-safe · UNEVALUATED",
      };
    }

    const rec: ShadowRecord = {
      record_id: newId(),
      at: new Date().toISOString(),
      session_id,
      input_fingerprint: fp(utterance),
      utterance_preserved: utterance,
      pipeline_decision: decision,
      examiner: exam,
      attribution: {
        external_llm_used: false, test_only: false, shadow_mode: true, independent_authorship_percent: 0,
        ...VERSIONS,
      },
    };
    appendRecord(rec);
  } catch {
    // Absolute last-resort catch · SH-2 · never throw into caller
    return;
  }
}

function newId(): string { return "sh_" + randomBytes(6).toString("hex"); }
function fp(utterance: string): string {
  return "fp_" + createHash("sha256").update(utterance.trim().toLowerCase()).digest("hex").slice(0, 12);
}
