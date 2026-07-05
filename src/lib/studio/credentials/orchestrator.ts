// Credential verification orchestrator.
//
// One place that runs a verification pass over a single credential row
// and persists the result. Callers:
//   • Daily cron (bulk pass)
//   • On-demand verify endpoint (single row)
//   • Wizard follow-up (fire-and-forget after add)

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CredentialScheme } from "@/lib/studio/blueprints";
import { verifyCredential } from "./verifiers";

export type CredentialRow = {
  id: string;
  brand_id: string;
  scheme: string;
  number: string;
  status: string;
  display_label: string | null;
};

export type OrchestratorOutcome =
  | { ok: true; status: string; displayLabel: string | null }
  | { ok: false; error: string };

export async function verifyOne(
  row: CredentialRow
): Promise<OrchestratorOutcome> {
  const result = await verifyCredential(row.scheme as CredentialScheme, row.number);
  const now = new Date().toISOString();

  let nextStatus: string = row.status;
  let nextDisplayLabel: string | null = row.display_label;
  let expiresAt: string | null = null;
  let raw: unknown = null;

  switch (result.status) {
    case "verified":
      nextStatus = "verified";
      nextDisplayLabel = result.displayLabel ?? row.display_label;
      expiresAt = result.expiresAt ?? null;
      raw = result.raw ?? null;
      break;
    case "self-declared":
      nextStatus = "self-declared";
      raw = result.raw ?? null;
      break;
    case "expired":
    case "suspended":
    case "not-found":
      nextStatus = result.status;
      raw = result.raw ?? null;
      break;
    case "error": {
      // Never demote — leave existing status alone but record the error
      const errUpd = await supabaseAdmin
        .from("studio_brand_credentials")
        .update({
          last_check_at: now,
          raw_response: { error: result.error, at: now }
        })
        .eq("id", row.id);
      if (errUpd.error) return { ok: false, error: errUpd.error.message };
      return { ok: false, error: result.error };
    }
  }

  const upd = await supabaseAdmin
    .from("studio_brand_credentials")
    .update({
      status: nextStatus,
      display_label: nextDisplayLabel,
      verified_at: nextStatus === "verified" ? now : null,
      expires_at: expiresAt,
      last_check_at: now,
      raw_response: raw
    })
    .eq("id", row.id);

  if (upd.error) return { ok: false, error: upd.error.message };
  return { ok: true, status: nextStatus, displayLabel: nextDisplayLabel };
}
