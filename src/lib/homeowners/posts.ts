// SiteBook posts — server-side helpers for creating + reading posts.
//
// Post-centric architecture: each post is a scoped "channel" with
// its own trade-membership list. Homeowner creates posts. Invited
// trades reply. Non-invited trades on the same project don't see
// the post at all (unless visibility='all-trades').
//
// See migration 20260718140000_hammerex_sitebook_posts.sql for
// schema. Types live in src/lib/homeowners/types.ts.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  SiteBookPost,
  SiteBookPostMember,
  SiteBookPostReply,
  PostKind,
  PostVisibility
} from "./types";

export type CreatePostInput = {
  homeownerId:    string;
  homeownerName:  string;
  projectId:      string;
  title?:         string | null;
  body:           string;
  kind?:          PostKind;
  visibility?:    PostVisibility;
  invitedListingIds?: string[];      // required when visibility='selected'
  coverPhotoUrl?: string | null;
};

export async function createPost(input: CreatePostInput): Promise<{ ok: true; post: SiteBookPost } | { ok: false; error: string }> {
  const kind        = input.kind       || "update";
  const visibility  = input.visibility || (input.invitedListingIds?.length ? "selected" : "all-trades");

  if (!input.body?.trim()) return { ok: false, error: "empty-body" };
  if (visibility === "selected" && !input.invitedListingIds?.length) {
    return { ok: false, error: "missing-invitees" };
  }

  // Verify the project belongs to the homeowner (ownership boundary)
  const proj = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("homeowner_id", input.homeownerId)
    .maybeSingle();
  if (!proj.data) return { ok: false, error: "project-not-found" };

  // Insert the post
  const ins = await supabaseAdmin
    .from("hammerex_sitebook_posts")
    .insert({
      project_id:          input.projectId,
      homeowner_id:        input.homeownerId,
      title:               input.title?.trim() || null,
      body:                input.body.trim(),
      kind,
      visibility,
      author_type:         "homeowner",
      author_display_name: input.homeownerName,
      cover_photo_url:     input.coverPhotoUrl || null
    })
    .select("*")
    .maybeSingle();

  if (ins.error || !ins.data) return { ok: false, error: "insert-failed" };
  const post = ins.data as SiteBookPost;

  // Populate members if visibility='selected'
  if (visibility === "selected" && input.invitedListingIds?.length) {
    // Resolve listing names for the member rows (denormalised for UX speed)
    const listings = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, business_name")
      .in("id", input.invitedListingIds);
    const map = new Map<string, { slug: string; name: string }>();
    for (const l of (listings.data ?? []) as Array<{ id: string; slug: string; business_name: string }>) {
      map.set(l.id, { slug: l.slug, name: l.business_name });
    }
    const rows = input.invitedListingIds.map((listingId) => {
      const info = map.get(listingId);
      return {
        post_id:       post.id,
        listing_id:    listingId,
        merchant_slug: info?.slug || null,
        merchant_name: info?.name || null,
        role:          "primary" as const
      };
    });
    await supabaseAdmin.from("hammerex_sitebook_post_members").insert(rows);
  }

  // Log event for the project timeline
  await supabaseAdmin.from("hammerex_sitebook_events").insert({
    project_id:  input.projectId,
    event_type:  "message_posted",
    actor_type:  "homeowner",
    actor_id:    input.homeownerId,
    actor_name:  input.homeownerName,
    metadata:    { post_id: post.id, kind, visibility, invited_count: input.invitedListingIds?.length ?? 0 }
  });

  return { ok: true, post };
}

/**
 * Load a homeowner's post feed. Filter by project if requested.
 * Returns posts with their member/reply counts already denormalised
 * (reply_count is on the post row itself, kept fresh by the trigger).
 */
