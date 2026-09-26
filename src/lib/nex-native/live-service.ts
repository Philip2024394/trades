// src/lib/nex-native/live-service.ts
//
// NEX-native Live phase-1 service.
// ---------------------------------
// Scope: business-anchored short-lived announcements. Migration 029.
// Phase-1 explicitly DEFERS geo-boundary + moderation per sealed doctrine ·
// callers must label the surface honestly.

import { createClient } from "@supabase/supabase-js";
import type { NexLivePostRow, NexUuid } from "./types";

const NEX_URL =
  process.env.NEX_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ??
  "";
const NEX_SVC = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ?? "";

function svc() {
  if (!NEX_URL || !NEX_SVC) {
    throw new Error("nex-live-service · env missing (NEX_SUPABASE_URL/SERVICE_ROLE_KEY)");
  }
  return createClient(NEX_URL, NEX_SVC, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Body length bound must match DB CHECK (1..280 chars after trim). */
export const NEX_LIVE_POST_BODY_MAX = 280 as const;
export const NEX_LIVE_POST_BODY_MIN = 1 as const;

export interface CreateLivePostInput {
  business_id: NexUuid;
  body: string;
  /** ISO-8601 UTC · optional · past-timestamps rejected. */
  expires_at?: string | null;
}

export async function createLivePost(input: CreateLivePostInput): Promise<NexLivePostRow> {
  const trimmed = input.body.trim();
  if (trimmed.length < NEX_LIVE_POST_BODY_MIN) {
    throw new Error("nex-live · body required");
  }
  if (trimmed.length > NEX_LIVE_POST_BODY_MAX) {
    throw new Error(`nex-live · body too long (>${NEX_LIVE_POST_BODY_MAX})`);
  }
  let expiresAt: string | null = null;
  if (input.expires_at) {
    const t = Date.parse(input.expires_at);
    if (Number.isNaN(t)) throw new Error("nex-live · expires_at not a valid ISO timestamp");
    if (t <= Date.now()) throw new Error("nex-live · expires_at must be in the future");
    expiresAt = new Date(t).toISOString();
  }
  const { data, error } = await svc()
    .from("nex_live_post")
    .insert({ business_id: input.business_id, body: trimmed, expires_at: expiresAt })
    .select("*")
    .single();
  if (error) throw new Error(`nex-live · insert · ${error.message}`);
  return data as NexLivePostRow;
}

export async function getLivePostById(id: NexUuid): Promise<NexLivePostRow | null> {
  const { data, error } = await svc()
    .from("nex_live_post")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`nex-live · lookup · ${error.message}`);
  return (data as NexLivePostRow | null) ?? null;
}

export interface ListLivePostOptions {
  /** Include posts whose expires_at is in the past. Default false. */
  include_expired?: boolean;
  limit?: number;
}

export async function listActiveByBusiness(
  business_id: NexUuid,
  options: ListLivePostOptions = {},
): Promise<NexLivePostRow[]> {
  const q = svc()
    .from("nex_live_post")
    .select("*")
    .eq("business_id", business_id)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);
  if (!options.include_expired) {
    q.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  }
  const { data, error } = await q;
  if (error) throw new Error(`nex-live · list-by-business · ${error.message}`);
  return (data as NexLivePostRow[] | null) ?? [];
}

export async function listActiveGlobal(options: ListLivePostOptions = {}): Promise<NexLivePostRow[]> {
  const q = svc()
    .from("nex_live_post")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);
  if (!options.include_expired) {
    q.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  }
  const { data, error } = await q;
  if (error) throw new Error(`nex-live · list-global · ${error.message}`);
  return (data as NexLivePostRow[] | null) ?? [];
}

/** Set expires_at to now() so future active-lists exclude the post. Idempotent. */
export async function expireLivePost(id: NexUuid): Promise<NexLivePostRow> {
  const { data, error } = await svc()
    .from("nex_live_post")
    .update({ expires_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`nex-live · expire · ${error.message}`);
  return data as NexLivePostRow;
}

// Slice 13b · edit body + extend expiry

/** Update body of an existing Live post · same 1..280 rules as create.
 *  Rejects if the post is already expired (past-expiry → merchant should
 *  create a new post rather than edit a retired one). */
export async function updateLivePostBody(
  id: NexUuid,
  body: string,
): Promise<NexLivePostRow> {
  const trimmed = body.trim();
  if (trimmed.length < NEX_LIVE_POST_BODY_MIN) {
    throw new Error("nex-live · body required");
  }
  if (trimmed.length > NEX_LIVE_POST_BODY_MAX) {
    throw new Error(`nex-live · body too long (>${NEX_LIVE_POST_BODY_MAX})`);
  }
  const existing = await getLivePostById(id);
  if (!existing) throw new Error("nex-live · post not found");
  if (existing.expires_at && Date.parse(existing.expires_at) <= Date.now()) {
    throw new Error("nex-live · cannot edit an expired post");
  }
  const { data, error } = await svc()
    .from("nex_live_post")
    .update({ body: trimmed })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`nex-live · update-body · ${error.message}`);
  return data as NexLivePostRow;
}

/** Bounds on the extend-hours input · matches merchant-UI number input. */
export const NEX_LIVE_EXTEND_MIN_HOURS = 1 as const;
export const NEX_LIVE_EXTEND_MAX_HOURS = 168 as const;

/** Extend the expiry of a Live post by `hours`.
 *  · If existing expires_at is in the future → new = existing + hours.
 *  · If existing expires_at is null OR in the past → new = now() + hours.
 *  Bounds: 1..168 (matches phase-1 UI). */
export async function extendLivePostExpiry(
  id: NexUuid,
  hours: number,
): Promise<NexLivePostRow> {
  if (!Number.isFinite(hours) || hours < NEX_LIVE_EXTEND_MIN_HOURS || hours > NEX_LIVE_EXTEND_MAX_HOURS) {
    throw new Error(
      `nex-live · extend hours must be ${NEX_LIVE_EXTEND_MIN_HOURS}..${NEX_LIVE_EXTEND_MAX_HOURS}`,
    );
  }
  const existing = await getLivePostById(id);
  if (!existing) throw new Error("nex-live · post not found");
  const ms = hours * 3_600_000;
  const anchor =
    existing.expires_at && Date.parse(existing.expires_at) > Date.now()
      ? Date.parse(existing.expires_at)
      : Date.now();
  const newExpiry = new Date(anchor + ms).toISOString();
  const { data, error } = await svc()
    .from("nex_live_post")
    .update({ expires_at: newExpiry })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`nex-live · extend · ${error.message}`);
  return data as NexLivePostRow;
}
