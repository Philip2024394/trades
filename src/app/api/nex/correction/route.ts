// POST /api/nex/correction
// Body: { entry_id?, original_message, nex_reply, correction }
//
// A merchant tells Nex "actually X is wrong". This files a correction
// review item so a human can turn it into a proper edit or new entry.
// Merchants can see their own submissions via RLS.

import { NextResponse, type NextRequest } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { submitCorrection } from "@/lib/nex/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await loadStudioSession();
  if (!session) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    entry_id?:       string;
    original_message: string;
    nex_reply:       string;
    correction:      string;
  } | null;
  if (!body?.correction?.trim()) return NextResponse.json({ ok: false, error: "empty_correction" }, { status: 400 });

  const { id } = await submitCorrection({
    entryId:         body.entry_id ?? null,
    message:         body.correction,
    merchantSlug:    session.merchant.slug,
    nexReply:        body.nex_reply ?? "",
    originalMessage: body.original_message ?? ""
  });

  return NextResponse.json({ ok: true, review_id: id });
}
