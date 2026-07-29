// src/lib/nex/brains/_actor.ts
//
// F1 · Real Authentication · v2 (Philip 2026-07-28 · D1 Supabase Auth)
// ─────────────────────────────────────────────────────────────────────
// This module resolves the acting identity for every admin mutation
// route. Session-based authentication now lives in `_auth.ts`; this
// file wraps it into the BrainActor shape the writer and event log
// expect, and preserves the dev bypass path for local iteration.
//
// Architecture (per Philip's D1 directive):
//   • Supabase Auth answers "who is this?"          → getAuthenticatedUser()
//   • hammerex_nex_users answers "what role?"       → NexUserRow.role
//   • This module maps user.email + user.role to the BrainActor shape
//     the existing withBrainWrite + review + publish routes consume
//
// Dev bypass: NEX_DEV_AUTH_BYPASS=1 + NODE_ENV != production preserves
// the header-based flow for local iteration.

import { getAuthenticatedUser } from "./_auth";

export type BrainActor = {
  actor_id: string;
  actor_role: "author" | "reviewer" | "admin" | "system" | "runtime";
};

export type ActorResult =
  | { ok: true; actor: BrainActor }
  | { ok: false; error: string; status: number };

const KNOWN_ROLES = ["author", "reviewer", "admin", "system", "runtime"] as const;

/**
 * Extract + validate the actor identity from an incoming request.
 * ASYNC because it reads Supabase Auth session cookies. Callers must
 * `await` it.
 *
 * Returns a tagged union so callers early-return the right HTTP status
 * without exception handling.
 */
export async function extractActor(req: Request): Promise<ActorResult> {
  const url = new URL(req.url);
  const devBypass =
    process.env.NEX_DEV_AUTH_BYPASS === "1" &&
    process.env.NODE_ENV !== "production";

  if (devBypass) {
    const id =
      req.headers.get("x-nex-actor-id") ??
      req.headers.get("x-actor-id") ??
      url.searchParams.get("actor_id") ??
      "dev@localhost";
    const rawRole =
      req.headers.get("x-nex-actor-role") ??
      req.headers.get("x-actor-role") ??
      url.searchParams.get("actor_role") ??
      "admin";
    const role = (KNOWN_ROLES as readonly string[]).includes(rawRole)
      ? (rawRole as BrainActor["actor_role"])
      : "admin";
    return { ok: true, actor: { actor_id: id, actor_role: role } };
  }

  // Production path — real Supabase Auth session + NexUser lookup
  const authResult = await getAuthenticatedUser();
  if (!authResult.ok) {
    return { ok: false, error: authResult.error, status: authResult.status };
  }

  const { user } = authResult;
  return {
    ok: true,
    actor: {
      actor_id: user.email,
      actor_role: user.nex_user.role,
    },
  };
}

// ---------- Semver helpers (unchanged) ----------

/** Bump a semver like "1.2.3" → "1.2.4" (patch). Throws on malformed input. */
export function bumpPatch(semver: string): string {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(semver.trim());
  if (!m) throw new Error(`Invalid semver: '${semver}'`);
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

/** Compare two semvers. Returns -1 · 0 · +1. Missing segments treated as 0. */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split(".").map((n) => Number(n) || 0);
  const pb = b.split(".").map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}
