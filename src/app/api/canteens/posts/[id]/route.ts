// DELETE /api/canteens/posts/[id]
//
// Remove a canteen post. Author or the canteen's host can remove.
// Replies cascade via the ON DELETE CASCADE FK on parent_id.
// Photo URLs are stripped from Supabase Storage so nothing orphans
// in the bucket.
//
// Never hard-deletes without ownership — anonymous callers get 401,
// wrong-owner callers get 403.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { deleteStorageObjects } from "@/lib/uploads.server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const callerSlug = await getMerchantSlug();
  if (!callerSlug) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });
  }

  const post = await supabaseAdmin
    .from("hammerex_canteen_posts")
    .select("id, canteen_id, author_slug, photo_urls, parent_id")
    .eq("id", id)
    .maybeSingle();
  if (post.error) {
    return NextResponse.json({ ok: false, error: "db-lookup-failed" }, { status: 500 });
  }
  if (!post.data) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  // Ownership — author OR host of the post's canteen
  const isAuthor = post.data.author_slug === callerSlug;
  let isHost = false;
  if (!isAuthor) {
    const canteen = await supabaseAdmin
      .from("hammerex_canteens")
      .select("host_slug")
      .eq("id", post.data.canteen_id)
      .maybeSingle();
    isHost = canteen.data?.host_slug === callerSlug;
  }
  if (!isAuthor && !isHost) {
    return NextResponse.json({ ok: false, error: "not-owner" }, { status: 403 });
  }

  // Gather all photo URLs to purge — from THIS post + every reply
  // that will cascade (children with parent_id = id).
  const photoUrls = [...((post.data.photo_urls ?? []) as string[])];
  if (!post.data.parent_id) {
    const replies = await supabaseAdmin
      .from("hammerex_canteen_posts")
      .select("photo_urls")
      .eq("parent_id", id);
    for (const r of replies.data ?? []) {
      photoUrls.push(...((r.photo_urls ?? []) as string[]));
    }
  }

  // Delete the row. FK cascade purges children.
  const del = await supabaseAdmin
    .from("hammerex_canteen_posts")
    .delete()
    .eq("id", id);
  if (del.error) {
    return NextResponse.json(
      { ok: false, error: "db-delete-failed", detail: del.error.message },
      { status: 500 }
    );
  }

  // Bucket cleanup — non-network URLs skipped silently.
  if (photoUrls.length > 0) {
    await deleteStorageObjects(photoUrls);
  }

  return NextResponse.json({ ok: true, removedPhotos: photoUrls.length });
}
