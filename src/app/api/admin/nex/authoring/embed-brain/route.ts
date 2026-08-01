// POST /api/admin/nex/authoring/embed-brain
// Rebuild the semantic index · precomputes embeddings for every snippet.
// Called from the admin authoring page when knowledge changes.

import { NextResponse } from "next/server";
import { rebuildSemanticIndex } from "@/lib/nex/staircase-advisor/semantic-index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auth removed 2026-08-01 per Philip · local admin authoring.
export async function POST() {
  try {
    const result = await rebuildSemanticIndex();
    if (!result) {
      return NextResponse.json({ ok: false, error: "index build returned null" }, { status: 500 });
    }
    if (!result.ok) {
      return NextResponse.json({ ok: false, ...result }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "embed rebuild failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
