// NEX Comms Centre · Social · Rights stage.
//
// Charter §S-VIII: Rights re-verifies at T-adapter-call. Even at first
// validation the check runs · at adapter-call time the same function
// runs again (called from the future Phase 4 worker before adapter
// dispatch). Rights-eligibility can change between scheduling and
// publish (asset deleted · rights_status flipped · license expired ·
// PII flag set).
//
// The stage NEVER trusts a cached source_ref; it queries the current
// state of the source row from the DB every time it runs.

import type { SafetyValidator, StageResult } from "./interface";
import { AUTOPUBLISH_ELIGIBLE_RIGHTS } from "../content/types";

export function createRightsValidator(): SafetyValidator {
  return {
    stage: "rights",
    async run({ client, subject, timeout_ms }) {
      const started = Date.now();
      const rejections: StageResult["rejections"] = [];
      let outcome: StageResult["outcome"] = "pass";
      let failed_closed_reason: string | undefined;

      if (subject.source_refs.length === 0) {
        return {
          stage: "rights",
          outcome: "fail_closed",
          ms: Date.now() - started,
          rejections: [],
          failed_closed_reason: "no source_refs supplied · cannot verify rights",
        };
      }

      try {
        const r = await withTimeout(
          () => client.query(
            `SELECT source_id, rights_status, active, expires_at,
                    contains_identifiable_persons, person_release_evidence_url
               FROM nex.social_content_sources
              WHERE source_id = ANY($1::uuid[])
                AND tenant_id = $2`,
            [subject.source_refs, subject.tenant_id],
          ),
          timeout_ms,
        );

        // Detect refs that vanished (RLS filter OR deleted).
        const found = new Set(r.rows.map((row) => String(row.source_id)));
        for (const ref of subject.source_refs) {
          if (!found.has(ref)) {
            rejections.push({
              code: "rights_source_missing",
              detail: `source ${ref} no longer visible to this tenant · deleted or RLS-filtered`,
              stage_specific: { source_ref: ref },
            });
          }
        }

        // Detect refs that lost eligibility.
        for (const row of r.rows) {
          const src = {
            source_id: String(row.source_id),
            rights_status: String(row.rights_status),
            active: Boolean(row.active),
            expires_at: row.expires_at,
            contains_identifiable_persons: Boolean(row.contains_identifiable_persons),
            person_release_evidence_url: row.person_release_evidence_url,
          };
          if (!src.active) {
            rejections.push({ code: "rights_source_inactive", detail: `source ${src.source_id} is inactive`, stage_specific: { source_ref: src.source_id } });
            continue;
          }
          if (!AUTOPUBLISH_ELIGIBLE_RIGHTS.includes(src.rights_status as never)) {
            rejections.push({ code: "rights_source_ineligible", detail: `source ${src.source_id} rights_status=${src.rights_status}`, stage_specific: { source_ref: src.source_id, rights_status: src.rights_status } });
            continue;
          }
          if (src.expires_at) {
            const exp = new Date(String(src.expires_at)).getTime();
            if (isNaN(exp) || exp <= Date.now()) {
              rejections.push({ code: "rights_source_expired", detail: `source ${src.source_id} expired at ${src.expires_at}`, stage_specific: { source_ref: src.source_id, expires_at: String(src.expires_at) } });
              continue;
            }
          }
          if (src.contains_identifiable_persons && !src.person_release_evidence_url) {
            rejections.push({ code: "rights_pii_no_release", detail: `source ${src.source_id} contains identifiable persons without release evidence`, stage_specific: { source_ref: src.source_id } });
          }
        }

        if (rejections.length > 0) outcome = "reject";
      } catch (e) {
        outcome = "fail_closed";
        failed_closed_reason = e instanceof Error ? e.message : String(e);
      }

      return { stage: "rights", outcome, ms: Date.now() - started, rejections, failed_closed_reason };
    },
  };
}

function withTimeout<T>(fn: () => Promise<T>, timeout_ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; reject(new Error(`stage timeout after ${timeout_ms}ms`)); } }, timeout_ms);
    fn().then((v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } })
        .catch((e) => { if (!settled) { settled = true; clearTimeout(timer); reject(e); } });
  });
}
