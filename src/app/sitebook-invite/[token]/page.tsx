// /sitebook-invite/[token] — trade-facing landing page.
//
// The trade taps the WhatsApp link that the homeowner sent. They land
// here, see:
//   • Who invited them (first name only + approximate city — never
//     exact address, never contact details)
//   • The projects they've been invited to
//   • Recent posts they can see (only posts where they're an explicit
//     member OR the visibility is "all-trades" for those projects)
//   • An inline reply composer per post — NO SIGNUP REQUIRED
//
// Reply endpoint uses the token itself as authentication.

import { notFound } from "next/navigation";
import Link from "next/link";
import { HardHat, MapPin, Info } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadInvitationByToken } from "@/lib/homeowners/invitations";
import { TradeInviteView } from "@/components/homeowners/TradeInviteView";

export const dynamic = "force-dynamic";

export default async function TradeInvitePage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await loadInvitationByToken(token);
  if (!invitation) notFound();

  // Owner — first name + approx city ONLY (no address, no whatsapp)
  const ownerRes = await supabaseAdmin
    .from("hammerex_homeowners")
    .select("id, first_name, city")
    .eq("id", invitation.homeowner_id)
    .maybeSingle();
  const owner = ownerRes.data as { id: string; first_name: string; city: string | null } | null;

  // Projects — title + short description only (no address)
  const projectsRes = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id, title, description, address_city, cover_photo_url, created_at")
    .in("id", invitation.project_ids)
    .order("created_at", { ascending: false });
  const projects = (projectsRes.data as {
    id: string; title: string; description: string | null;
    address_city: string | null; cover_photo_url: string | null; created_at: string;
  }[]) ?? [];

  // Posts — only those the trade is allowed to see (all-trades on
  // these projects OR explicitly added as a post member).
  const [visMembership, publicPosts] = await Promise.all([
    supabaseAdmin
      .from("hammerex_sitebook_post_members")
      .select("post_id")
      .eq("listing_id", invitation.trade_listing_id),
    supabaseAdmin
      .from("hammerex_sitebook_posts")
      .select("id, project_id, title, body, cover_photo_url, created_at, visibility")
      .in("project_id", invitation.project_ids)
      .eq("visibility", "all-trades")
      .order("created_at", { ascending: false })
      .limit(20)
  ]);
  const memberPostIds = new Set(
    ((visMembership.data as { post_id: string }[]) ?? []).map((m) => m.post_id)
  );
  const memberPostsRes = memberPostIds.size > 0
    ? await supabaseAdmin
        .from("hammerex_sitebook_posts")
        .select("id, project_id, title, body, cover_photo_url, created_at, visibility")
        .in("id", Array.from(memberPostIds))
    : { data: [] };
  type PostRow = {
    id: string; project_id: string; title: string | null; body: string;
    cover_photo_url: string | null; created_at: string; visibility: string;
  };
  const allPosts = [
    ...((publicPosts.data as PostRow[]) ?? []),
    ...((memberPostsRes.data as PostRow[]) ?? [])
  ];
  // De-dupe by id, sort newest first
  const seen = new Set<string>();
  const posts = allPosts
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));

  const projectTitleById = new Map(projects.map((p) => [p.id, p.title]));

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      {/* Bare header — no marketing chrome. This isn't a signup page. */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-neutral-900 shadow-sm" style={{ backgroundColor: "#FFB300" }}>
            <HardHat size={14} strokeWidth={2.5}/>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-black text-neutral-900 leading-tight">
              You&rsquo;re invited to {owner?.first_name ?? "a homeowner"}&rsquo;s SiteBook
            </p>
            <p className="mt-0.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
              {invitation.trade_merchant_name || invitation.trade_merchant_slug || "Trade"}
              {owner?.city && <> · <MapPin size={9} className="inline -mt-0.5"/> {owner.city}</>}
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-5">
        {/* Owner intro band */}
        <div
          className="rounded-2xl border-2 bg-white p-4 shadow-sm"
          style={{ borderColor: "#EDE4CE" }}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            {invitation.status === "unavailable" ? "SLA elapsed" : invitation.status === "revoked" ? "Invitation revoked" : "Active invitation"}
          </p>
          <h1 className="mt-2 text-[20px] font-black leading-tight text-neutral-900">
            {projects.length === 1
              ? `Reply to ${owner?.first_name ?? "the owner"} about ${projects[0].title}`
              : `${projects.length} projects · reply inline below`}
          </h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-neutral-700">
            {invitation.message_body || "No message left."}
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-[11px] leading-snug text-neutral-700">
            <Info size={13} className="mt-0.5 shrink-0 text-neutral-500"/>
            <p>
              <span className="font-black">No signup needed.</span> Reply inline below and the owner sees it instantly in their SiteBook. Only the owner has your details &mdash; you have theirs only through what they choose to share.
            </p>
          </div>
        </div>

        {/* Posts */}
        <TradeInviteView
          token={token}
          posts={posts}
          projectTitleById={Array.from(projectTitleById.entries())}
          tradeName={invitation.trade_merchant_name || invitation.trade_merchant_slug || "Trade"}
          canReply={invitation.status !== "revoked"}
        />

        <p className="mt-6 text-center text-[10.5px] text-neutral-500">
          Powered by <Link href="/" className="font-black text-neutral-800 underline">The Networkers</Link> · Trade-safe invites &middot; No commission &middot; No lead fees
        </p>
      </section>
    </main>
  );
}
