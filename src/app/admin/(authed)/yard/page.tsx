// /admin/yard — moderation queue + admin overview for The Yard.
//
// Server component. Reads posts via supabaseAdmin (service role) and
// renders a tabbed table of {Flagged & Hidden | All posts | Announcements}.
// Each row carries the moderation actions (Hide / Spam / Restore + Pin /
// Unpin) wired to /api/admin/yard/moderate via a small client island.
//
// URL contract:
//   ?tab=queue|all|announcements   (default 'queue')
//   ?q=<slug | display_name | body substring>
//   ?page=<1-based>
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_DISPLAY_NAME, ADMIN_LISTING_ID } from "@/lib/yardAdmin";
import { YardModerationRowActions } from "./YardModerationRowActions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type Tab = "queue" | "all" | "announcements";

type SearchParams = Promise<{
  tab?: string;
  q?: string;
  page?: string;
}>;

type PostRow = {
  id: string;
  listing_id: string;
  kind: "available" | "needed" | "chat" | "product";
  title: string;
  body: string;
  is_admin_announcement: boolean;
  is_pinned: boolean;
  moderation_status: "live" | "hidden" | "spam" | "flagged";
  moderation_reason: string | null;
  moderated_at: string | null;
  flag_count: number;
  created_at: string;
};

type PosterLite = {
  slug: string;
  display_name: string | null;
  trading_name: string | null;
};

function parseTab(v: string | undefined): Tab {
  return v === "all" || v === "announcements" ? v : "queue";
}

