// src/lib/nex-native/emergency/_session.ts
//
// NEX Emergency Help · thin actor-id resolver.
//
// Wraps the sealed `resolveNexAppSessionFromContext` so the actions
// module reads a single typed `string | null` instead of a full
// session envelope. If the helper is unavailable at runtime (e.g.
// hermetic tests, early boot), returns `null` and the action layer
// surfaces `not_authenticated` without throwing.
//
// Server-only.

import "server-only";

type SessionLike = { account?: { id?: string | null } | null } | null;

export async function resolveActorAccountId(): Promise<string | null> {
  try {
    const mod: { resolveNexAppSessionFromContext?: () => Promise<SessionLike> } =
      await import("@/lib/nex-native/app/session");
    const fn = mod.resolveNexAppSessionFromContext;
    if (typeof fn !== "function") return null;
    const s = await fn();
    const id = s?.account?.id;
    if (typeof id === "string" && id.trim().length > 0) return id;
    return null;
  } catch {
    return null;
  }
}
