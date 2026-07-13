// POST /api/canteens/posts/[id]/reply
//
// Replies to a canteen post. Creates a child row with parent_id set
// to the target post's id + inherits the parent's canteen_id.
// Membership check runs against the parent's canteen — host bypasses.
//
// Bumps the parent's reply_count best-effort (non-atomic; the
// recalc-metrics cron reconciles drift).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdentity } from "@/lib/merchantSession";

const MAX_BODY = 4000;
const MIN_BODY = 2;

type ReplyPayload = {
  body: string;
  photoUrls?: string[];
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const identity = await getMerchantIdentity();
  if (!identity) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }
  const { id: parentId } = await params;
  if (!parentId) {
    return NextResponse.json({ ok: false, error: "missing-parent" }, { status: 400 });
  }

  let payload: ReplyPayload;
  try {
    payload = (await req.json()) as ReplyPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const body = String(payload.body ?? "").trim();
  if (body.length < MIN_BODY) {
    return NextResponse.json({ ok: false, error: "body-too-short" }, { status: 400 });
  }
  if (body.length > MAX_BODY) {
    return NextResponse.json({ ok: false, error: "body-too-long" }, { status: 400 });
  }

  // Look up parent — need its canteen_id + status
  const parent = await supabaseAdmin
    .from("hammerex_canteen_posts")
    .select("id, canteen_id, status, reply_count")
    .eq("id", parentId)
    .maybeSingle();
  if (parent.error || !parent.data) {
    return NextResponse.json({ ok: false, error: "parent-not-found" }, { status: 404 });
  }
  if (parent.data.status !== "live") {
    return NextResponse.json({ ok: false, error: "parent-not-live" }, { status: 409 });
  }

  // Ownership / membership check against parent's canteen. Host of
  // that canteen always allowed.
  const canteen = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, host_slug")
    .eq("id", parent.data.canteen_id)
    .maybeSingle();
  if (canteen.error || !canteen.data) {
    return NextResponse.json({ ok: false, error: "canteen-not-found" }, { status: 404 });
  }
  const isHost = canteen.data.host_slug === identity.slug;
  if (!isHost) {
    const member = await supabaseAdmin
      .from("hammerex_canteen_members")
      .select("id, display_name, avatar_url")
      .eq("canteen_id", canteen.data.id)
      .eq("member_slug", identity.slug)
      .maybeSingle();
    if (!member.data) {
      return NextResponse.json({ ok: false, error: "not-a-member" }, { status: 403 });
    }
  }

  // Author display name — from the members table when possible so
  // canteen posts and their replies use the same identity string.
  const authorRes = await supabaseAdmin
    .from("hammerex_canteen_members")
    .select("display_name, avatar_url")
    .eq("canteen_id", canteen.data.id)
    .eq("member_slug", identity.slug)
    .maybeSingle();

  const insert = await supabaseAdmin
    .from("hammerex_canteen_posts")
    .insert({
      canteen_id: parent.data.canteen_id,
      parent_id: parentId,
      author_slug: identity.slug,
      author_display_name: authorRes.data?.display_name ?? identity.slug,
      author_avatar_url: authorRes.data?.avatar_url ?? null,
      kind: "chat",
      body,
      photo_urls: payload.photoUrls ?? [],
      status: "live"
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    // eslint-disable-next-line no-console
    console.error("[canteens.posts.reply] insert failed", insert.error);
    return NextResponse.json(
      { ok: false, error: "db-insert-failed", detail: insert.error?.message },
      { status: 500 }
    );
  }

  // Bump reply_count best-effort. Off by one under concurrency; the
  // recalc job reconciles drift periodically.
  await supabaseAdmin
    .from("hammerex_canteen_posts")
    .update({ reply_count: (parent.data.reply_count ?? 0) + 1 })
    .eq("id", parentId);

  return NextResponse.json({ ok: true, id: insert.data.id });
}
