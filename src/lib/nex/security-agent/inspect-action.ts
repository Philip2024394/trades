// src/lib/nex/security-agent/inspect-action.ts
//
// Inspect the proposed post-code-change action.
// At Stage 1b posture (locked doctrine ADR-0314i D-1b-1 · C-β freeze) ·
// only `code_change_only` is accepted. Any promotion / R-10 / production
// write attempt is REJECTED deterministically.

import type { SecurityInspectionRequest, SecurityRejection } from "./types";

export function inspectAction(
  request: SecurityInspectionRequest,
): readonly SecurityRejection[] {
  const a = request.proposedAction;
  switch (a.kind) {
    case "code_change_only":
      return [];
    case "promote_to_authoritative":
      return [
        {
          code: "sec.r10_bypass_attempted",
          message:
            "AUTHORITATIVE promotion is Stage 2 R-10 territory. Security Agent (code-change tier) rejects deterministically.",
          detail: { target: a.target },
        },
      ];
    case "apply_r10_authorisation":
      return [
        {
          code: "sec.r10_bypass_attempted",
          message:
            "R-10 authorisation policy application is Stage 2 territory. Security Agent (code-change tier) rejects deterministically.",
          detail: { policyRef: a.policyRef },
        },
      ];
    case "write_production":
      return [
        {
          code: "sec.stage_1b_r10_boundary_violated",
          message: `Production write to ${a.schema}.${a.table} attempted. C-β freeze locked (ADR-0314i D-1b-1). No new AUTHORITATIVE writes.`,
          detail: { schema: a.schema, table: a.table },
        },
      ];
    default: {
      const kind = (a as { kind: string }).kind;
      return [
        {
          code: "sec.policy_invention_attempted",
          message: `Unknown action kind "${kind}" rejected as policy-invention attempt.`,
        },
      ];
    }
  }
}
