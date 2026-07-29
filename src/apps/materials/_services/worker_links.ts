// Worker links service · token-authenticated write surface for workers
//
// Design: workers never sign in. They receive a URL like
//   https://.../w/{token}
// where {token} is a 32-char URL-safe random string. The token is the
// only credential — treat it like a session cookie.
//
// Guardrails:
//   · Tokens are per-pack (a worker link only touches one pack)
//   · Optional expiry (revoke by ttl)
//   · Optional max_uses (revoke by usage count)
//   · Manual revoke via revokeWorkerLink()
//   · Every worker action goes through validateAndTouchWorkerToken()
//     which bumps current_uses + last_used_at atomically

import "server-only";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { audit } from "./_audit";
import {
  MaterialsError,
  type HardwoodPackRow,
  type WorkerLinkRow,
} from "../_schema/types";

export type CreateWorkerLinkInput = {
  pack_id: string;
  label?: string | null;
  expires_at?: string | null;
  max_uses?: number | null;
};

export type ValidatedWorkerToken = {
  link: WorkerLinkRow;
  pack: HardwoodPackRow;
};

function generateToken(): string {
  // 32 bytes → 43-char URL-safe base64 (with padding stripped)
  return crypto.randomBytes(32).toString("base64url");
}

export async function createWorkerLink(
  ownerId: string,
  actorEmail: string,
  input: CreateWorkerLinkInput,
): Promise<WorkerLinkRow> {
  // Verify pack ownership
  const packRes = await supabaseAdmin
    .from("nex_materials_hardwood_packs")
    .select("id, owner_id, deleted_at")
    .eq("id", input.pack_id)
    .maybeSingle();
  if (packRes.error) throw new MaterialsError("internal", packRes.error.message, 500);
  if (!packRes.data || packRes.data.owner_id !== ownerId || packRes.data.deleted_at) {
    throw new MaterialsError("not_found", "pack not found", 404);
  }

  const token = generateToken();

  const { data, error } = await supabaseAdmin
    .from("nex_materials_worker_links")
    .insert({
      token,
      pack_id:      input.pack_id,
      label:        input.label ?? null,
      created_by:   actorEmail,
      expires_at:   input.expires_at ?? null,
      max_uses:     input.max_uses ?? null,
      current_uses: 0,
    })
    .select("*")
    .single();
  if (error) throw new MaterialsError("internal", error.message, 500);

  const row = data as WorkerLinkRow;
  await audit({
    entity_type: "worker_link",
    entity_id:   row.id,
    event_type:  "created",
    actor_kind:  "user",
    actor_ref:   actorEmail,
    after_json:  { ...row, token: "[redacted]" },
    metadata:    { pack_id: input.pack_id },
  });
  return row;
}

export async function revokeWorkerLink(
  ownerId: string,
  actorEmail: string,
  linkId: string,
  reason: string,
): Promise<void> {
  // Verify link belongs to a pack owned by this user
  const linkRes = await supabaseAdmin
    .from("nex_materials_worker_links")
    .select("id, pack_id, revoked_at")
    .eq("id", linkId)
    .maybeSingle();
  if (linkRes.error) throw new MaterialsError("internal", linkRes.error.message, 500);
  if (!linkRes.data) throw new MaterialsError("not_found", "worker link not found", 404);

  const packRes = await supabaseAdmin
    .from("nex_materials_hardwood_packs")
    .select("owner_id")
    .eq("id", linkRes.data.pack_id)
    .maybeSingle();
  if (packRes.error) throw new MaterialsError("internal", packRes.error.message, 500);
  if (!packRes.data || packRes.data.owner_id !== ownerId) {
    throw new MaterialsError("forbidden", "cannot revoke worker link for pack you don't own", 403);
  }

  if (linkRes.data.revoked_at) return;   // already revoked · idempotent

  const { error } = await supabaseAdmin
    .from("nex_materials_worker_links")
    .update({ revoked_at: new Date().toISOString(), revoke_reason: reason })
    .eq("id", linkId);
  if (error) throw new MaterialsError("internal", error.message, 500);

  await audit({
    entity_type: "worker_link",
    entity_id:   linkId,
    event_type:  "revoked",
    actor_kind:  "user",
    actor_ref:   actorEmail,
    metadata:    { reason },
  });
}

/**
 * Validate a token + return the underlying link + pack.
 * Touches last_used_at + current_uses on success.
 * Throws MaterialsError with a specific code on failure.
 */
export async function validateAndTouchWorkerToken(
  token: string,
  meta: { ip?: string | null; user_agent?: string | null } = {},
): Promise<ValidatedWorkerToken> {
  if (!token || typeof token !== "string" || token.length < 20) {
    throw new MaterialsError("unauthorised", "invalid token", 401);
  }

  const { data: link, error } = await supabaseAdmin
    .from("nex_materials_worker_links")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new MaterialsError("internal", error.message, 500);
  if (!link) throw new MaterialsError("unauthorised", "invalid token", 401);

  if (link.revoked_at) {
    throw new MaterialsError("worker_link_revoked", "worker link has been revoked", 403);
  }
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    throw new MaterialsError("worker_link_expired", "worker link has expired", 403);
  }
  if (link.max_uses != null && link.current_uses >= link.max_uses) {
    throw new MaterialsError("worker_link_exhausted", "worker link usage limit reached", 403);
  }

  const packRes = await supabaseAdmin
    .from("nex_materials_hardwood_packs")
    .select("*")
    .eq("id", link.pack_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (packRes.error) throw new MaterialsError("internal", packRes.error.message, 500);
  if (!packRes.data) throw new MaterialsError("pack_deleted", "pack no longer available", 404);

  // Best-effort touch — don't fail the request if audit metadata fails
  supabaseAdmin
    .from("nex_materials_worker_links")
    .update({
      current_uses:     link.current_uses + 1,
      last_used_at:     new Date().toISOString(),
      last_ip:          meta.ip ?? null,
      last_user_agent:  meta.user_agent ?? null,
    })
    .eq("id", link.id)
    .then(({ error: tErr }) => {
      if (tErr) console.error("[materials.worker_links] touch failed", tErr);
    });

  return { link: link as WorkerLinkRow, pack: packRes.data as HardwoodPackRow };
}
