// src/app/api/nex/share/[token]/route.ts
//
// Founder Phase 13 · P13-4 · Read a shared conversation by opaque token.
// GET → { conversation, messages } · increments view_count.

import { NextResponse } from "next/server";
import { getSharedConversation } from "@/lib/nex/conversations";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const data = await getSharedConversation(token);
  if (!data) return NextResponse.json({ error: "not_found_or_revoked" }, { status: 404 });
  return NextResponse.json({
    ...data,
    doctrine_note: "This is a read-only shared conversation. NEX doctrines still apply: no fact establishes truth without the underlying evidence chain.",
  });
}
