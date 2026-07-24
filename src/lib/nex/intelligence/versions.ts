// Version helpers — every content change writes a new version row.
// The main entry row IS the current published state (fast-read),
// but content columns can't be silently mutated; the DB trigger
// requires the transaction to set app.nex_editor='true' via
// approveAndPublish() below.
//
// Never call supabaseAdmin.from("hammerex_nex_knowledge_entries")
// .update() directly from outside this module — the trigger will
// reject the transaction.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ChangeKind, KnowledgeEntry, KnowledgeEntryDraft, KnowledgeVersion } from "./types";

/** Read an entry by id. Returns null when not found. */
export async function readEntry(id: string): Promise<KnowledgeEntry | null> {
  const { data } = await supabaseAdmin
    .from("hammerex_nex_knowledge_entries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as KnowledgeEntry) ?? null;
}

/** Read every version of an entry, newest first. Powers the Timeline. */
export async function readVersionHistory(entryId: string): Promise<KnowledgeVersion[]> {
  const { data } = await supabaseAdmin
    .from("hammerex_nex_knowledge_versions")
    .select("*")
    .eq("entry_id", entryId)
    .order("version", { ascending: false });
  return (data as unknown as KnowledgeVersion[]) ?? [];
}

/** Create the first version of a brand-new entry. Bypasses the review
 *  queue only for seed / admin bootstrap use. Regular writes go via
 *  submitCreate() in review.ts. */
export async function createEntryImmediate(input: {
  draft:            KnowledgeEntryDraft;
  approvedBy:       string;
  proposedBy:       string;
  proposedByKind:   "staff" | "merchant" | "ai" | "seed" | "builder";
  reviewId?:        string;
  changeSummary?:   string;
}): Promise<{ id: string; version: number }> {
  const { data: entry, error } = await supabaseAdmin
    .from("hammerex_nex_knowledge_entries")
    .insert({ ...input.draft, version: 1, status: "published" })
    .select("id")
    .single();
  if (error || !entry) throw new Error(`create entry failed: ${error?.message}`);

  const { data: version, error: verr } = await supabaseAdmin
    .from("hammerex_nex_knowledge_versions")
    .insert({
      entry_id:         entry.id,
      version:          1,
      ...input.draft,
      change_kind:      "initial" as ChangeKind,
      change_summary:   input.changeSummary ?? "Initial entry",
      proposed_by:      input.proposedBy,
      proposed_by_kind: input.proposedByKind,
      approved_by:      input.approvedBy,
      review_id:        input.reviewId ?? null
    })
    .select("id")
    .single();
  if (verr) throw new Error(`create version row failed: ${verr.message}`);

  return { id: entry.id, version: 1 };
}

/** Apply an approved edit: bumps version, writes a new version row,
 *  updates the entry's current state through the guard trigger.
 *  Called from approveReview() in review.ts. Never call directly
 *  from route handlers; always route through the review workflow. */
export async function publishNewVersion(input: {
  entryId:        string;
  draft:          KnowledgeEntryDraft;
  changeKind:     ChangeKind;
  changeSummary:  string;
  approvedBy:     string;
  proposedBy:     string;
  proposedByKind: "staff" | "merchant" | "ai" | "seed" | "builder";
  reviewId:       string;
}): Promise<{ version: number; versionId: string }> {
  // Read current version to know the next number.
  const current = await readEntry(input.entryId);
  if (!current) throw new Error("entry not found");
  const nextVersion = current.version + 1;

  // Open a lightweight transaction via an RPC. Simpler alternative:
  // call two statements back-to-back with app.nex_editor set for the
  // duration of the connection. The Supabase JS client re-uses HTTP
  // connections so we bracket both statements with SET LOCAL via a
  // single RPC call.
  const { data, error } = await supabaseAdmin.rpc("fn_nex_publish_new_version", {
    p_entry_id:         input.entryId,
    p_next_version:     nextVersion,
    p_title:            input.draft.title,
    p_summary:          input.draft.summary,
    p_body_md:          input.draft.body_md ?? null,
    p_category:         input.draft.category ?? null,
    p_subcategory:      input.draft.subcategory ?? null,
    p_difficulty:       input.draft.difficulty,
    p_keywords:         input.draft.keywords,
    p_sources:          input.draft.sources,
    p_evidence:         input.draft.evidence,
    p_confidence:       input.draft.confidence,
    p_change_kind:      input.changeKind,
    p_change_summary:   input.changeSummary,
    p_proposed_by:      input.proposedBy,
    p_proposed_by_kind: input.proposedByKind,
    p_approved_by:      input.approvedBy,
    p_review_id:        input.reviewId
  }) as { data: { version_id: string } | null; error: unknown };

  if (error || !data) throw new Error(`publish failed: ${JSON.stringify(error)}`);
  return { version: nextVersion, versionId: data.version_id };
}
