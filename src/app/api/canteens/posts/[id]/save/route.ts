// POST   /api/canteens/posts/[id]/save   — bookmark a canteen post
// DELETE /api/canteens/posts/[id]/save   — un-bookmark
//
// Save exempts the target post from the 30-post feed rotation on its
// canteen (see /api/canteens/[slug]/posts/create). Any single save
// keeps the post alive; when the last saver un-saves, the post is
// eligible for rotation on the next fresh post.
//
// Auth required — a save carries the merchant slug of the person
// bookmarking so the recalc job can attribute + notify. Guests who
// want to bookmark client-side still can (feed shell keeps a
// localStorage set), but that bookmark does NOT protect from
// rotation because it's invisible to the server.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdentity } from "@/lib/merchantSession";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const identity = await getMerchantIdentity();
  if (!identity) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }
  const { id: postId } = await params;
  if (!postId) {
    return NextResponse.json({ ok: false, error: "missing-post-id" }, { status: 400 });
  }

  // Look up the post's canteen so we can populate canteen_id on the
  // save row — the create-post rotation query filters by canteen and
  // we don't want to join through posts on every rotation.
  const post = await supabaseAdmin
    .from("hammerex_canteen_posts")
    .select("id, canteen_id")
    .eq("id", postId)
    .maybeSingle();
  if (post.error || !post.data) {
    return NextResponse.json({ ok: false, error: "post-not-found" }, { status: 404 });
  }

  // Upsert against the unique (post_id, saver_slug) index — a repeat
  // POST is idempotent, returns the same row.
  const insert = await supabaseAdmin
    .from("hammerex_canteen_saved_posts")
    .upsert(
      {
        post_id: postId,
        canteen_id: post.data.canteen_id,
        saver_slug: identity.slug
      },
      { onConflict: "post_id,saver_slug", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (insert.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.posts.save] upsert failed", insert.error);
    return NextResponse.json(
      { ok: false, error: "db-insert-failed", detail: insert.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, saved: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const identity = await getMerchantIdentity();
  if (!identity) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }
  const { id: postId } = await params;
  if (!postId) {
    return NextResponse.json({ ok: false, error: "missing-post-id" }, { status: 400 });
  }

  const del = await supabaseAdmin
    .from("hammerex_canteen_saved_posts")
    .delete()
    .eq("post_id", postId)
    .eq("saver_slug", identity.slug);

  if (del.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.posts.save] delete failed", del.error);
    return NextResponse.json(
      { ok: false, error: "db-delete-failed", detail: del.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, saved: false });
}
