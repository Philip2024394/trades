// POST /api/memory/ask
//
// The killer endpoint. Merchant types "show me every sandstone patio
// in LS6 with grey pointing" — we translate + query + synthesise an
// answer + return the underlying record hits.
//
// Body: { merchantId, question }
// Response: { plan, hits, answer }

import { NextResponse } from "next/server";
import { askMemory } from "@/lib/memory/nlQuery";
import { synthesiseAnswer } from "@/lib/memory/answerSynth";

export const runtime = "nodejs";

type Body = { merchantId?: string; question?: string };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.merchantId || !body?.question) {
    return NextResponse.json(
      { error: "merchantId + question required" },
      { status: 400 }
    );
  }
  const { plan, hits } = await askMemory(body.merchantId, body.question);
  const answer = await synthesiseAnswer(body.question, hits);
  return NextResponse.json({ plan, hits, answer });
}
