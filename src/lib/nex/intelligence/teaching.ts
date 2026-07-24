// Teach Nex — raw upload flow.
//
// This module owns:
//   • recordUpload    — create the teaching_uploads row + return signed
//                       upload URL for the client to PUT to storage
//   • markExtracting  — the worker picks up queued rows and marks them
//   • recordExtractionResults — the worker writes the proposed entries
//                       into the review queue, linked back via
//                       source_upload_id
//
// Extraction worker (PDF parsing + LLM summarisation → structured
// knowledge draft) is intentionally NOT implemented in this pass —
// it needs OPENAI_API_KEY + a background job runner. The API and
// storage path are ready; drop in the worker later without changing
// callers.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { KnowledgeEntryDraft, TeachingUpload } from "./types";
import { submitCreate } from "./review";

const BUCKET = "nex-teaching";

/** Create a teaching upload row + return a signed URL the browser can
 *  PUT the file to. Never accept the file bytes through our own API. */
export async function recordUpload(input: {
  originalFilename: string;
  mimeType:         string;
  sizeBytes?:       number;
  tradeHint?:       string;
  topicHint?:       string;
  notes?:           string;
  uploadedBy:       string;
  uploadedByKind:   "staff" | "merchant" | "builder";
}): Promise<{ upload: TeachingUpload; signedUploadUrl: string; storagePath: string }> {
  const ext = input.originalFilename.split(".").pop() ?? "bin";
  const storagePath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabaseAdmin
    .from("hammerex_nex_teaching_uploads")
    .insert({
      storage_bucket:    BUCKET,
      storage_path:      storagePath,
      original_filename: input.originalFilename,
      mime_type:         input.mimeType,
      size_bytes:        input.sizeBytes ?? null,
      trade_hint:        input.tradeHint ?? null,
      topic_hint:        input.topicHint ?? null,
      notes:             input.notes ?? null,
      uploaded_by:       input.uploadedBy,
      uploaded_by_kind:  input.uploadedByKind
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`record upload failed: ${error?.message}`);

  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);
  if (signErr || !signed) throw new Error(`sign upload url failed: ${signErr?.message}`);

  return {
    upload:          data as unknown as TeachingUpload,
    signedUploadUrl: signed.signedUrl,
    storagePath
  };
}

/** Extraction worker marks a row as being processed. Idempotent. */
export async function markExtracting(uploadId: string): Promise<void> {
  await supabaseAdmin
    .from("hammerex_nex_teaching_uploads")
    .update({ extraction_status: "extracting" })
    .eq("id", uploadId)
    .eq("extraction_status", "queued");
}

/** Extraction worker writes proposed knowledge drafts into the review
 *  queue. Each draft links back to the upload via source_upload_id.
 *  Called by the extraction worker (not by route handlers). */
export async function recordExtractionResults(input: {
  uploadId:      string;
  proposedBy:    string;                 // 'ai:extraction' typically
  drafts:        KnowledgeEntryDraft[];
  extractionError?: string;
}): Promise<{ reviewIds: string[] }> {
  const reviewIds: string[] = [];
  for (const draft of input.drafts) {
    try {
      const r = await submitCreate({
        draft,
        submittedBy:      input.proposedBy,
        submittedByKind:  "ai",
        sourceUploadId:   input.uploadId
      });
      reviewIds.push(r.id);
    } catch {
      // Continue on invalid draft — the extractor may return partials.
    }
  }
  await supabaseAdmin
    .from("hammerex_nex_teaching_uploads")
    .update({
      extraction_status:      input.extractionError ? "failed" : "extracted",
      extraction_error:       input.extractionError ?? null,
      extracted_at:           new Date().toISOString(),
      extracted_entries_count: reviewIds.length
    })
    .eq("id", input.uploadId);
  return { reviewIds };
}

/** List uploads for triage. Staff sees all; merchants see their own. */
export async function listUploads(input: {
  status?:         TeachingUpload["extraction_status"];
  uploadedByKind?: TeachingUpload["uploaded_by_kind"];
  limit?:          number;
}): Promise<TeachingUpload[]> {
  let q = supabaseAdmin.from("hammerex_nex_teaching_uploads").select("*");
  if (input.status)         q = q.eq("extraction_status", input.status);
  if (input.uploadedByKind) q = q.eq("uploaded_by_kind", input.uploadedByKind);
  const { data } = await q.order("uploaded_at", { ascending: false }).limit(input.limit ?? 50);
  return (data as unknown as TeachingUpload[]) ?? [];
}
