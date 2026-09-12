// src/app/api/nex/directory/[ref_id]/chat/send/route.ts
//
// Founder Phase 31 · P31-4 · Send a message to a listing owner (NEX Chat).
// Doctrine #7 · PRIVATE MESSAGES · two-party envelope enforced.
//
// POST body: { body, owner_email_hint? }
// - body            : plain text · sanitised by Doctrine #5 before store
// - owner_email_hint: email the visitor gives us for the owner-invite
//                     path (used only if the listing has no owner_user_id
//                     yet). Stored as sha16 hash for privacy.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/nex/identity-auth";
import { sendMessage } from "@/lib/nex/listing-chat";
import { sendOwnerInviteEmail } from "@/lib/nex/listing-chat/owner-invite";
import { getListingDetail } from "@/lib/nex/directory";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ ref_id: string }> }) {
  const { ref_id } = await ctx.params;
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  if (!session?.user_id) {
    return NextResponse.json({ error: "unauthenticated", hint: "Sign in first (or use anonymous signup on /nexapp/settings)." }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }
  const messageBody = typeof body.body === "string" ? body.body : "";
  if (!messageBody || messageBody.length > 4000) {
    return NextResponse.json({ error: "invalid_body", hint: "1..4000 chars" }, { status: 400 });
  }
  const ownerEmailHint = typeof body.owner_email_hint === "string" ? body.owner_email_hint.trim() : "";

  // Verify the listing exists.
  const listing = await getListingDetail(decodeURIComponent(ref_id));
  if (!listing) return NextResponse.json({ error: "listing_not_found" }, { status: 404 });

  const result = await sendMessage({
    listing_ref: listing.ref_id,
    sender_user_id: session.user_id,
    body: messageBody,
  });

  // If this is the FIRST sender message AND the thread has no owner yet
  // AND the visitor supplied an owner email hint, fire the invite flow.
  let owner_invite = null;
  if (result.is_first_message_from_sender && !result.thread.owner_user_id && ownerEmailHint) {
    const host = req.headers.get("host") ?? "localhost:3008";
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    const invite = await sendOwnerInviteEmail({
      thread_id: result.thread.thread_id,
      listing_ref: listing.ref_id,
      listing_business_name: listing.title,
      owner_email: ownerEmailHint,
      first_message_body: result.message.body,
      base_url: `${proto}://${host}`,
    });
    owner_invite = {
      invite_token_prefix: invite.invite_token.slice(0, 8),   // safe hint · never full token in send response
      reply_url_scheme: `/nexapp/owner-inbox/<token>`,
      email_status: invite.email.status,
      smtp_configured: invite.smtp_configured,
      note: invite.email.note,
    };
  }

  return NextResponse.json({
    ok: true,
    thread_id: result.thread.thread_id,
    message: {
      message_id: result.message.message_id,
      from_role: result.message.from_role,
      body: result.message.body,
      sent_at: result.message.sent_at,
    },
    is_first_message_from_sender: result.is_first_message_from_sender,
    sanitiser_neutralised: result.sanitiser_neutralised,
    owner_invite,
    delivery_status: result.thread.owner_user_id
      ? "delivered_to_nex_inbox"
      : (owner_invite ? "queued_owner_invite" : "waiting_for_owner_email_hint"),
    doctrine_note:
      "Doctrine #7 · Private Messages · this message is a two-party envelope · NEX never trains on it. " +
      "Doctrine #5 sanitiser applied · " + result.sanitiser_neutralised + " pattern(s) neutralised.",
  });
}
