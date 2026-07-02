// POST /api/studio/brand/extract  { url }
//
// Fetches the given URL server-side, scrapes candidate brand tokens
// (theme-color, Google Fonts, common inline hex colours) and returns
// them for the merchant to review. NEVER auto-applies — the wizard
// UI POSTs individual accepted candidates to /api/studio/tokens.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { extractBrandFromUrl } from "@/lib/studio/brandExtractor";

export const runtime = "nodejs";

type ExtractRequest = { url: string };

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  let body: ExtractRequest;
  try {
    body = (await req.json()) as ExtractRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }
  if (typeof body.url !== "string" || body.url.trim().length < 4) {
    return NextResponse.json(
      { ok: false, error: "invalid-url" },
      { status: 400 }
    );
  }
  try {
    const result = await extractBrandFromUrl(body.url);
    return NextResponse.json({ ok: true, candidates: result });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: (err as Error)?.message ?? "extraction-failed"
      },
      { status: 502 }
    );
  }
}
