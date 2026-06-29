// /admin/reviews — moderation queue for customer reviews.
//
// Server component. Reads rows via supabaseAdmin (service role) and
// renders a tabbed table:
//
//   Pending publish — status='live' AND goes_live_at > now()  (24h window)
//   Live            — status='live' AND goes_live_at <= now()
//   Hidden          — status='hidden'
//   Flagged         — status='flagged'
//
// Per-row actions (Edit / Mark Safe / Hide / Delete / Restore) live in
// the ReviewRowActions client island. Search filters customer_name /
// body / listing slug (server-side via ilike OR). Pagination 50/page.
//
// URL contract:
//   ?tab=pending|live|hidden|flagged   (default 'pending')
//   ?q=<customer_name | body | slug substring>
//   ?page=<1-based>
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ReviewRowActions } from "./ReviewRowActions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type Tab = "pending" | "live" | "hidden" | "flagged";

type SearchParams = Promise<{
  tab?: string;
  q?: string;
  page?: string;
}>;

type ReviewRow = {
  id: string;
  listing_id: string;
  customer_name: string;
  body: string;
  overall_rating: number;
  service_name: string | null;
  status: string;
  goes_live_at: string;
  submitted_at: string | null;
  admin_marked_safe_at: string | null;
  admin_edited_at: string | null;
};

type ListingLite = {
  id: string;
  slug: string;
  display_name: string | null;
};

