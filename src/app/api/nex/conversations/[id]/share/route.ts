// src/app/api/nex/conversations/[id]/share/route.ts
//
// Founder Phase 13 · P13-4 · Create a public read-only share link.
// POST → { share_token, view_url }

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/nex/identity-auth";
import { shareConversation } from "@/lib/nex/conversations";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  const out = await shareConversation(id, session?.user_id ?? null);
  if (!out) return NextResponse.json({ error: "persistence_unavailable" }, { status: 503 });
  return NextResponse.json(out);
}
