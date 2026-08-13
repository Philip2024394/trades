// Internal helpers shared across the /api/nex/refacing/cases/[rf_id]/*
// endpoints. Centralises token extraction, error shaping, and JSON parsing
// so every endpoint behaves identically.
//
// Not exported from index.ts · only imported by API routes in this namespace.

import type { NextRequest } from "next/server";

export function extractToken(req: NextRequest): string | null {
  const q = new URL(req.url).searchParams.get("token");
  if (q) return q;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function parseJsonBody<T = unknown>(
  req: NextRequest
): Promise<{ ok: true; body: T } | { ok: false; response: Response }> {
  try {
    const body = (await req.json()) as T;
    return { ok: true, body };
  } catch {
    return {
      ok: false,
      response: Response.json({ ok: false, error: "invalid_json" }, { status: 400 }),
    };
  }
}