function parseTab(v: string | undefined): Tab {
  if (v === "live" || v === "hidden" || v === "flagged") return v;
  return "pending";
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

function relativeFuture(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffMs = t - Date.now();
  if (diffMs <= 0) return "now";
  const min = Math.floor(diffMs / 60_000);
  if (min < 60) return `in ${min} min`;
  const hr = Math.floor(min / 60);
  return `in ${hr} hr`;
}

function statusBadge(status: string): { label: string; bg: string; fg: string } {
  switch (status) {
    case "hidden":
      return { label: "HIDDEN", bg: "#7F1D1D", fg: "#FFFFFF" };
    case "flagged":
      return { label: "FLAGGED", bg: "#C2410C", fg: "#FFFFFF" };
    case "spam":
      return { label: "SPAM", bg: "#7F1D1D", fg: "#FFFFFF" };
    case "pending":
      return { label: "PENDING", bg: "#1E40AF", fg: "#FFFFFF" };
    case "disputed":
      return { label: "DISPUTED", bg: "#92400E", fg: "#FFFFFF" };
    case "live":
    default:
      return { label: "LIVE", bg: "#15803D", fg: "#FFFFFF" };
  }
}

function excerpt(body: string, len = 80): string {
  if (!body) return "";
  if (body.length <= len) return body;
  return body.slice(0, len).replace(/\s+\S*$/, "") + "…";
}

async function loadReviews(opts: {
  tab: Tab;
  q: string;
  page: number;
}): Promise<{
  reviews: ReviewRow[];
  listings: Record<string, ListingLite>;
  count: number;
}> {
  const nowIso = new Date().toISOString();
  const from = (opts.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Optional slug-search: resolve slug → listing_ids first so we can
  // OR them into the main query. Cheap because we only fetch ids.
  let listingFilterIds: string[] | null = null;
  if (opts.q) {
    const lookup = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id")
      .ilike("slug", `%${opts.q}%`)
      .limit(100);
    listingFilterIds = (lookup.data ?? []).map((r) => r.id);
  }

  let query = supabaseAdmin
    .from("hammerex_xrated_reviews")
    .select(
      "id, listing_id, customer_name, body, overall_rating, service_name, status, goes_live_at, submitted_at, admin_marked_safe_at, admin_edited_at",
      { count: "exact" }
    )
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (opts.tab === "pending") {
    query = query.eq("status", "live").gt("goes_live_at", nowIso);
  } else if (opts.tab === "live") {
    query = query.eq("status", "live").lte("goes_live_at", nowIso);
  } else {
    query = query.eq("status", opts.tab);
  }

  if (opts.q) {
    // OR across customer_name / body / matched listing_ids. PostgREST
    // `.or()` accepts comma-separated conditions; quote the substring
    // to be safe with special chars (the ilike pattern itself is
    // PostgREST-escaped via the % wildcards).
    const safe = opts.q.replace(/[(),]/g, " ").trim();
    const ors = [
      `customer_name.ilike.%${safe}%`,
      `body.ilike.%${safe}%`
    ];
    if (listingFilterIds && listingFilterIds.length > 0) {
      ors.push(`listing_id.in.(${listingFilterIds.join(",")})`);
    }
    query = query.or(ors.join(","));
  }

  const res = await query;
  const reviews = (res.data ?? []) as ReviewRow[];
  const count = res.count ?? 0;

  // Hydrate listings for slug + display name columns.
  const ids = Array.from(new Set(reviews.map((r) => r.listing_id)));
  const listings: Record<string, ListingLite> = {};
  if (ids.length > 0) {
    const lres = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, display_name")
      .in("id", ids);
    for (const l of lres.data ?? []) {
      listings[l.id] = {
        id: l.id,
        slug: l.slug,
        display_name: l.display_name
      };
    }
  }

  return { reviews, listings, count };
}

async function loadTabCounts(): Promise<Record<Tab, number>> {
  const nowIso = new Date().toISOString();
  const [pending, live, hidden, flagged] = await Promise.all([
    supabaseAdmin
      .from("hammerex_xrated_reviews")
      .select("id", { count: "exact", head: true })
      .eq("status", "live")
      .gt("goes_live_at", nowIso),
    supabaseAdmin
      .from("hammerex_xrated_reviews")
      .select("id", { count: "exact", head: true })
      .eq("status", "live")
      .lte("goes_live_at", nowIso),
    supabaseAdmin
      .from("hammerex_xrated_reviews")
      .select("id", { count: "exact", head: true })
      .eq("status", "hidden"),
    supabaseAdmin
      .from("hammerex_xrated_reviews")
      .select("id", { count: "exact", head: true })
      .eq("status", "flagged")
  ]);
  return {
    pending: pending.count ?? 0,
    live: live.count ?? 0,
    hidden: hidden.count ?? 0,
    flagged: flagged.count ?? 0
  };
}

export default async function AdminReviewsPage({
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

  const [{ reviews, listings, count }, tabCounts] = await Promise.all([
    loadReviews({ tab, q, page }),
    loadTabCounts()
  ]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">
            Reviews — moderation
            {tabCounts.pending > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-brand-accent px-2 py-0.5 text-[11px] font-bold text-black">
                {tabCounts.pending} pending publish
              </span>
            )}
          </h1>
          <p className="text-xs text-brand-muted">
            Submissions land with a 24h cool-down. Mark Safe publishes
            immediately. Hide pulls the review from public profiles. Edit
            tweaks the body / name / rating + stamps an audit timestamp.
            Delete is the nuclear option (illegal / unrecoverable content).
          </p>
        </div>
      </div>

      {/* Tabs */}
      <nav className="mt-4 flex flex-wrap items-center gap-1 border-b border-brand-line">
        <TabLink tab="pending" currentTab={tab} q={q} label="Pending publish" count={tabCounts.pending} />
        <TabLink tab="live" currentTab={tab} q={q} label="Live" count={tabCounts.live} />
        <TabLink tab="hidden" currentTab={tab} q={q} label="Hidden" count={tabCounts.hidden} />
        <TabLink tab="flagged" currentTab={tab} q={q} label="Flagged" count={tabCounts.flagged} />
      </nav>

      {/* Search */}
      <form
        action="/admin/reviews"
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
            placeholder="customer name, body, or listing slug…"
            className="w-72 rounded border border-brand-line bg-brand-surface px-2 py-1 text-xs text-brand-text placeholder:text-brand-muted/70"
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
            href={`/admin/reviews?tab=${tab}`}
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
              <Th>Listing</Th>
              <Th>Customer</Th>
              <Th>Body excerpt</Th>
              <Th>★</Th>
              <Th>Service</Th>
              <Th>Submitted</Th>
              <Th>Goes live</Th>
              <Th>Audit</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {reviews.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-8 text-center text-xs text-brand-muted"
                >
                  No reviews in this view.
                </td>
              </tr>
            ) : (
              reviews.map((r) => {
                const badge = statusBadge(r.status);
                const listing = listings[r.listing_id];
                return (
                  <tr
                    key={r.id}
                    className="border-t border-brand-line align-top hover:bg-brand-line/40"
                  >
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                        style={{ background: badge.bg, color: badge.fg }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {listing ? (
                        <Link
                          href={`/${listing.slug}`}
                          target="_blank"
                          className="font-medium text-brand-accent hover:underline"
                        >
                          {listing.slug}
                        </Link>
                      ) : (
                        <span className="text-brand-muted">unknown</span>
                      )}
                      {listing?.display_name && (
                        <div className="text-[11px] text-brand-muted">
                          {listing.display_name}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-brand-text">
                      {r.customer_name}
                    </td>
                    <td className="px-3 py-2 max-w-[28ch]">
                      <span className="block text-brand-text">{excerpt(r.body)}</span>
                    </td>
                    <td className="px-3 py-2 text-brand-text">
                      {r.overall_rating}★
                    </td>
                    <td className="px-3 py-2 text-[11px] text-brand-muted">
                      {r.service_name || "—"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-brand-muted">
                      {relativeAgo(r.submitted_at)}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-brand-muted">
                      {tab === "pending"
                        ? relativeFuture(r.goes_live_at)
                        : relativeAgo(r.goes_live_at)}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-brand-muted">
                      {r.admin_marked_safe_at && (
                        <div>safe {relativeAgo(r.admin_marked_safe_at)}</div>
                      )}
                      {r.admin_edited_at && (
                        <div>edited {relativeAgo(r.admin_edited_at)}</div>
                      )}
                      {!r.admin_marked_safe_at && !r.admin_edited_at && "—"}
                    </td>
                    <td className="px-3 py-2">
                      <ReviewRowActions
                        review={{
                          id: r.id,
                          customer_name: r.customer_name,
                          body: r.body,
                          overall_rating: r.overall_rating,
                          service_name: r.service_name,
                          status: r.status as
                            | "live"
                            | "hidden"
                            | "flagged"
                            | "pending"
                            | "disputed"
                            | "withdrawn"
                            | "spam"
                        }}
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
            Page {page} of {totalPages} &middot; {count} matching review
            {count === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/reviews?tab=${tab}${q ? `&q=${encodeURIComponent(q)}` : ""}&page=${page - 1}`}
                className="rounded border border-brand-line px-3 py-1 text-brand-text hover:bg-brand-line"
              >
                Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/reviews?tab=${tab}${q ? `&q=${encodeURIComponent(q)}` : ""}&page=${page + 1}`}
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
  const href = `/admin/reviews?tab=${tab}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
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
