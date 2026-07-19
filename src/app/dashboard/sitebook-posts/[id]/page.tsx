// /dashboard/sitebook-posts/[id] — merchant view of a single SiteBook
// post they've been invited to, with reply thread + reply composer.
//
// Access-gated: canMerchantAccessPost() ensures they're either an
// invited member (visibility='selected') or a project member with
// broadcast visibility.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadPostWithReplies, canMerchantAccessPost } from "@/lib/homeowners/posts";
import { PostFeedCard } from "@/components/homeowners/PostFeedCard";
import type { SiteBookProject } from "@/lib/homeowners/types";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";

async function getListing() {
  const c = await cookies();
  const slug = c.get("tn_merchant_slug")?.value;
  if (!slug) return null;
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, business_name, slug")
    .eq("slug", slug)
    .maybeSingle();
  return res.data as { id: string; business_name: string; slug: string } | null;
}

export default async function MerchantPostViewPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: postId } = await params;
  const listing = await getListing();
  if (!listing) redirect(`/trade-off/login?next=/dashboard/sitebook-posts/${postId}`);

  const allowed = await canMerchantAccessPost(postId, listing.id);
  if (!allowed) notFound();

  const detail = await loadPostWithReplies(postId);
  if (!detail) notFound();

  const projRes = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("*")
    .eq("id", detail.post.project_id)
    .maybeSingle();
  const project = projRes.data as SiteBookProject | null;

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href="/dashboard/sitebook-posts" className="inline-flex items-center gap-1.5 text-[12px] font-bold text-neutral-600 hover:text-neutral-900">
          <ArrowLeft size={13} strokeWidth={2.4}/>
          Back to SiteBook inbox
        </Link>

        <div className="mt-4">
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
            SiteBook post
          </p>
          <h1 className="mt-1 text-lg font-black text-neutral-900">
            {project?.title || "Project post"}
          </h1>
        </div>

        <div className="mt-6">
          <PostFeedCard
            post={detail.post}
            replies={detail.replies}
            members={detail.members}
            projectName={project?.title || "Project"}
            viewerType="trade"
            viewerInitial={listing.business_name.substring(0, 1).toUpperCase()}
            replyPostUrl={`/api/merchant/posts/${detail.post.id}/replies`}
          />
        </div>
      </section>
    </main>
  );
}
