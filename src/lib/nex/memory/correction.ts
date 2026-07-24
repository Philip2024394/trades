// Correction chain — append a new row that supersedes an existing one.
//
// Never destructive. The old row stays in the table for audit; readers
// see only the newest un-superseded row per subject.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { writeMemory } from "./writer";
import type { CorrectionInput, MemoryLayer } from "./types";

const TABLES: Record<MemoryLayer, string> = {
  user:    "hammerex_nex_memory_user",
  company: "hammerex_nex_memory_company",
  project: "hammerex_nex_memory_project"
};

export type AppendCorrectionResult =
  | { ok: true;  id: string }
  | { ok: false; reason: string };

export async function appendCorrection(input: CorrectionInput): Promise<AppendCorrectionResult> {
  // Load the row being corrected so we can preserve owner + subject.
  const { data, error } = await supabaseAdmin
    .from(TABLES[input.layer])
    .select("*")
    .eq("id", input.correcting_id)
    .single();

  if (error || !data) return { ok: false, reason: `row not found: ${error?.message ?? "no data"}` };

  const original = data as Record<string, unknown>;

  const base = {
    subject:         String(original.subject),
    predicate:       original.predicate as import("./types").MemoryPredicate,
    value_json:      input.value_json,
    unit:            (original.unit as string | null) ?? null,
    sample_size:     1,
    confidence:      "medium" as const,
    is_verified:     true,        // a manual correction is a verified statement
    visible_to:      original.visible_to as import("./types").MemoryVisibility,
    source_engine:   input.source_engine,
    evidence_tables: [`correction_reason: ${input.reason}`],
    correction_of:   input.correcting_id
  };

  switch (input.layer) {
    case "user":
      return writeMemory({
        layer: "user",
        owner_user_id: String(original.owner_user_id),
        ...base
      });
    case "company":
      return writeMemory({
        layer: "company",
        merchant_slug: String(original.merchant_slug),
        ...base
      });
    case "project":
      return writeMemory({
        layer: "project",
        merchant_slug: String(original.merchant_slug),
        project_id:    String(original.project_id),
        ...base
      });
  }
}
