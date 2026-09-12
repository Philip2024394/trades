// src/lib/nex/api-platform/bearer-auth.ts
//
// Founder Phase 14 · P14-2 · Bearer-token auth for public API.
//
// Extracts the token from either:
//   · `Authorization: Bearer nex_live_...`
//   · `X-NEX-Api-Key: nex_live_...`   (convenience alias)
// Returns null if missing/invalid/revoked · caller decides on 401.

import { resolveApiKey, type ApiKeyRow } from "./keys";

export function extractBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (auth) {
    const m = auth.match(/^Bearer\s+(nex_live_[A-Za-z0-9]+)\s*$/);
    if (m) return m[1];
  }
  const x = req.headers.get("x-nex-api-key");
  if (x && /^nex_live_[A-Za-z0-9]+$/.test(x.trim())) return x.trim();
  return null;
}

export async function requireApiKey(req: Request, requiredScope?: string): Promise<
  | { ok: true; key: ApiKeyRow }
  | { ok: false; status: number; error: string }
> {
  const raw = extractBearerToken(req);
  if (!raw) return { ok: false, status: 401, error: "missing_api_key" };
  const key = await resolveApiKey(raw);
  if (!key) return { ok: false, status: 401, error: "invalid_or_revoked_key" };
  if (requiredScope && !key.scopes.includes(requiredScope)) {
    return { ok: false, status: 403, error: `missing_scope:${requiredScope}` };
  }
  return { ok: true, key };
}
