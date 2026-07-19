// /dashboard/sitebook-posts — merchant's SiteBook inbox.
//
// Timeline of every post the merchant has been invited to across all
// homeowner SiteBooks. Each item shows: post title/body, which
// homeowner posted it, which project, when. Click through to reply.

import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadMerchantInbox } from "@/lib/homeowners/posts";
import type { SiteBookProject } from "@/lib/homeowners/types";
import { MessageCircle, Sparkles, Lock, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

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

export default async function MerchantSiteBookInboxPage() {
  const listing = await getListing();
  if (!listing) redirect("/trade-off/login?next=/dashboard/sitebook-posts");

  const inbox = await loadMerchantInbox(listing.id, 80);

  // Group by homeowner+project for the sidebar-style overview
  const projectIds = Array.from(new Set(inbox.map((i) => i.post.project_id)));
  const projectsRes = projectIds.length > 0
    ? await supabaseAdmin
        .from("hammerex_sitebook_projects")
        .select("*")
        .in("id", projectIds)
    : { data: [] as SiteBookProject[] };
  const projectMap = new Map<string, SiteBookProject>();
  for (const p of (projectsRes.data as SiteBookProject[]) ?? []) projectMap.set(p.id, p);

  const homeownerIds = Array.from(new Set(Array.from(projectMap.values()).map((p) => p.homeowner_id)));
  const ownersRes = homeownerIds.length > 0
    ? await supabaseAdmin
        .from("hammerex_homeowners")
        .select("id, first_name, house_nickname")
        .in("id", homeownerIds)
    : { data: [] as Array<{ id: string; first_name: string | null; house_nickname: string }> };
  const ownerMap = new Map<string, { firstName: string | null; nickname: string }>();
  for (const o of (ownersRes.data as Array<{ id: string; first_name: string | null; house_nickname: string }>) ?? []) {
    ownerMap.set(o.id, { firstName: o.first_name, nickname: o.house_nickname });
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>SiteBook inbox</p>
        <h1 className="mt-1 text-2xl font-black text-neutral-900 sm:text-3xl">Posts you&rsquo;re invited to</h1>
        <p className="mt-1 text-[13px] text-neutral-600">
          Every SiteBook post where you&rsquo;re a member — newest first. Reply here and it lands in the homeowner&rsquo;s feed.
        </p>

        {inbox.length === 0 ? (
          <div className="mt-8 rounded-2xl border-2 border-dashed bg-white p-8 text-center" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <p className="text-[14px] font-black text-neutral-900">No SiteBook posts yet.</p>
            <p className="mx-auto mt-2 max-w-md text-[12.5px] text-neutral-600">
              When a homeowner posts to a project you&rsquo;re on and invites you, it appears here.
              Meanwhile: <Link href="/dashboard/sitebook-invites" className="underline">see SiteBook invites</Link> to accept new projects.
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {inbox.map(({ post, member }) => {
              const project = projectMap.get(post.project_id);
              const owner   = project ? ownerMap.get(project.homeowner_id) : null;
              return (
                <li key={post.id}>
                  <Link
                    href={`/dashboard/sitebook-posts/${post.id}`}
                    className="block rounded-2xl border-2 bg-white p-5 shadow-sm transition hover:border-neutral-400 hover:shadow-md"
                    style={{ borderColor: "rgba(0,0,0,0.08)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-1.5">
                          <p className="text-[13px] font-black text-neutral-900">
                            {owner ? `${owner.firstName || "Homeowner"} · ${owner.nickname}` : post.author_display_name}
                          </p>
                          <span className="inline-flex items-center rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-neutral-600">
                            {project?.title || "Project"}
                          </span>
                          {post.visibility === "all-trades" ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-blue-800">
                              <Eye size={9}/> broadcast
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-amber-800">
                              <Lock size={9}/> selected
                            </span>
                          )}
                        </div>
                        {post.title && <p className="mt-2 text-[14px] font-black text-neutral-900">{post.title}</p>}
                        <p className={`text-[12.5px] leading-relaxed text-neutral-700 line-clamp-2 ${post.title ? "mt-1" : "mt-2"}`}>
                          {post.body}
                        </p>
                      </div>
                      <p className="whitespace-nowrap text-[10.5px] font-bold text-neutral-500">
                        {new Date(post.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2 text-[10.5px]">
                      <span className="flex items-center gap-1 text-neutral-500">
                        <MessageCircle size={11}/> {post.reply_count} {post.reply_count === 1 ? "reply" : "replies"}
                        {!member.last_read_at && (
                          <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-green-800">
                            <span className="inline-block h-1 w-1 rounded-full bg-green-500"/>
                            New
                          </span>
                        )}
                      </span>
                      <span className="font-black uppercase tracking-wider" style={{ color: BRAND_GREEN }}>
                        Open →
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
