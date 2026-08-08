// NEX Comms Centre · Social · Policy stage.
//
// Charter §S-VIII: Policy-checker enforces the forbidden-claims list.
// Distinct from Fact — Fact validates provenance grounding; Policy
// enforces the forbidden pattern set even against grounded values.
// (Example: even if a merchant's brand profile says "trusted", the
// hashtag #TrustedBuilder is a Policy hard-block regardless of
// grounding · qualification claims can't be self-asserted.)
//
// Charter §S-VIII: empty forbidden-claims list → launch-time warning +
// blocks Automatic mode until a starter list exists. Phase 3 loads the
// data file at init; if the file is empty (or fails to parse) the
// stage fails-closed with a specific reason so Automatic mode gets
// blocked at pipeline output.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SafetyValidator, StageResult, ValidatorSubject } from "./interface";

interface ForbiddenPattern { match: string; reason: string }
interface ForbiddenCategory { category: string; enforcement: "hard_block" | "review_required"; patterns: ForbiddenPattern[] }
interface ForbiddenData     { version: string; categories: ForbiddenCategory[] }

let cached: ForbiddenData | null = null;
function load(): ForbiddenData {
  if (cached) return cached;
  const raw = readFileSync(join(process.cwd(), "data", "nex-comms-social", "forbidden-claims-v1.json"), "utf8");
  cached = JSON.parse(raw) as ForbiddenData;
  return cached;
}
export const __resetPolicyCache = () => { cached = null; };

export function createPolicyValidator(): SafetyValidator {
  return {
    stage: "policy",
    async run({ subject, timeout_ms }) {
      const started = Date.now();
      const rejections: StageResult["rejections"] = [];
      let outcome: StageResult["outcome"] = "pass";
      let failed_closed_reason: string | undefined;

      try {
        const data = await withTimeout(() => Promise.resolve(load()), timeout_ms);
        const total = data.categories.reduce((n, c) => n + c.patterns.length, 0);
        if (total === 0) {
          // Charter §S-VIII: empty list blocks Automatic mode.
          return {
            stage: "policy",
            outcome: "fail_closed",
            ms: Date.now() - started,
            rejections: [],
            failed_closed_reason: "forbidden-claims list is empty · Automatic mode blocked until Nex publishes a starter list",
          };
        }
        const full = fullTextOf(subject);
        for (const cat of data.categories) {
          for (const pat of cat.patterns) {
            const re = new RegExp(pat.match, "gi");
            let m: RegExpExecArray | null;
            while ((m = re.exec(full)) !== null) {
              rejections.push({
                code: cat.enforcement === "hard_block" ? "policy_hard_blocked" : "policy_review_required",
                detail: `${cat.category}: ${pat.reason}`,
                offending_claim: m[0],
                stage_specific: { category: cat.category },
              });
            }
          }
        }
        if (rejections.length > 0) outcome = "reject";
      } catch (e) {
        outcome = "fail_closed";
        failed_closed_reason = e instanceof Error ? e.message : String(e);
      }

      return { stage: "policy", outcome, ms: Date.now() - started, rejections, failed_closed_reason };
    },
  };
}

function fullTextOf(s: ValidatorSubject): string {
  return [s.caption, s.hashtags.join(" "), s.cta ?? ""].join(" \n ");
}

function withTimeout<T>(fn: () => Promise<T>, timeout_ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; reject(new Error(`stage timeout after ${timeout_ms}ms`)); } }, timeout_ms);
    fn().then((v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } })
        .catch((e) => { if (!settled) { settled = true; clearTimeout(timer); reject(e); } });
  });
}
