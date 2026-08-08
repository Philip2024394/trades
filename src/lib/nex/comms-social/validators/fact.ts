// NEX Comms Centre · Social · Fact stage.
//
// Wraps the Phase 2 grounding validator (`content/grounding.ts`) — does
// NOT duplicate it. The Fact stage's job is to confirm every claim in
// the subject can be traced to a source, using the same rule set the
// generator was constrained by.
//
// Charter §S-III + §S-VIII: Fact-checker MUST be distinct from Generator.
// Phase 2's generator produced the subject; this Fact stage runs a
// fresh classification pass on the rendered text and does NOT trust
// the generator's own claim list.

import { classifyClaims } from "../content/claims";
import type { SafetyValidator, StageResult, ValidatorSubject } from "./interface";

export function createFactValidator(): SafetyValidator {
  return {
    stage: "fact",
    async run({ subject, timeout_ms }) {
      const started = Date.now();
      const rejections: StageResult["rejections"] = [];

      // Timeout guard · classifyClaims is CPU-only, but wrap defensively.
      const done = withTimeout(() => runFact(subject), timeout_ms);
      let outcome: StageResult["outcome"] = "pass";
      let detail: string | undefined;
      let failed_closed_reason: string | undefined;
      try {
        const r = await done;
        rejections.push(...r.rejections);
        if (r.rejections.length > 0) outcome = "reject";
      } catch (e) {
        outcome = "fail_closed";
        failed_closed_reason = e instanceof Error ? e.message : String(e);
      }
      return {
        stage: "fact",
        outcome,
        ms: Date.now() - started,
        detail,
        rejections,
        failed_closed_reason,
      };
    },
  };
}

function runFact(subject: ValidatorSubject): { rejections: StageResult["rejections"] } {
  // Fresh classification against the RENDERED text — never trust the
  // generator's claim list.
  const classified = classifyClaims({
    caption:  subject.caption,
    hashtags: subject.hashtags,
    cta:      subject.cta,
  });
  const rejections: StageResult["rejections"] = [];
  const provenanceValues = Object.values(subject.provenance).map((p) => p.value.toLowerCase());
  for (const c of classified.claims) {
    const norm = c.text.toLowerCase();
    const grounded = provenanceValues.some((v) => v.includes(norm) || norm.includes(v));
    if (grounded) continue;
    if (c.enforcement === "hard_block") {
      rejections.push({ code: "fact_hard_blocked", detail: c.reason ?? "hard-blocked claim not grounded", offending_claim: c.text });
    } else if (c.enforcement === "review_required") {
      rejections.push({ code: "fact_review_required", detail: c.reason ?? "review-required claim needs evidence", offending_claim: c.text });
    }
  }
  return { rejections };
}

function withTimeout<T>(fn: () => T | Promise<T>, timeout_ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; reject(new Error(`stage timeout after ${timeout_ms}ms`)); } }, timeout_ms);
    Promise.resolve()
      .then(fn)
      .then((v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } })
      .catch((e) => { if (!settled) { settled = true; clearTimeout(timer); reject(e); } });
  });
}