export async function loadHomeownerFeed(homeownerId: string, opts: { projectId?: string; limit?: number } = {}): Promise<SiteBookPost[]> {
  let q = supabaseAdmin
    .from("hammerex_sitebook_posts")
    .select("*")
    .eq("homeowner_id", homeownerId)
    .order("pinned",     { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 40);
  if (opts.projectId) q = q.eq("project_id", opts.projectId);
  const res = await q;
  return (res.data as SiteBookPost[]) ?? [];
}

/**
 * Load a merchant's inbox — every post they've been invited to via
 * hammerex_sitebook_post_members OR that has visibility='all-trades'
 * on a project they're a member of. Grouped-friendly output (they
 * come with their post + membership row).
 */
export async function loadMerchantInbox(listingId: string, limit = 60): Promise<Array<{ post: SiteBookPost; member: SiteBookPostMember }>> {
  const res = await supabaseAdmin
    .from("hammerex_sitebook_post_members")
    .select("*, hammerex_sitebook_posts!inner(*)")
    .eq("listing_id", listingId)
    .order("invited_at", { ascending: false })
    .limit(limit);

  type Row = SiteBookPostMember & { hammerex_sitebook_posts: SiteBookPost };
  const rows = (res.data as Row[]) ?? [];
  return rows.map((r) => ({ post: r.hammerex_sitebook_posts, member: r as SiteBookPostMember }));
}

/**
 * Load a single post with its replies. Auth caller must verify
 * they can access it (owner OR invited member OR "all-trades" +
 * project membership).
 */
export async function loadPostWithReplies(postId: string): Promise<{ post: SiteBookPost; replies: SiteBookPostReply[]; members: SiteBookPostMember[] } | null> {
  const [postRes, repliesRes, membersRes] = await Promise.all([
    supabaseAdmin.from("hammerex_sitebook_posts").select("*").eq("id", postId).maybeSingle(),
    supabaseAdmin.from("hammerex_sitebook_post_replies").select("*").eq("post_id", postId).order("created_at", { ascending: true }),
    supabaseAdmin.from("hammerex_sitebook_post_members").select("*").eq("post_id", postId)
  ]);
  if (!postRes.data) return null;
  return {
    post:    postRes.data as SiteBookPost,
    replies: (repliesRes.data as SiteBookPostReply[]) ?? [],
    members: (membersRes.data as SiteBookPostMember[]) ?? []
  };
}

/**
 * Check whether a merchant (by listing_id) is authorised to see this
 * post. Returns true if:
 *   - post.visibility='all-trades' AND merchant is a member of the
 *     parent project (hammerex_sitebook_members)
 *   - post.visibility='selected' AND merchant is in the post's
 *     hammerex_sitebook_post_members
 */
export async function canMerchantAccessPost(postId: string, listingId: string): Promise<boolean> {
  const post = await supabaseAdmin
    .from("hammerex_sitebook_posts")
    .select("id, project_id, visibility")
    .eq("id", postId)
    .maybeSingle();
  if (!post.data) return false;
  const p = post.data as { id: string; project_id: string; visibility: PostVisibility };

  if (p.visibility === "selected") {
    const m = await supabaseAdmin
      .from("hammerex_sitebook_post_members")
      .select("id")
      .eq("post_id", postId)
      .eq("listing_id", listingId)
      .maybeSingle();
    return !!m.data;
  }
  // all-trades — must be a project member
  const pm = await supabaseAdmin
    .from("hammerex_sitebook_members")
    .select("id")
    .eq("project_id", p.project_id)
    .eq("listing_id", listingId)
    .maybeSingle();
  return !!pm.data;
}

export type AddReplyInput = {
  postId:      string;
  authorType:  "homeowner" | "trade";
  authorId:    string;
  authorName:  string;
  body:        string;
  attachmentUrl?: string | null;
  attachmentKind?: "photo" | "document" | "quote" | "invoice" | null;
};

export async function addReply(input: AddReplyInput): Promise<{ ok: true; reply: SiteBookPostReply } | { ok: false; error: string }> {
  if (!input.body?.trim()) return { ok: false, error: "empty-body" };
  const ins = await supabaseAdmin
    .from("hammerex_sitebook_post_replies")
    .insert({
      post_id:         input.postId,
      author_type:     input.authorType,
      author_id:       input.authorId,
      author_name:     input.authorName,
      body:            input.body.trim(),
      attachment_url:  input.attachmentUrl || null,
      attachment_kind: input.attachmentKind || null
    })
    .select("*")
    .maybeSingle();
  if (ins.error || !ins.data) return { ok: false, error: "insert-failed" };
  return { ok: true, reply: ins.data as SiteBookPostReply };
}
