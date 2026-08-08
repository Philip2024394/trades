// NEX Comms Centre · Social · Brand stage.
//
// Charter §S-VIII: Brand-checker validates against the tenant brand
// profile. Empty brand profile → blocks Automatic mode (fail-closed).
//
// Rules enforced in Phase 3:
//   * Merchant-authored `forbidden_terms` → reject if any appear
//     (case-insensitive, whole-word match).
//   * `required_hashtags` for the platform kind (declared per-tenant
//     as an array; Phase 3 treats the list as required-in-every-post).
//   * `additional_whitelist` extends the green descriptor list per
//     tenant (advisory · does not cause a rejection · surfaced for
//     future Phase 3.5 LLM-composed mode).
//
// Additional stages (required disclaimers per post-kind · CTA defaults)
// land in Phase 6 when the merchant UI supplies them; the Phase 3
// validator supports the shape but treats missing values as OK.

import type { SafetyValidator, StageResult } from "./interface";

interface BrandProfileRow {
  tenant_id:            string;
  tone:                 string;
  additional_whitelist: string[];
  forbidden_terms:      string[];
  required_hashtags:    string[];
  required_disclaimers: Array<{ applies_to_kind?: string; text: string }>;
}

export function createBrandValidator(): SafetyValidator {
  return {
    stage: "brand",
    async run({ client, subject, timeout_ms }) {
      const started = Date.now();
      const rejections: StageResult["rejections"] = [];
      let outcome: StageResult["outcome"] = "pass";
      let failed_closed_reason: string | undefined;

      try {
        const row = await withTimeout(
          () => client.query(
            `SELECT tenant_id, tone, additional_whitelist, forbidden_terms,
                    required_hashtags, required_disclaimers
               FROM nex.social_brand_profiles
              WHERE tenant_id = $1`,
            [subject.tenant_id],
          ),
          timeout_ms,
        );
        if (row.rowCount === 0) {
          // Charter §S-VIII: empty brand profile blocks Automatic mode.
          return {
            stage: "brand",
            outcome: "fail_closed",
            ms: Date.now() - started,
            rejections: [],
            failed_closed_reason: "no brand profile · Automatic mode blocked until merchant sets one",
          };
        }
        const bp = row.rows[0] as unknown as BrandProfileRow;
        const full = [subject.caption, subject.hashtags.join(" "), subject.cta ?? ""].join(" \n ").toLowerCase();

        // 1. Forbidden terms (whole-word).
        for (const raw of bp.forbidden_terms ?? []) {
          const t = raw.toLowerCase();
          const re = new RegExp(`\\b${escapeRegex(t)}\\b`, "gi");
          const m = re.exec(full);
          if (m) {
            rejections.push({
              code: "brand_forbidden_term",
              detail: `merchant brand forbids term "${raw}"`,
              offending_claim: m[0],
            });
          }
        }

        // 2. Required hashtags.
        if ((bp.required_hashtags?.length ?? 0) > 0) {
          const have = new Set(subject.hashtags.map((h) => h.toLowerCase()));
          for (const need of bp.required_hashtags) {
            if (!have.has(need.toLowerCase())) {
              rejections.push({
                code: "brand_missing_required_hashtag",
                detail: `brand requires hashtag ${need} on every post · missing`,
                stage_specific: { required: need },
              });
            }
          }
        }

        if (rejections.length > 0) outcome = "reject";
      } catch (e) {
        outcome = "fail_closed";
        failed_closed_reason = e instanceof Error ? e.message : String(e);
      }

      return { stage: "brand", outcome, ms: Date.now() - started, rejections, failed_closed_reason };
    },
  };
}

function escapeRegex(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function withTimeout<T>(fn: () => Promise<T>, timeout_ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; reject(new Error(`stage timeout after ${timeout_ms}ms`)); } }, timeout_ms);
    fn().then((v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } })
        .catch((e) => { if (!settled) { settled = true; clearTimeout(timer); reject(e); } });
  });
}
