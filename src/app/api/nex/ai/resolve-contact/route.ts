// POST /api/nex/ai/resolve-contact — the AI's front door to the Contact Registry
//
// Every NEX Brain worker / AI-adjacent tool that needs to identify a
// person calls this endpoint. Follows aliases automatically · returns
// ranked matches with confidence so callers can ask clarifying questions
// when the top match is ambiguous.
//
// Body: ContactResolveInput
//   { contact_id?, email?, phone?, name_hint?, company_hint?, free_text?, caller? }

import { NextResponse } from "next/server";
import { resolveContactForAI } from "@/lib/nex/ai/contact_resolver";
import type { ContactResolveInput } from "@/lib/nex/ai/contact_resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: ContactResolveInput;
  try { body = (await request.json()) as ContactResolveInput; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const result = await resolveContactForAI(body);
  return NextResponse.json({ ok: true, ...result });
}
