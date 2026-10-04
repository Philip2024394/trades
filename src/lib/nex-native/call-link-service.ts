// src/lib/nex-native/call-link-service.ts
//
// CRUD + helpers for nex_call_link (migration 132). Thin layer over
// nexSupabaseAdmin · callers vouch for the viewer via session resolver.
//
// Defaults sealed by founder 2026-10-04:
//   · account-only joins (enforced in the join flow, not here)
//   · 24h TTL by default · overridable up to 7 days
//   · max_uses 1 by default · 1-4 permitted (group cap = 4)

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

export type CallLinkMediaType = "audio" | "video";

export interface CallLinkRow {
  id: NexUuid;
  slug: string;
  created_by: NexUuid;
  media_type: CallLinkMediaType;
  max_uses: number;
  consumed_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  group_call_session_id: NexUuid | null;
}

export interface CreateCallLinkInput {
  createdBy: NexUuid;
  mediaType: CallLinkMediaType;
  maxUses?: number;
  ttlHours?: number;
}

export const CALL_LINK_DEFAULT_TTL_HOURS = 24;
export const CALL_LINK_MAX_TTL_HOURS = 24 * 7;
export const CALL_LINK_MAX_PARTICIPANTS = 4;

/** 12-char URL-safe slug · 72 bits of entropy, no collisions in
 *  practice. Uses base64url-ish alphabet without '+', '/' or padding. */
function newSlug(): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < buf.length; i++) {
    s += alphabet[buf[i]! & 63];
  }
  return s;
}

export async function createCallLink(
  input: CreateCallLinkInput,
): Promise<CallLinkRow> {
  const maxUses = Math.min(
    Math.max(1, input.maxUses ?? 1),
    CALL_LINK_MAX_PARTICIPANTS,
  );
  const ttl = Math.min(
    Math.max(1, input.ttlHours ?? CALL_LINK_DEFAULT_TTL_HOURS),
    CALL_LINK_MAX_TTL_HOURS,
  );
  const expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000).toISOString();

  // Retry up to 5x on the unlikely slug collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = newSlug();
    const { data, error } = await nexSupabaseAdmin
      .from("nex_call_link")
      .insert({
        slug,
        created_by: input.createdBy,
        media_type: input.mediaType,
        max_uses: maxUses,
        expires_at: expiresAt,
      })
      .select("*")
      .single();
    if (!error && data) return data as CallLinkRow;
    if (error && error.code !== "23505") {
      // Not a unique-violation · unrecoverable.
      throw new Error(`call-link-service.createCallLink: ${error.message}`);
    }
  }
  throw new Error(
    "call-link-service.createCallLink: slug collision after 5 attempts",
  );
}

export async function getCallLinkBySlug(
  slug: string,
): Promise<CallLinkRow | null> {
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(slug)) return null;
  const { data, error } = await nexSupabaseAdmin
    .from("nex_call_link")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    throw new Error(`call-link-service.getCallLinkBySlug: ${error.message}`);
  }
  return (data as CallLinkRow | null) ?? null;
}

export type CallLinkStatus =
  | { kind: "ok"; row: CallLinkRow }
  | { kind: "not-found" }
  | { kind: "revoked" }
  | { kind: "expired" }
  | { kind: "used-up" };

/** One-shot read + validation. Does NOT mutate consumed_count. */
export async function resolveCallLink(slug: string): Promise<CallLinkStatus> {
  const row = await getCallLinkBySlug(slug);
  if (!row) return { kind: "not-found" };
  if (row.revoked_at) return { kind: "revoked" };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { kind: "expired" };
  }
  if (row.consumed_count >= row.max_uses) return { kind: "used-up" };
  return { kind: "ok", row };
}

/** Atomic +1 consumed_count. Returns the updated row, or null if the
 *  bump would have exceeded max_uses (another joiner beat this one). */
export async function consumeCallLink(
  slug: string,
): Promise<CallLinkRow | null> {
  // RPC-style atomic: filter on consumed_count < max_uses in the
  // WHERE clause so a race can't double-consume the last seat.
  const current = await getCallLinkBySlug(slug);
  if (!current) return null;
  if (current.consumed_count >= current.max_uses) return null;
  const { data, error } = await nexSupabaseAdmin
    .from("nex_call_link")
    .update({ consumed_count: current.consumed_count + 1 })
    .eq("slug", slug)
    .eq("consumed_count", current.consumed_count)
    .select("*")
    .single();
  if (error) {
    // 23514 = check violation (consumed_count <= max_uses) means a
    // concurrent joiner took the final seat. Treat as used-up.
    if (error.code === "23514" || error.code === "PGRST116") return null;
    throw new Error(`call-link-service.consumeCallLink: ${error.message}`);
  }
  return data as CallLinkRow;
}

export async function revokeCallLink(
  createdBy: NexUuid,
  slug: string,
): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_call_link")
    .update({ revoked_at: new Date().toISOString() })
    .eq("slug", slug)
    .eq("created_by", createdBy)
    .is("revoked_at", null);
  if (error) {
    throw new Error(`call-link-service.revokeCallLink: ${error.message}`);
  }
}

export async function listCallLinksForCreator(
  createdBy: NexUuid,
  limit = 20,
): Promise<CallLinkRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_call_link")
    .select("*")
    .eq("created_by", createdBy)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(
      `call-link-service.listCallLinksForCreator: ${error.message}`,
    );
  }
  return (data as CallLinkRow[]) ?? [];
}
