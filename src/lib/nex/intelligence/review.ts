// Review queue helpers. Every proposed change goes here first.
// Nothing else writes to the entries table (except createEntryImmediate
// which is seed/bootstrap only).
//
// Lifecycle:
//   submit* → review queue row (status=pending)
//   approveReview → publishes new version + marks row approved
//   rejectReview  → marks rejected + optional notes
//   mergeInto     → merges duplicate suggestions into one canonical

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { KnowledgeEntryDraftSchema, type KnowledgeEntryDraft, type ReviewItem, type ReviewKind, type ReviewStatus, type ReviewSubmitterKind } from "./types";
import { createEntryImmediate, publishNewVersion } from "./versions";

/** Submit a proposal to create a new entry. Returns the review id. */
export async function submitCreate(input: {
  draft:            KnowledgeEntryDraft;
  submittedBy:      string;
  submittedByKind:  ReviewSubmitterKind;
  merchantContext?: Record<string, unknown>;
  sourceUploadId?:  string;
}): Promise<{ id: string }> {
  const parsed = KnowledgeEntryDraftSchema.parse(input.draft);
  const { data, error } = await supabaseAdmin
    .from("hammerex_nex_review_queue")
    .insert({
      kind:              "create",
      proposed_json:     parsed,
      submitted_by:      input.submittedBy,
      submitted_by_kind: input.submittedByKind,
      merchant_context:  input.merchantContext ?? null,
      source_upload_id:  input.sourceUploadId ?? null
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`submit create failed: ${error?.message}`);
  return { id: data.id };
}

/** Submit a proposal to edit an existing entry. */
export async function submitEdit(input: {
  entryId:          string;
  draft:            KnowledgeEntryDraft;
  submittedBy:      string;
  submittedByKind:  ReviewSubmitterKind;
  changeSummary:    string;
  merchantContext?: Record<string, unknown>;
}): Promise<{ id: string }> {
  const parsed = KnowledgeEntryDraftSchema.parse(input.draft);
  const { data, error } = await supabaseAdmin
    .from("hammerex_nex_review_queue")
    .insert({
      kind:              "edit",
      target_entry_id:   input.entryId,
      proposed_json:     { ...parsed, change_summary: input.changeSummary },
      submitted_by:      input.submittedBy,
      submitted_by_kind: input.submittedByKind,
      merchant_context:  input.merchantContext ?? null
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`submit edit failed: ${error?.message}`);
  return { id: data.id };
}

/** Submit a merchant correction — free-form text from Nex chat. Staff
 *  reads the merchant context (their message + Nex's reply) alongside
 *  the proposal to decide the fix. */
export async function submitCorrection(input: {
  entryId:         string | null;
  message:         string;
  merchantSlug:    string;
  nexReply:        string;
  originalMessage: string;
}): Promise<{ id: string }> {
  const { data, error } = await supabaseAdmin
    .from("hammerex_nex_review_queue")
    .insert({
      kind:              "correction",
      target_entry_id:   input.entryId,
      proposed_json:     { correction: input.message },
      merchant_context:  {
        message:  input.originalMessage,
        nex_reply: input.nexReply
      },
      submitted_by:      input.merchantSlug,
      submitted_by_kind: "merchant"
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`submit correction failed: ${error?.message}`);
  return { id: data.id };
}

/** Approve a review: creates the new entry OR publishes a new version. */
export async function approveReview(input: {
  reviewId:   string;
  reviewerId: string;
  notes?:     string;
}): Promise<{ entryId?: string; versionId?: string }> {
  const review = await getReview(input.reviewId);
  if (!review) throw new Error("review not found");
  if (review.status !== "pending") throw new Error(`review already ${review.status}`);

  let result: { entryId?: string; versionId?: string } = {};

  if (review.kind === "create") {
    const draft = KnowledgeEntryDraftSchema.parse(review.proposed_json);
    const { id } = await createEntryImmediate({
      draft,
      approvedBy:     input.reviewerId,
      proposedBy:     review.submitted_by,
      proposedByKind: review.submitted_by_kind as "staff" | "merchant" | "ai" | "seed" | "builder",
      reviewId:       review.id
    });
    result = { entryId: id };
  } else if (review.kind === "edit" && review.target_entry_id) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { change_summary, ...draftPart } = review.proposed_json as KnowledgeEntryDraft & { change_summary?: string };
    const draft = KnowledgeEntryDraftSchema.parse(draftPart);
    const { versionId } = await publishNewVersion({
      entryId:        review.target_entry_id,
      draft,
      changeKind:     "minor",
      changeSummary:  (review.proposed_json as { change_summary?: string }).change_summary ?? "Reviewed edit",
      approvedBy:     input.reviewerId,
      proposedBy:     review.submitted_by,
      proposedByKind: review.submitted_by_kind as "staff" | "merchant" | "ai" | "seed" | "builder",
      reviewId:       review.id
    });
    result = { entryId: review.target_entry_id, versionId };
  }
  // "correction" and "teach" reviews are informational — staff turns
  // them into a proper create/edit via the Studio. We just close them.

  await supabaseAdmin
    .from("hammerex_nex_review_queue")
    .update({
      status:               "approved",
      reviewer_id:          input.reviewerId,
      reviewed_at:          new Date().toISOString(),
      review_notes:         input.notes ?? null,
      resulting_version_id: result.versionId ?? null
    })
    .eq("id", input.reviewId);

  return result;
}

/** Reject a review. */
export async function rejectReview(input: {
  reviewId:   string;
  reviewerId: string;
  notes:      string;
}): Promise<void> {
  await supabaseAdmin
    .from("hammerex_nex_review_queue")
    .update({
      status:      "rejected",
      reviewer_id: input.reviewerId,
      reviewed_at: new Date().toISOString(),
      review_notes: input.notes
    })
    .eq("id", input.reviewId);
}

/** Merge one review into another (dedupe suggestions). */
export async function mergeReview(input: {
  reviewId:      string;
  mergedIntoId:  string;
  reviewerId:    string;
}): Promise<void> {
  await supabaseAdmin
    .from("hammerex_nex_review_queue")
    .update({
      status:         "merged",
      reviewer_id:    input.reviewerId,
      reviewed_at:    new Date().toISOString(),
      merged_into_id: input.mergedIntoId
    })
    .eq("id", input.reviewId);
}

/** Archive a review without publishing (e.g. duplicate of existing knowledge). */
export async function archiveReview(input: {
  reviewId:   string;
  reviewerId: string;
  notes?:     string;
}): Promise<void> {
  await supabaseAdmin
    .from("hammerex_nex_review_queue")
    .update({
      status:       "archived",
      reviewer_id:  input.reviewerId,
      reviewed_at:  new Date().toISOString(),
      review_notes: input.notes ?? null
    })
    .eq("id", input.reviewId);
}

// ─── Reads ───────────────────────────────────────────────────────

export async function getReview(id: string): Promise<ReviewItem | null> {
  const { data } = await supabaseAdmin
    .from("hammerex_nex_review_queue")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as ReviewItem) ?? null;
}

export async function listReviews(input: {
  status?:          ReviewStatus;
  kind?:            ReviewKind;
  submittedByKind?: ReviewSubmitterKind;
  limit?:           number;
}): Promise<ReviewItem[]> {
  let q = supabaseAdmin.from("hammerex_nex_review_queue").select("*");
  if (input.status)          q = q.eq("status", input.status);
  if (input.kind)            q = q.eq("kind", input.kind);
  if (input.submittedByKind) q = q.eq("submitted_by_kind", input.submittedByKind);
  const { data } = await q.order("submitted_at", { ascending: false }).limit(input.limit ?? 50);
  return (data as unknown as ReviewItem[]) ?? [];
}

export async function countPending(): Promise<number> {
  const { count } = await supabaseAdmin
    .from("hammerex_nex_review_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}
