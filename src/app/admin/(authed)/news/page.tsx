// /admin/news — Newsroom overview + tabbed table.
//
// Server component. Reads posts via supabaseAdmin and renders a tabbed
// table {Live | Draft | Archived}. Per-row actions wire to
// /api/admin/news/<id> for archive / restore / delete; Edit links to
// /admin/news/<id>/edit.

import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findCategory } from "@/lib/newsCategories";
import { NewsRowActions } from "./NewsRowActions";

export const dynamic = "force-dynamic";

type Tab = "live" | "draft" | "archived";
type SearchParams = Promise<{ tab?: string }>;

type NewsRow = {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: string;
  published_at: string | null;
  updated_at: string;
  yard_post_id: string | null;
};

function parseTab(v: string | undefined): Tab {
  return v === "draft" || v === "archived" ? v : "live";
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

async function loadPosts(tab: Tab): Promise<NewsRow[]> {
  const { data, error } = await supabaseAdmin
    .from("hammerex_xrated_news_posts")
    .select(
      "id, slug, title, category, status, published_at, updated_at, yard_post_id"
    )
    .eq("status", tab)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[admin/news] load failed:", error);
    return [];
  }
  return (data ?? []) as NewsRow[];
}

async function loadCounts(): Promise<Record<Tab, number>> {
  const tabs: Tab[] = ["live", "draft", "archived"];
  const out: Record<Tab, number> = { live: 0, draft: 0, archived: 0 };
  await Promise.all(
    tabs.map(async (t) => {
      const { count } = await supabaseAdmin
        .from("hammerex_xrated_news_posts")
        .select("id", { count: "exact", head: true })
        .eq("status", t);
      out[t] = count ?? 0;
    })
  );
  return out;
}

export default async function AdminNewsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin/login");
  }
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const [posts, counts] = await Promise.all([loadPosts(tab), loadCounts()]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Newsroom</h1>
          <p className="text-xs text-brand-muted">
            Public posts at /news. Going Live cross-posts to The Yard
            as an admin announcement (members can react + comment).
            Archiving hides the Yard echo.
          </p>
        </div>
        <Link
          href="/admin/news/new"
          className="rounded bg-brand-accent px-3 py-1.5 text-[11px] font-semibold text-black hover:opacity-90"
        >
          + New post
        </Link>
      </div>

      <nav className="mt-4 flex flex-wrap items-center gap-1 border-b border-brand-line">
        <TabLink tab="live" currentTab={tab} label="Live" count={counts.live} />
        <TabLink
          tab="draft"
          currentTab={tab}
          label="Draft"
          count={counts.draft}
        />
        <TabLink
          tab="archived"
          currentTab={tab}
          label="Archived"
          count={counts.archived}
        />
      </nav>

      <div className="mt-4 overflow-x-auto rounded border border-brand-line">
        <table className="min-w-full text-xs">
          <thead className="bg-brand-surface text-left text-brand-muted">
            <tr>
              <Th>Title</Th>
              <Th>Category</Th>
              <Th>Status</Th>
              <Th>Published</Th>
              <Th>Yard echo</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-xs text-brand-muted"
                >
                  No posts in this tab yet.
                </td>
              </tr>
            ) : (
              posts.map((post) => {
                const cat = findCategory(post.category);
                const badge =
                  post.status === "live"
                    ? { label: "LIVE", bg: "#15803D", fg: "#FFFFFF" }
                    : post.status === "draft"
                      ? { label: "DRAFT", bg: "#525252", fg: "#FFFFFF" }
                      : { label: "ARCHIVED", bg: "#7F1D1D", fg: "#FFFFFF" };
                return (
                  <tr
                    key={post.id}
                    className="border-t border-brand-line align-top hover:bg-brand-line/40"
                  >
                    <td className="px-3 py-2">
                      {post.status === "live" ? (
                        <Link
                          href={`/news/${post.slug}`}
                          target="_blank"
                          className="font-medium text-brand-accent hover:underline"
                        >
                          {post.title}
                        </Link>
                      ) : (
                        <span className="font-medium text-brand-text">
                          {post.title}
                        </span>
                      )}
                      <div className="text-[11px] text-brand-muted">
                        /news/{post.slug}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-brand-text">
                      {cat.label}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                        style={{ background: badge.bg, color: badge.fg }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-brand-muted">
                      {formatRelative(post.published_at)}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-brand-muted">
                      {post.yard_post_id ? "✓ posted" : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <NewsRowActions
                        postId={post.id}
                        status={post.status}
                        slug={post.slug}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabLink({
  tab,
  currentTab,
  label,
  count
}: {
  tab: Tab;
  currentTab: Tab;
  label: string;
  count: number;
}) {
  const active = tab === currentTab;
  return (
    <Link
      href={`/admin/news?tab=${tab}`}
      className={
        active
          ? "inline-flex items-center gap-1.5 border-b-2 border-brand-accent px-3 py-2 text-xs font-semibold text-brand-text"
          : "inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-xs text-brand-muted hover:text-brand-text"
      }
    >
      {label}
      {count > 0 && (
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
