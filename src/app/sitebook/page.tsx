// /sitebook — homeowner's SiteBook hub, center-feed layout (real DB).
//
// Mirrors the /sitebook-showcase design but backed by the real DB
// (hammerex_sitebook_posts + members + replies + projects). Reuses
// the shared PostComposer and PostFeedCard components.
//
// Feed loads the homeowner's most recent posts across all their
// projects. Optional ?project= URL param scopes to a single project.

import Link from "next/link";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { getGuestSession } from "@/lib/homeowners/guestSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadHomeownerFeed, loadPostWithReplies } from "@/lib/homeowners/posts";
import type { SiteBookProject, SiteBookMember } from "@/lib/homeowners/types";
import { UnifiedPostComposerWithFanout } from "@/components/homeowners/UnifiedPostComposerWithFanout";
import { PostFeedCard } from "@/components/homeowners/PostFeedCard";
import { LiveProjectsFeed } from "@/components/homeowners/LiveProjectsFeed";
import { RevealUsageCard } from "@/components/homeowners/RevealUsageCard";
import { SiteBookInboxPanel, type SiteBookInboxRow } from "@/components/homeowners/SiteBookInboxPanel";
import { SiteBookGalleryCard } from "@/components/homeowners/SiteBookGalleryCard";
import { FullGalleryView } from "@/components/homeowners/FullGalleryView";
import { AppStoreView } from "@/components/homeowners/AppStoreView";
import { FeedSectionHeader } from "@/components/homeowners/FeedSectionHeader";
import { allApps } from "@/apps/sitebook/registry";
import { ProjectCostCard } from "@/components/homeowners/ProjectCostCard";
import { CostLedgerView } from "@/components/homeowners/CostLedgerView";
import { loadInvitationsForHomeowner } from "@/lib/homeowners/invitations";
import { loadProjectCostSummary, loadCostsForProject } from "@/lib/homeowners/costs";
import { loadDocumentsForProject } from "@/lib/homeowners/costDocuments";
import { loadHomeownerPhotos } from "@/lib/homeowners/photos";
import { SavedMediaRail } from "@/components/media/SavedMediaRail";
import { loadInstalledAppSlugs } from "@/lib/homeowners/apps";
import { loadUpcomingHomeCare } from "@/lib/homeowners/homeCare";
import { HomeCareCard } from "@/components/homeowners/HomeCareCard";
import { SiteBookOnboardingModal } from "@/components/homeowners/SiteBookOnboardingModal";
import { SiteBookMobileNavShell } from "@/components/homeowners/SiteBookMobileNavShell";
import { HowItWorksSlot } from "@/components/homeowners/howItWorks/HowItWorksSlot";
import { HowItWorksOpenButton } from "@/components/homeowners/howItWorks/HowItWorksOpenButton";
import { getQuota } from "@/lib/homeowners/revealCredits";
import { GuestNewProjectButton } from "./GuestNewProjectButton";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";

async function loadProjects(homeownerId: string): Promise<SiteBookProject[]> {
  const res = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("*")
    .eq("homeowner_id", homeownerId)
    .order("created_at", { ascending: false });
  return (res.data as SiteBookProject[]) ?? [];
}

async function loadProjectTrades(projectIds: string[]): Promise<SiteBookMember[]> {
  if (projectIds.length === 0) return [];
  const res = await supabaseAdmin
    .from("hammerex_sitebook_members")
    .select("*")
    .in("project_id", projectIds)
    .in("status", ["accepted", "hired", "in-progress", "quoting"]);
  return (res.data as SiteBookMember[]) ?? [];
}

