// src/app/api/nex/user/instructions/route.ts
//
// Founder Phase 19 · P19-2 · Custom instructions endpoints.
//
// GET  → { instructions }
// PUT  { preferred_language?, bio?, goals?, style?, do_not? } → { instructions, neutralised }

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/nex/identity-auth";
import { getCustomInstructions, setCustomInstructions } from "@/lib/nex/personalization/instructions";
import { listLanguagePacks } from "@/lib/nex/personalization/language-packs";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  if (!session?.user_id) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const instructions = await getCustomInstructions(session.user_id);
  return NextResponse.json({
    instructions,
    languages: listLanguagePacks().map((p) => ({ code: p.code, name_native: p.name_native })),
  });
}

export async function PUT(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  if (!session?.user_id) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }
  const out = await setCustomInstructions(session.user_id, body);
  return NextResponse.json({
    instructions: out.instructions,
    sanitiser_neutralised: out.neutralised,
    doctrine_note: "Custom instructions are context, not truth. They shape response style but every fact still traces to evidence.",
  });
}