function parsePage(v: string | undefined): number {
  const n = Number(v ?? "1");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

function relativeAgo(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffMs = Date.now() - t;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function statusBadge(post: PostRow): { label: string; bg: string; fg: string } {
  if (post.is_admin_announcement) {
    return { label: "ANNOUNCEMENT", bg: "#FFB300", fg: "#0A0A0A" };
  }
  switch (post.moderation_status) {
    case "hidden":
      return { label: "HIDDEN", bg: "#7F1D1D", fg: "#FFFFFF" };
    case "spam":
      return { label: "SPAM", bg: "#7F1D1D", fg: "#FFFFFF" };
    case "flagged":
      return { label: "FLAGGED", bg: "#C2410C", fg: "#FFFFFF" };
    case "live":
    default:
      return { label: "LIVE", bg: "#15803D", fg: "#FFFFFF" };
  }
}

function excerpt(body: string, len = 160): string {
  if (!body) return "";
  if (body.length <= len) return body;
  return body.slice(0, len).replace(/\s+\S*$/, "") + "…";
}

async function loadPosts(opts: { tab: Tab; q: string; page: number }) {
  const from = (opts.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let q = supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select(
      "id, listing_id, kind, title, body, is_admin_announcement, is_pinned, moderation_status, moderation_reason, moderated_at, flag_count, created_at",
      { count: "exact" }
    )
    .is("parent_id", null)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (opts.tab === "queue") {
    // Flagged or hidden — anything that needs an admin look.
    q = q.in("moderation_status", ["flagged", "hidden", "spam"]);
  } else if (opts.tab === "announcements") {
    q = q.eq("is_admin_announcement", true);
  }

  // Free-text search across title + body. Slug / display_name search is
  // applied client-side after we hydrate the poster map (cheap because
  // page size is 50).
  if (opts.q) {
    q = q.or(`title.ilike.%${opts.q}%,body.ilike.%${opts.q}%`);
  }

  const res = await q;
  const posts = (res.data ?? []) as PostRow[];
  const count = res.count ?? 0;

  // Hydrate poster identity for real (non-admin) posts. Admin posts use
  // ADMIN_LISTING_ID which has no matching listings row — we render the
  // ADMIN_DISPLAY_NAME for those.
  const realListingIds = Array.from(
    new Set(
      posts
        .map((p) => p.listing_id)
        .filter((id) => id && id !== ADMIN_LISTING_ID)
    )
  );
  const posters: Record<string, PosterLite> = {};
  if (realListingIds.length > 0) {
    const lres = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, display_name, trading_name")
      .in("id", realListingIds);
    for (const l of lres.data ?? []) {
      posters[l.id] = {
        slug: l.slug,
        display_name: l.display_name,
        trading_name: l.trading_name
      };
    }
  }

  // Optional client-side narrowing on slug / display_name — runs after
  // poster hydrate so the search box covers names too. Doesn't change
  // the underlying `count` (admins generally use `q` to spot a known
  // user; the result drop is the signal).
  let filtered = posts;
  if (opts.q) {
    const needle = opts.q.toLowerCase();
    filtered = posts.filter((p) => {
      const poster = posters[p.listing_id];
      const hay = [
        p.title,
        p.body,
        poster?.slug,
        poster?.display_name,
        poster?.trading_name
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }

  return { posts: filtered, posters, count };
}

async function loadPendingCount(): Promise<number> {
  const { count } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("id", { count: "exact", head: true })
    .in("moderation_status", ["flagged", "hidden", "spam"]);
  return count ?? 0;
}

export default async function AdminYardPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin/login");
  }

  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = parsePage(sp.page);

  const [{ posts, posters, count }, pendingCount] = await Promise.all([
    loadPosts({ tab, q, page }),
    loadPendingCount()
  ]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">
            The Yard — moderation
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-brand-accent px-2 py-0.5 text-[11px] font-bold text-black">
                {pendingCount} pending
              </span>
            )}
          </h1>
          <p className="text-xs text-brand-muted">
            Flagged + hidden posts surface here. Hide removes from the public
            feed; Spam is the same plus signals intent; Restore clears flags
            and puts the post back live. Pinned admin posts float to the top
            of the feed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/yard/new-announcement"
            className="rounded bg-brand-accent px-3 py-1.5 text-[11px] font-semibold text-black hover:opacity-90"
          >
            New announcement
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <nav className="mt-4 flex flex-wrap items-center gap-1 border-b border-brand-line">
        <TabLink
          tab="queue"
          currentTab={tab}
          q={q}
          label="Flagged & Hidden"
          count={pendingCount}
        />
        <TabLink tab="all" currentTab={tab} q={q} label="All posts" />
        <TabLink
          tab="announcements"
          currentTab={tab}
          q={q}
          label="Announcements"
        />
      </nav>

      {/* Search */}
      <form
        action="/admin/yard"
        method="GET"
        className="mt-4 flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="tab" value={tab} />
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-brand-muted">
            Search
          </span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="slug, name, or body…"
            className="w-64 rounded border border-brand-line bg-brand-surface px-2 py-1 text-xs text-brand-text placeholder:text-brand-muted/70"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-brand-accent px-3 py-1.5 text-[11px] font-semibold text-black hover:opacity-90"
        >
          Apply
        </button>
        {q && (
          <Link
            href={`/admin/yard?tab=${tab}`}
            className="rounded border border-brand-line px-3 py-1.5 text-[11px] text-brand-muted hover:bg-brand-line hover:text-brand-text"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded border border-brand-line">
        <table className="min-w-full text-xs">
          <thead className="bg-brand-surface text-left text-brand-muted">
            <tr>
              <Th>Status</Th>
              <Th>Poster</Th>
              <Th>Title / Body</Th>
              <Th>Kind</Th>
              <Th>Flags</Th>
              <Th>Created</Th>
              <Th>Moderated</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-8 text-center text-xs text-brand-muted"
                >
                  No posts in this view.
                </td>
              </tr>
            ) : (
              posts.map((post) => {
                const badge = statusBadge(post);
                const poster = posters[post.listing_id];
                const isAdminPost =
                  post.is_admin_announcement ||
                  post.listing_id === ADMIN_LISTING_ID;
                return (
                  <tr
                    key={post.id}
                    className="border-t border-brand-line align-top hover:bg-brand-line/40"
                  >
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <span
                          className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                          style={{ background: badge.bg, color: badge.fg }}
                        >
                          {badge.label}
                        </span>
                        {post.is_pinned && (
                          <span className="inline-flex w-fit items-center rounded border border-brand-accent px-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-accent">
                            Pinned
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {isAdminPost ? (
                        <div className="font-medium text-brand-text">
                          {ADMIN_DISPLAY_NAME}
                        </div>
                      ) : poster ? (
                        <div>
                          <Link
                            href={`/${poster.slug}`}
                            target="_blank"
                            className="font-medium text-brand-accent hover:underline"
                          >
                            {poster.slug}
                          </Link>
                          <div className="text-[11px] text-brand-muted">
                            {poster.display_name || "—"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-brand-muted">unknown</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-brand-text">
                        {post.title}
                      </div>
                      <div className="text-[11px] text-brand-muted">
                        {excerpt(post.body)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-brand-muted">
                      {post.kind}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-brand-text">
                      {post.flag_count}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-brand-muted">
                      {relativeAgo(post.created_at)}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-brand-muted">
                      {relativeAgo(post.moderated_at)}
                    </td>
                    <td className="px-3 py-2">
                      <YardModerationRowActions
                        postId={post.id}
                        status={post.moderation_status}
                        isPinned={post.is_pinned}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-brand-muted">
          <span>
            Page {page} of {totalPages} &middot; {count} matching post
            {count === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/yard?tab=${tab}${q ? `&q=${encodeURIComponent(q)}` : ""}&page=${page - 1}`}
                className="rounded border border-brand-line px-3 py-1 text-brand-text hover:bg-brand-line"
              >
                Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/yard?tab=${tab}${q ? `&q=${encodeURIComponent(q)}` : ""}&page=${page + 1}`}
                className="rounded border border-brand-line px-3 py-1 text-brand-text hover:bg-brand-line"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabLink({
  tab,
  currentTab,
  q,
  label,
  count
}: {
  tab: Tab;
  currentTab: Tab;
  q: string;
  label: string;
  count?: number;
}) {
  const active = tab === currentTab;
  const href = `/admin/yard?tab=${tab}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  return (
    <Link
      href={href}
      className={
        active
          ? "inline-flex items-center gap-1.5 border-b-2 border-brand-accent px-3 py-2 text-xs font-semibold text-brand-text"
          : "inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-xs text-brand-muted hover:text-brand-text"
      }
    >
      {label}
      {typeof count === "number" && count > 0 && (
        <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand-accent px-1.5 text-[10px] font-bold text-black">
          {count}
        </span>
      )}
    </Link>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="whitespace-nowrap px-3 py-2 text-[11px] font-medium uppercase tracking-wide"
    >
      {children}
    </th>
  );
}
