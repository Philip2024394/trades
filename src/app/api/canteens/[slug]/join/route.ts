// POST   /api/canteens/[slug]/join  — join a canteen as a member
// DELETE /api/canteens/[slug]/join  — leave a canteen
//
// Members are the signed-in merchant identifying themselves via
// their trade session. Role defaults to 'member' — admin/moderator
// promotions are a separate host-only endpoint (follow-up).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdentity } from "@/lib/merchantSession";

type JoinPayload = {
  displayName?: string;
  tradeLabel?: string;
  city?: string;
  avatarUrl?: string;
  whatsapp?: string;
  bioShort?: string;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const identity = await getMerchantIdentity();
  if (!identity) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }
  const { slug } = await params;

  let payload: JoinPayload;
  try {
    payload = (await req.json()) as JoinPayload;
  } catch {
    // Body is optional — joins can be triggered from a tap without
    // any extra profile fields.
    payload = {};
  }

  const canteen = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, member_count")
    .eq("slug", slug)
    .maybeSingle();

  if (canteen.error || !canteen.data) {
    return NextResponse.json({ ok: false, error: "canteen-not-found" }, { status: 404 });
  }

  // Idempotent — inserting the same (canteen_id, member_slug) twice
  // hits the UNIQUE constraint. Treat that as success.
  const insert = await supabaseAdmin
    .from("hammerex_canteen_members")
    .insert({
      canteen_id: canteen.data.id,
      member_slug: identity.slug,
      display_name: payload.displayName?.trim() || identity.slug,
      trade_label: payload.tradeLabel?.trim() || "Trade",
      city: payload.city?.trim() ?? null,
      avatar_url: payload.avatarUrl?.trim() ?? null,
      whatsapp: payload.whatsapp?.trim() ?? null,
      bio_short: payload.bioShort?.trim() ?? null,
      role: "member"
    });

  if (insert.error) {
    if (insert.error.code === "23505") {
      // Already a member — idempotent success.
      return NextResponse.json({ ok: true, alreadyMember: true });
    }
    // eslint-disable-next-line no-console
    console.error("[canteens.join] insert failed", insert.error);
    return NextResponse.json(
      { ok: false, error: "db-insert-failed", detail: insert.error.message },
      { status: 500 }
    );
  }

  // Best-effort member-count bump. Non-atomic — a follow-up ship uses
  // a trigger to recompute member_count from a COUNT(*) on inserts.
  await supabaseAdmin
    .from("hammerex_canteens")
    .update({ member_count: (canteen.data.member_count ?? 0) + 1 })
    .eq("id", canteen.data.id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const identity = await getMerchantIdentity();
  if (!identity) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }
  const { slug } = await params;

  const canteen = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, host_slug, member_count")
    .eq("slug", slug)
    .maybeSingle();

  if (canteen.error || !canteen.data) {
    return NextResponse.json({ ok: false, error: "canteen-not-found" }, { status: 404 });
  }

  // The host can never leave — they own the room. Handing over
  // hosting is a follow-up endpoint.
  if (canteen.data.host_slug === identity.slug) {
    return NextResponse.json({ ok: false, error: "host-cant-leave" }, { status: 403 });
  }

  const del = await supabaseAdmin
    .from("hammerex_canteen_members")
    .delete()
    .eq("canteen_id", canteen.data.id)
    .eq("member_slug", identity.slug);

  if (del.error) {
    return NextResponse.json(
      { ok: false, error: "db-delete-failed", detail: del.error.message },
      { status: 500 }
    );
  }

  await supabaseAdmin
    .from("hammerex_canteens")
    .update({ member_count: Math.max(0, (canteen.data.member_count ?? 1) - 1) })
    .eq("id", canteen.data.id);

  return NextResponse.json({ ok: true });
}
