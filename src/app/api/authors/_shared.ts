// Shared helpers for /api/authors/* Author Studio endpoints.
//
// Every Author Studio endpoint calls requireStudio() first — enforces
// the feature flag AND the Author session in one gate. Merchants and
// homeowners can't touch these endpoints even by URL guessing.

import { NextResponse } from "next/server";
import { getAuthorFromCookie, nexAuthorStudioEnabled } from "@/lib/nex/brains/_studio";

export type StudioGateResult =
  | { ok: true; authorId: string }
  | { ok: false; response: NextResponse };

export async function requireStudio(): Promise<StudioGateResult> {
  if (!nexAuthorStudioEnabled()) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "author_studio_disabled" },
        { status: 503 }
      )
    };
  }
  const authorId = await getAuthorFromCookie();
  if (!authorId) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "not_authorized" },
        { status: 401 }
      )
    };
  }
  return { ok: true, authorId };
}

export function jsonError(code: string, detail: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error: code, detail }, { status });
}

export function jsonOk(payload: unknown, status = 200): NextResponse {
  return NextResponse.json({ ok: true, ...(payload as object) }, { status });
}
