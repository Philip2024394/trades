// Reindex — compute + persist embeddings for memory records that
// don't have one yet. Idempotent per record. Batched to keep memory
// use bounded.
//
// Also called on-demand: when a new record lands via projection, we
// backfill just that row. When embeddings dim / provider changes, we
// bulk-reindex.

import { createClient } from "@supabase/supabase-js";
import { embedText } from "@/lib/llm/embeddings";
import { memoryRecordToEmbedText } from "./embedText";
import type { MemoryRecord, MemoryRecordType } from "./types";

const BATCH_SIZE = 20;

function client() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

type Row = {
  id: string;
  merchant_id: string;
  record_type: string;
  facets: Record<string, unknown>;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  linked_event_ids: string[];
  created_at: string;
  updated_at: string;
};

function rowToRecord(row: Row): MemoryRecord {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    recordType: row.record_type as MemoryRecordType,
    facets: row.facets ?? {},
    postcode: row.postcode,
    latitude: row.latitude,
    longitude: row.longitude,
    linkedEventIds: row.linked_event_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/** Embed and persist for a single record (called from the memory
 *  projection to keep embeddings fresh in real time). Safe to
 *  re-call. */
export async function upsertEmbeddingForRecord(
  recordId: string
): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const { data } = await c
    .from("memory_records")
    .select("*")
    .eq("id", recordId)
    .maybeSingle();
  if (!data) return false;
  const record = rowToRecord(data as Row);
  const text = memoryRecordToEmbedText(record);
  const vec = await embedText(text);
  if (!vec) return false;
  const { error } = await c
    .from("memory_records")
    .update({ embedding: vec })
    .eq("id", recordId);
  return !error;
}

/** Batched backfill — walks all records missing an embedding for a
 *  merchant (or all merchants when omitted) and populates them. */
export async function reindexMerchant(
  merchantId?: string,
  limit = 200
): Promise<{ processed: number; failed: number }> {
  const c = client();
  if (!c) return { processed: 0, failed: 0 };
  let processed = 0;
  let failed = 0;
  let cursor = 0;
  while (processed + failed < limit) {
    let q = c
      .from("memory_records")
      .select("*")
      .is("embedding", null)
      .range(cursor, cursor + BATCH_SIZE - 1);
    if (merchantId) q = q.eq("merchant_id", merchantId);
    const { data } = await q;
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) break;
    for (const row of rows) {
      const record = rowToRecord(row);
      const text = memoryRecordToEmbedText(record);
      const vec = await embedText(text);
      if (!vec) {
        failed += 1;
        continue;
      }
      const { error } = await c
        .from("memory_records")
        .update({ embedding: vec })
        .eq("id", record.id);
      if (error) failed += 1;
      else processed += 1;
    }
    cursor += BATCH_SIZE;
  }
  return { processed, failed };
}