// Populate the yard-style inbox on the left rail. Rows = the homeowner's
// active WA threads (one row per (post, trade) conversation). Preview
// falls back to the post title when there are no messages yet. Each
// row also carries the project title + city so the panel's "Search
// project" input can narrow the list to trades on a specific project.
async function loadInboxRows(homeownerId: string): Promise<SiteBookInboxRow[]> {
  const threads = await supabaseAdmin
    .from("hammerex_sitebook_wa_threads")
    .select("id, post_id, project_id, trade_merchant_name, trade_merchant_slug, last_activity_at, revoked_at, message_count")
    .eq("homeowner_id", homeownerId)
    .order("last_activity_at", { ascending: false })
    .limit(60);
  const rows = (threads.data as Array<{
    id:                   string;
    post_id:              string;
    project_id:           string;
    trade_merchant_name:  string | null;
    trade_merchant_slug:  string | null;
    last_activity_at:     string;
    revoked_at:           string | null;
    message_count:        number;
  }>) ?? [];
  if (rows.length === 0) return [];

  const postIds    = Array.from(new Set(rows.map((r) => r.post_id)));
  const projectIds = Array.from(new Set(rows.map((r) => r.project_id).filter(Boolean)));

  const [postsRes, projectsRes, latestReplies] = await Promise.all([
    supabaseAdmin
      .from("hammerex_sitebook_posts")
      .select("id, title, body")
      .in("id", postIds),
    projectIds.length > 0
      ? supabaseAdmin
          .from("hammerex_sitebook_projects")
          .select("id, title, address_city")
          .in("id", projectIds)
      : Promise.resolve({ data: [] as { id: string; title: string; address_city: string | null }[] }),
    supabaseAdmin
      .from("hammerex_sitebook_wa_messages")
      .select("thread_id, body, created_at")
      .in("thread_id", rows.map((r) => r.id))
      .order("created_at", { ascending: false })
  ]);

  const postMap = new Map<string, { title: string | null; body: string }>();
  for (const p of (postsRes.data as { id: string; title: string | null; body: string }[]) ?? []) postMap.set(p.id, p);

  const projectMap = new Map<string, { title: string; address_city: string | null }>();
  for (const p of (projectsRes.data as { id: string; title: string; address_city: string | null }[]) ?? []) projectMap.set(p.id, p);

  const latestByThread = new Map<string, string>();
  for (const m of (latestReplies.data as { thread_id: string; body: string }[]) ?? []) {
    if (!latestByThread.has(m.thread_id)) latestByThread.set(m.thread_id, m.body);
  }

  const threadRows = rows.map<SiteBookInboxRow>((r) => {
    const post    = postMap.get(r.post_id);
    const project = projectMap.get(r.project_id);
    const preview = latestByThread.get(r.id) || post?.title || post?.body?.slice(0, 80) || "New conversation";
    const title   = r.trade_merchant_name || r.trade_merchant_slug || "Trade";
    return {
      id:            r.id,
      kind:          "whatsapp",
      title,
      preview,
      createdAt:     r.last_activity_at,
      avatarInitial: title.charAt(0),
      projectTitle:  project?.title       ?? null,
      projectCity:   project?.address_city ?? null,
      status:        "conversation",
      isArchived:    !!r.revoked_at,
      linkHref:      `/sitebook?post=${r.post_id}`
    };
  });

  // Blend invitations (invited/declined/unavailable/accepted-but-no-thread)
  // into the same panel so the owner has ONE view of every trade
  // relationship. Members with an active WA thread appear via the
  // thread row instead — we de-dupe by trade_listing_id.
  const invitations = await loadInvitationsForHomeowner(homeownerId);
  const threadListingIds = new Set(rows.map((r) => r.trade_merchant_slug || "")); // rough — swap for listing_id if added
  const projectTitleMap = new Map<string, string>();
  for (const [id, meta] of projectMap.entries()) projectTitleMap.set(id, meta.title);
  const projectCityMap  = new Map<string, string | null>();
  for (const [id, meta] of projectMap.entries()) projectCityMap.set(id, (meta as { address_city?: string | null }).address_city ?? null);

  const inviteRows: SiteBookInboxRow[] = invitations
    .filter((inv) => !threadListingIds.has(inv.trade_merchant_slug || ""))
    .map((inv) => {
      const firstProjectId = inv.project_ids[0];
      const title = inv.trade_merchant_name || inv.trade_merchant_slug || "Trade";
      const status: SiteBookInboxRow["status"] =
        inv.status === "accepted"     ? "member"
      : inv.status === "declined"     ? "declined"
      : inv.status === "unavailable"  ? "unavailable"
      : inv.status === "revoked"      ? undefined
      : "invited";
      return {
        id:            inv.id,
        kind:          "system",
        title,
        preview:       inv.status === "unavailable"
          ? "No reply in 24 hours — likely unavailable"
          : inv.status === "declined"
          ? "Declined the invitation"
          : inv.status === "accepted"
          ? "Accepted — now a project member"
          : "Invited · awaiting reply",
        createdAt:     inv.sent_at || inv.created_at,
        avatarInitial: title.charAt(0),
        projectTitle:  firstProjectId ? projectTitleMap.get(firstProjectId) ?? null : null,
        projectCity:   firstProjectId ? projectCityMap.get(firstProjectId)  ?? null : null,
        status,
        isArchived:    inv.status === "revoked"
      };
    });

  // Combine + sort newest-first
  return [...threadRows, ...inviteRows].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export default async function SiteBookHubPage({
  searchParams
}: {
  searchParams: Promise<{ project?: string; guide?: string; view?: string }>;
}) {
  const homeowner = await getHomeownerFromCookie();
  const guest     = homeowner ? null : await getGuestSession();

  const nickname  = homeowner?.house_nickname || guest?.nickname || "your SiteBook";
  const firstName = homeowner?.first_name || null;

  // Guest fast-path — empty state with activation gate.
  // Same 2-column layout as the authed branch so the yard-style inbox
  // container is visible from the first landing (empty state renders
  // in the panel — activates for real once the guest signs up).
  if (!homeowner) {
    const sp0        = await searchParams;
    const guideMode0 = typeof sp0.guide === "string" && sp0.guide.length > 0;
    const guideFocus0 = guideMode0 && sp0.guide !== "1" ? sp0.guide! : null;
    return (
      <section className="mx-auto max-w-[1400px] px-3 py-6 md:px-6">
        <div className="mb-5">
          <LiveProjectsFeed/>
        </div>

        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-[5px]">
          {/* LEFT — inbox panel (empty state for guests) */}
          <aside className="order-2 hidden lg:order-1 lg:block">
            <SiteBookInboxPanel
              rows={[]}
              emptyLabel="Sign up to start conversations with trades. Every WhatsApp reveal lands here."
            />
          </aside>

          {/* RIGHT — guide-mode swap OR welcome + activation CTA */}
          <div className="order-1 lg:order-2">
            {guideMode0 ? (
              <HowItWorksSlot focusId={guideFocus0}/>
            ) : (
              <>
                <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
                  SiteBook · {nickname}
                </p>
                <h1 className="mt-1 text-2xl font-black text-neutral-900 sm:text-3xl">Welcome to {nickname}.</h1>
                <p className="mt-1 text-[13px] text-neutral-600">
                  Take a look around. When you&rsquo;re ready to post your first project, we&rsquo;ll activate your secure storage.
                </p>
                <div className="mt-4">
                  <HowItWorksOpenButton label="How SiteBook works"/>
                </div>
                <div className="mt-6">
                  <GuestNewProjectButton nickname={nickname}/>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    );
  }

  const sp             = await searchParams;
  const activeProject  = sp.project || null;
  const guideMode      = typeof sp.guide === "string" && sp.guide.length > 0;
  const guideFocus     = guideMode && sp.guide !== "1" ? sp.guide! : null;
  const costLedgerMode = sp.view === "costs" && !!activeProject;
  const galleryMode    = sp.view === "gallery";
  const appsMode       = sp.view === "apps";

  const projects       = await loadProjects(homeowner.id);
  const projectIds     = projects.map((p) => p.id);
  const projectMembers = await loadProjectTrades(projectIds);

  // De-duplicate trades across projects — same listing_id may appear
  // on multiple projects, we surface each trade once for the composer.
  const uniqueTrades = new Map<string, { listingId: string; name: string; tradeType: string | null }>();
  for (const m of projectMembers) {
    if (!uniqueTrades.has(m.listing_id)) {
      uniqueTrades.set(m.listing_id, {
        listingId: m.listing_id,
        name:      m.merchant_name,
        tradeType: m.trade_type
      });
    }
  }
  const composerTrades = Array.from(uniqueTrades.values());

  // Load feed + reveal quota + inbox + Photo library + installed apps
  // (drives which App Store tiles render) + (in ledger mode) the full
  // cost ledger — all in parallel. Cost summary is skipped when the
  // Project Cost app isn't installed.
  const [posts, quotaRes, inboxRows, galleryPhotos, installedApps, ledgerCosts, ledgerDocuments] = await Promise.all([
    loadHomeownerFeed(homeowner.id, { projectId: activeProject || undefined }),
    getQuota(homeowner.id),
    loadInboxRows(homeowner.id),
    loadHomeownerPhotos(homeowner.id, 60),
    loadInstalledAppSlugs(homeowner.id),
    costLedgerMode && activeProject ? loadCostsForProject(activeProject, homeowner.id) : Promise.resolve([]),
    costLedgerMode && activeProject ? loadDocumentsForProject(activeProject, homeowner.id) : Promise.resolve([])
  ]);
  const projectCostInstalled = installedApps.has("project-cost");
  const homeCareInstalled    = installedApps.has("home-care");
  const [costSummary, homeCareItems] = await Promise.all([
    projectCostInstalled ? loadProjectCostSummary(homeowner.id) : Promise.resolve([]),
    homeCareInstalled    ? loadUpcomingHomeCare(homeowner.id, 3) : Promise.resolve([])
  ]);
  const initialQuota = quotaRes.ok ? quotaRes.quota : null;
  const ledgerProjectTitle = costLedgerMode ? (costSummary.find((s) => s.project_id === activeProject)?.project_title ?? "Project") : "";

  // Load replies + members for each post
  const postDetails = await Promise.all(
    posts.map(async (p) => {
      const detail = await loadPostWithReplies(p.id);
      return { post: p, replies: detail?.replies ?? [], members: detail?.members ?? [] };
    })
  );

  const projectTitleById = new Map(projects.map((p) => [p.id, p.title]));

  const postCounts = new Map<string, number>();
  for (const p of posts) postCounts.set(p.project_id, (postCounts.get(p.project_id) ?? 0) + 1);

  return (
    <section className="mx-auto max-w-[1400px] px-3 py-6 md:px-6">
      {/* First-visit walkthrough modal — dismisses forever after the
          user clicks Got it or closes. Client-side, localStorage-gated. */}
      <SiteBookOnboardingModal/>

      {/* Platform-wide live projects marquee — every new project across
          the UK appears here (title + city + budget). Auto-scrolls up.
          Sits above the 2-column layout so it spans full width. */}
      <div className="mb-5">
        <LiveProjectsFeed/>
      </div>

      {/* 2-column layout on desktop:
            left  = yard-style inbox panel (SiteBookInboxPanel — same
                    chrome + tokens as the yard's ConversationList)
            right = the existing owner strip + tabs + composer + feed
          Mobile stacks the feed above the inbox for thumb-first scroll. */}
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-[5px]">

        {/* LEFT — inbox + Photo library
            (order-2 on mobile so the feed sits above) */}
        <aside className="order-2 hidden lg:order-1 lg:block space-y-4">
          <SiteBookInboxPanel rows={inboxRows}/>
          <SiteBookGalleryCard
            photos={galleryPhotos}
            projects={projects.map((p) => ({ id: p.id, title: p.title }))}
            seeAllHref="/sitebook?view=gallery"
          />
          {/* Saved media rail — Image | Video toggle. Auto-hidden
              when not authed. Videos link back to Networkers TV. */}
          <SavedMediaRail/>
          {/* Home Care app — default-installed retention hook. */}
          {homeCareInstalled && <HomeCareCard items={homeCareItems}/>}
        </aside>

        {/* RIGHT — original feed column (or the guide in guide mode) */}
        <div className="order-1 lg:order-2">

      {guideMode ? (
        <>
          <FeedSectionHeader hrefBase="/sitebook" activeView="guide"/>
          <HowItWorksSlot focusId={guideFocus}/>
        </>
      ) : costLedgerMode && activeProject ? (
        <CostLedgerView
          projectId={activeProject}
          projectTitle={ledgerProjectTitle}
          costs={ledgerCosts}
          documents={ledgerDocuments}
        />
      ) : galleryMode ? (
        <>
          <FeedSectionHeader hrefBase="/sitebook" activeView="gallery"/>
          <FullGalleryView
            photos={galleryPhotos}
            projects={projects.map((p) => ({ id: p.id, title: p.title }))}
          />
        </>
      ) : appsMode ? (
        <>
          <FeedSectionHeader hrefBase="/sitebook" activeView="apps"/>
          <AppStoreView
            apps={allApps()}
            installedSlugs={Array.from(installedApps)}
          />
        </>
      ) : (
      <>

      {/* Owner strip */}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
            SiteBook · {nickname}
          </p>
          <h1 className="mt-1 text-2xl font-black text-neutral-900 sm:text-3xl">
            {firstName ? `Hi ${firstName}.` : `Welcome to ${nickname}.`}
          </h1>
          <p className="mt-1 text-[13px] text-neutral-600">
            {projects.length === 0
              ? "No projects yet. Create one to start posting updates."
              : `${projects.length} project${projects.length === 1 ? "" : "s"} · ${posts.length} post${posts.length === 1 ? "" : "s"} in your feed.`}
          </p>
        </div>
        <Link
          href="/sitebook/new"
          className="inline-flex h-10 items-center gap-1 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
          style={{ backgroundColor: BRAND_YELLOW }}
        >
          + New project
        </Link>
      </div>

      {/* Project filter tabs */}
      {projects.length > 0 && (
        <div className="mt-4 -mx-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
          <div className="flex gap-1.5">
            <FilterTab href="/sitebook" active={!activeProject}>
              All <span className={`ml-1 rounded-full px-1.5 text-[9.5px] ${!activeProject ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"}`}>{posts.length}</span>
            </FilterTab>
            {projects.map((p) => (
              <FilterTab key={p.id} href={`/sitebook?project=${p.id}`} active={activeProject === p.id}>
                {p.title}
                <span className={`ml-1 rounded-full px-1.5 text-[9.5px] ${activeProject === p.id ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"}`}>
                  {postCounts.get(p.id) ?? 0}
                </span>
              </FilterTab>
            ))}
          </div>
        </div>
      )}

      {/* Project Cost — SiteBook App (installable from /sitebook/apps).
          Only rendered when the homeowner has installed the app.
          Everyone else sees a small "Add app" chip below. */}
      {projectCostInstalled && costSummary.length > 0 && (
        <div className="mt-5">
          <ProjectCostCard summaries={costSummary}/>
        </div>
      )}
      {!projectCostInstalled && (
        <div className="mt-5">
          <Link
            href="/sitebook/apps"
            className="flex items-center justify-between rounded-2xl border-2 border-dashed bg-white px-4 py-3 text-[12px] font-black uppercase tracking-wider text-neutral-700 shadow-sm hover:border-neutral-400"
            style={{ borderColor: "rgba(0,0,0,0.15)" }}
          >
            <span>+ Add apps to your SiteBook</span>
            <span className="text-[10.5px] font-bold normal-case text-neutral-500 tracking-normal">App Store</span>
          </Link>
        </div>
      )}

      {/* Reveal-credit usage card — shows WA reveal balance + top-up CTA */}
      {initialQuota && (
        <div className="mt-5">
          <RevealUsageCard initial={initialQuota}/>
        </div>
      )}

      {/* Section-header row — three feed-area links (Composer /
          App Store / How it works). Composer is active in the
          default view. */}
      <div className="mt-5">
        <FeedSectionHeader hrefBase="/sitebook" activeView="composer"/>
      </div>

      {/* Composer */}
      <div className="mt-2" data-composer="true">
        <UnifiedPostComposerWithFanout
          authorInitial={(firstName || "You").substring(0, 1)}
          projects={projects.map((p) => ({ id: p.id, title: p.title }))}
          trades={composerTrades}
        />
      </div>

      {/* Feed */}
      <div className="mt-4 space-y-4">
        {postDetails.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed bg-white p-8 text-center" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <p className="text-[14px] font-black text-neutral-900">Your feed is empty.</p>
            <p className="mx-auto mt-1 max-w-md text-[12.5px] text-neutral-600">
              {projects.length === 0
                ? "Create your first project, then post an update, question, or new-work request."
                : "Post an update above — your trades will see it in their inbox."}
            </p>
          </div>
        ) : (
          postDetails.map(({ post, replies, members }) => (
            <PostFeedCard
              key={post.id}
              post={post}
              replies={replies}
              members={members}
              projectName={projectTitleById.get(post.project_id) || "Project"}
              viewerType="homeowner"
              viewerInitial={(firstName || "You").substring(0, 1)}
              replyPostUrl={`/api/homeowner/posts/${post.id}/replies`}
            />
          ))
        )}
      </div>

      {/* Bottom: export prompt */}
      {posts.length > 0 && (
        <div className="mt-14 rounded-2xl border-2 bg-white p-5 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-500">Your house&rsquo;s memory</p>
          <p className="mt-2 text-[15px] font-black text-neutral-900">Export your complete SiteBook for £9.99</p>
          <p className="mt-1 text-[12.5px] text-neutral-600">
            Every post, photo, warranty and invoice in one PDF + ZIP. Transfers with the property when you sell.
          </p>
          <Link
            href="/sitebook/export"
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 text-[11px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50"
          >
            Export options →
          </Link>
        </div>
      )}

      </>
      )}

        </div>{/* end RIGHT column */}
      </div>{/* end 2-column grid */}

      {/* Mobile bottom nav — only < md. Rails on this page are
          hidden on mobile; their content is rendered as pull-up
          sheets from the nav. */}
      <SiteBookMobileNavShell
        tradesContent={<SiteBookInboxPanel rows={inboxRows}/>}
        photosContent={
          <SiteBookGalleryCard
            photos={galleryPhotos}
            projects={projects.map((p) => ({ id: p.id, title: p.title }))}
            seeAllHref="/sitebook?view=gallery"
          />
        }
      />
    </section>
  );
}

function FilterTab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition ${active ? "text-neutral-900" : "text-neutral-500 hover:bg-neutral-100"}`}
      style={active ? { backgroundColor: BRAND_YELLOW } : {}}
    >
      {children}
    </Link>
  );
}
