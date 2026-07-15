// POST /api/canteens/posts/[id]/guest-reply
//
// Accepts a guest reply (name + WhatsApp + body) on a canteen post
// and returns { ok: true }. Currently a stub — the real behaviour is
// still to build:
//
//   TODO(backend): store the row in a `canteen_guest_replies` table
//   with status = 'pending', keyed by post_id + phone_hash so the
//   rate-limit (1 per phone per 15 min) can be enforced.
//
//   TODO(backend): send a WhatsApp notification to the canteen host
//   with signed Approve / Reject / Open-in-admin links (single-use
//   token, no login required from WhatsApp).
//
//   TODO(anti-spam): reject bodies containing URLs, apply small
//   profanity blocklist, cap length, IP-throttle before hitting DB.
//
// The client-side UX (guest form → confirmation → "awaiting review"
// badge via localStorage) is already wired in ReactionRow in
// CanteenPageShell.tsx and works end-to-end regardless — this endpoint
// just needs to acknowledge the submission so the browser network tab
// stays clean.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  name?: unknown;
  whatsapp?: unknown;
  body?: unknown;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const whatsapp = typeof payload.whatsapp === "string" ? payload.whatsapp.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";

  if (name.length < 2) {
    return NextResponse.json({ ok: false, error: "invalid-name" }, { status: 400 });
  }
  if (whatsapp.replace(/[^0-9]/g, "").length < 7) {
    return NextResponse.json({ ok: false, error: "invalid-whatsapp" }, { status: 400 });
  }
  if (body.length < 4) {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  // eslint-disable-next-line no-console
  console.log("[guest-reply] pending", { postId: id, name, whatsapp, body });

  return NextResponse.json({
    ok: true,
    status: "pending",
    postId: id
  });
}
