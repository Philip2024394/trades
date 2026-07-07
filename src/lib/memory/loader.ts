// Server-side reads + writes against memory_records. The single
// place the rest of the codebase talks to the Archive.

import { createClient } from "@supabase/supabase-js";
import type {
  MemoryQuery,
  MemoryRecord,
  MemoryRecordType
} from "./types";

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

/** Insert or update a memory record. If key is provided in facets
 *  (e.g. { customer_id: 'abc' }), an existing record with the same
 *  merchant + record_type + key value is updated instead of a new
 *  row being created. */
export async function upsertMemoryRecord(input: {
  merchantId: string;
  recordType: MemoryRecordType;
  facets: Record<string, unknown>;
  postcode?: string;
  latitude?: number;
  longitude?: number;
  linkEventId?: string;
  /** JSONB facet key to use as the natural key for upsert. When set,
   *  we look up an existing record with this facet value and merge. */
  naturalKey?: { field: string; value: string };
}): Promise<MemoryRecord | null> {
  const c = client();
  if (!c) return null;

  // Look for existing row via natural key first.
  let existing: Row | null = null;
  if (input.naturalKey) {
    const match: Record<string, unknown> = {};
    match[input.naturalKey.field] = input.naturalKey.value;
    const { data } = await c
      .from("memory_records")
      .select("*")
      .eq("merchant_id", input.merchantId)
      .eq("record_type", input.recordType)
      .contains("facets", match)
      .maybeSingle();
    existing = (data as Row | null) ?? null;
  }

  if (existing) {
    const mergedFacets = { ...(existing.facets ?? {}), ...input.facets };
    const linkedEvents = new Set(existing.linked_event_ids ?? []);
    if (input.linkEventId) linkedEvents.add(input.linkEventId);
    const { data, error } = await c
      .from("memory_records")
      .update({
        facets: mergedFacets,
        postcode: input.postcode ?? existing.postcode,
        latitude: input.latitude ?? existing.latitude,
        longitude: input.longitude ?? existing.longitude,
        linked_event_ids: Array.from(linkedEvents)
      })
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();
    if (error || !data) return null;
    return rowToRecord(data as Row);
  }

  const { data, error } = await c
    .from("memory_records")
    .insert({
      merchant_id: input.merchantId,
      record_type: input.recordType,
      facets: input.facets,
      postcode: input.postcode ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      linked_event_ids: input.linkEventId ? [input.linkEventId] : []
    })
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return rowToRecord(data as Row);
}

/** Structured query against Memory. Returns matched records ordered
 *  by updated_at desc. */
export async function queryMemory(q: MemoryQuery): Promise<MemoryRecord[]> {
  const c = client();
  if (!c) return [];
  let query = c.from("memory_records").select("*").eq("merchant_id", q.merchantId);
  if (q.recordType) query = query.eq("record_type", q.recordType);
  if (q.facetMatch) query = query.contains("facets", q.facetMatch);
  if (q.postcodeStartsWith)
    query = query.like("postcode", `${q.postcodeStartsWith}%`);
  if (q.updatedSince) query = query.gte("updated_at", q.updatedSince);
  query = query.order("updated_at", { ascending: false }).limit(q.limit ?? 50);
  const { data } = await query;
  return (data ?? []).map((r) => rowToRecord(r as Row));
}
