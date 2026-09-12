// src/app/api/nex/directory/[ref_id]/chat/history/route.ts
//
// Founder Phase 31 · P31-5 · Read the visitor's own thread for this listing.
// Doctrine #7 · scoped by (listing_ref, sender_user_id = session.user_id).
// A visitor CAN ONLY see their own thread with this listing — never anyone
// else's · never another user's messages.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/nex/identity-auth";
import { readThreadForSender } from "@/lib/nex/listing-chat";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ ref_id: string }> }) {
  const { ref_id } = await ctx.params;
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  if (!session?.user_id) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const listing_ref = decodeURIComponent(ref_id);
  const { thread, messages } = await readThreadForSender({
    listing_ref, sender_user_id: session.user_id, limit: 200,
  });
  return NextResponse.json({
    thread, messages,
    doctrine_note: "Doctrine #7 · you can only read your own thread with this listing. Owner replies land here.",
  });
}
