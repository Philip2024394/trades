// /admin/payments — real-time view of every Xrated Trades listing,
// its tier, payment plan, expiry, add-ons, and Stripe linkage.
//
// Server component. Reads everything via supabaseAdmin (service role)
// so RLS doesn't get in the way of cross-tenant admin reporting.
//
// URL contract:
//   ?tier=all|free|trial|paid|verified|expired
//   ?sort=newest|expiring|tier|trade
//   ?q=<slug | display_name | trading_name substring>
//   ?page=<1-based>
//
// Per-row write actions (force expire, extend 30 days) post to
// /api/admin/listings/<id>/(expire|extend) which redirect back here.
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { HammerexTradeOffListing } from "@/lib/supabase";
import { XRATED_PRICING } from "@/lib/xratedTrades";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = Promise<{
  tier?: string;
  sort?: string;
  q?: string;
  page?: string;
}>;

// Subset of the full listing type — only the columns this page reads.
// Keeps the query payload small and the type-narrowing honest.
type Row = Pick<
  HammerexTradeOffListing,
  | "id"
  | "slug"
  | "display_name"
  | "trading_name"
  | "city"
  | "primary_trade"
  | "tier"
  | "last_payment_plan"
  | "paid_expires_at"
  | "trial_expires_at"
  | "addons_enabled"
  | "stripe_customer_id"
  | "stripe_subscription_id"
  | "joined_at"
  | "created_at"
  | "status"
>;

type TierFilter = "all" | "free" | "trial" | "paid" | "verified" | "expired";
type SortKey = "newest" | "expiring" | "tier" | "trade";

function parseTier(v: string | undefined): TierFilter {
  switch (v) {
    case "free":
    case "trial":
    case "paid":
    case "verified":
    case "expired":
      return v;
    default:
      return "all";
  }
}

function parseSort(v: string | undefined): SortKey {
  switch (v) {
    case "expiring":
    case "tier":
    case "trade":
      return v;
    default:
      return "newest";
  }
}

function parsePage(v: string | undefined): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function tierBadgeClass(tier: Row["tier"]): string {
  // Brand-accent yellow for paid/verified, neutral grey for standard,
  // red for expired, soft amber for trial. The colours are absolute
  // (not brand tokens) so they read identically on any theme variant.
  switch (tier) {
    case "app_paid":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "app_verified":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "app_trial":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "app_expired":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    case "standard":
    default:
      return "bg-neutral-500/15 text-neutral-300 border-neutral-500/30";
  }
}

function tierLabel(tier: Row["tier"]): string {
  switch (tier) {
    case "app_paid":
      return "Paid";
    case "app_verified":
      return "Verified";
    case "app_trial":
      return "Trial";
    case "app_expired":
      return "Expired";
    case "standard":
    default:
      return "Free";
  }
}

function fmtRelativeExpiry(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffMs = t - Date.now();
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (days > 1) return `in ${days} days`;
  if (days === 1) return "in 1 day";
  if (days === 0) return "today";
  if (days === -1) return "expired 1 day ago";
  return `expired ${Math.abs(days)} days ago`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function planLabel(
  tier: Row["tier"],
  plan: Row["last_payment_plan"]
): string {
  if (!plan) return "—";
  // tier=app_verified + plan=monthly ⇒ "verified_monthly" semantic label
  const prefix =
    tier === "app_verified"
      ? "verified"
      : tier === "app_paid"
        ? "paid"
        : tier === "app_expired"
          ? "lapsed"
          : "paid";
  return `${prefix}_${plan}`;
}

/** Monthly £ contribution for a single subscriber. Annual plans are
 *  amortised down to a monthly figure for a cleaner MRR estimate. */
function monthlyValueFor(row: Row): number {
  if (row.tier !== "app_paid" && row.tier !== "app_verified") return 0;
  if (!row.last_payment_plan) return 0;
  const verified = row.tier === "app_verified";
  if (row.last_payment_plan === "monthly") {
    return verified
      ? XRATED_PRICING.verifiedMonthlyGbp
      : XRATED_PRICING.monthlyGbp;
  }
  // annual
  return verified
    ? XRATED_PRICING.verifiedAnnualGbp / 12
    : XRATED_PRICING.annualGbp / 12;
}

function countEnabledAddons(
  map: Record<string, boolean> | null | undefined
): { count: number; labels: string[] } {
  if (!map) return { count: 0, labels: [] };
  const labels = Object.entries(map)
    .filter(([, v]) => v === true)
    .map(([k]) => k);
  return { count: labels.length, labels };
}

async function loadSummary(): Promise<{
  total: number;
  paid: number;
  trial: number;
  free: number;
  expired: number;
  newPaidThisMonth: number;
  mrrGbp: number;
  payingSubscribers: number;
}> {
  // Pull only the columns we need for the headline stats, capped at
  // 5,000 rows. Beyond that we'd swap to per-bucket COUNT queries.
  const { data, error } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "tier, last_payment_plan, paid_expires_at, created_at, joined_at, status"
    )
    .limit(5000);
  if (error) {
    console.error("[admin/payments] summary fetch failed:", error);
    return {
      total: 0,
      paid: 0,
      trial: 0,
      free: 0,
      expired: 0,
      newPaidThisMonth: 0,
      mrrGbp: 0,
      payingSubscribers: 0
    };
  }

  const rows = data ?? [];
  const live = rows.filter((r) => r.status === "live");

  let paid = 0;
  let trial = 0;
  let free = 0;
  let expired = 0;
  let newPaidThisMonth = 0;
  let mrr = 0;
  let payers = 0;

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const monthStartMs = startOfMonth.getTime();

  for (const r of live) {
    switch (r.tier) {
      case "app_paid":
      case "app_verified": {
        paid += 1;
        if (r.last_payment_plan) {
          const verified = r.tier === "app_verified";
          const monthly =
            r.last_payment_plan === "monthly"
              ? verified
                ? XRATED_PRICING.verifiedMonthlyGbp
                : XRATED_PRICING.monthlyGbp
              : verified
                ? XRATED_PRICING.verifiedAnnualGbp / 12
                : XRATED_PRICING.annualGbp / 12;
          mrr += monthly;
          payers += 1;
        }
        if (r.paid_expires_at && r.created_at) {
          const created = new Date(r.created_at).getTime();
          if (created >= monthStartMs) newPaidThisMonth += 1;
        }
        break;
      }
      case "app_trial":
        trial += 1;
        break;
      case "app_expired":
        expired += 1;
        break;
      case "standard":
      default:
        free += 1;
        break;
    }
  }

  return {
    total: live.length,
    paid,
    trial,
    free,
    expired,
    newPaidThisMonth,
    mrrGbp: mrr,
    payingSubscribers: payers
  };
}

async function loadRows(opts: {
  tier: TierFilter;
  sort: SortKey;
  q: string;
  page: number;
}): Promise<{ rows: Row[]; total: number }> {
  const { tier, sort, q, page } = opts;

  let query = supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, slug, display_name, trading_name, city, primary_trade, tier, last_payment_plan, paid_expires_at, trial_expires_at, addons_enabled, stripe_customer_id, stripe_subscription_id, joined_at, created_at, status",
      { count: "exact" }
    );

  // Tier filter — Paid bucket includes both app_paid + app_verified per
  // the brief; Verified is a separate explicit option.
  if (tier === "free") query = query.eq("tier", "standard");
  else if (tier === "trial") query = query.eq("tier", "app_trial");
  else if (tier === "paid") query = query.in("tier", ["app_paid", "app_verified"]);
  else if (tier === "verified") query = query.eq("tier", "app_verified");
  else if (tier === "expired") query = query.eq("tier", "app_expired");

  if (q) {
    // ilike OR across slug, display_name, trading_name.
    const safe = q.replace(/[%_]/g, "\\$&");
    query = query.or(
      `slug.ilike.%${safe}%,display_name.ilike.%${safe}%,trading_name.ilike.%${safe}%`
    );
  }

  // Sort — Postgres NULLS LAST is the default for ASC and NULLS FIRST for
  // DESC, so we set nullsFirst explicitly to keep ordering deterministic.
  if (sort === "newest") {
    query = query.order("created_at", { ascending: false });
  } else if (sort === "expiring") {
    query = query.order("paid_expires_at", {
      ascending: true,
      nullsFirst: false
    });
  } else if (sort === "tier") {
    query = query.order("tier", { ascending: true });
  } else if (sort === "trade") {
    query = query.order("primary_trade", { ascending: true });
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) {
    console.error("[admin/payments] rows fetch failed:", error);
    return { rows: [], total: 0 };
  }
  return { rows: (data ?? []) as Row[], total: count ?? 0 };
}

function buildQuery(
  base: { tier: TierFilter; sort: SortKey; q: string; page: number },
  patch: Partial<{ tier: TierFilter; sort: SortKey; q: string; page: number }>
): string {
  const merged = { ...base, ...patch };
  const sp = new URLSearchParams();
  if (merged.tier !== "all") sp.set("tier", merged.tier);
  if (merged.sort !== "newest") sp.set("sort", merged.sort);
  if (merged.q) sp.set("q", merged.q);
  if (merged.page !== 1) sp.set("page", String(merged.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export default async function AdminPaymentsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const tier = parseTier(sp.tier);
  const sort = parseSort(sp.sort);
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const page = parsePage(sp.page);

  const [summary, { rows, total }] = await Promise.all([
    loadSummary(),
    loadRows({ tier, sort, q, page })
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const params = { tier, sort, q, page };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Payments &amp; Tiers</h1>
          <p className="text-xs text-brand-muted">
            Real-time view of paid, trial, and expired listings. MRR estimate
            includes annual plans amortised to a monthly figure.
          </p>
        </div>
      </div>

      <section
        aria-label="Summary"
        className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"
      >
        <SummaryCard label="Live listings" value={summary.total.toLocaleString()} />
        <SummaryCard
          label="Active paid"
          value={summary.paid.toLocaleString()}
          tone="success"
        />
        <SummaryCard
          label="On trial"
          value={summary.trial.toLocaleString()}
          tone="warn"
        />
        <SummaryCard label="Free" value={summary.free.toLocaleString()} />
        <SummaryCard
          label="Expired"
          value={summary.expired.toLocaleString()}
          tone="danger"
        />
        <SummaryCard
          label="New paid (mtd)"
          value={summary.newPaidThisMonth.toLocaleString()}
        />
        <SummaryCard
          label="MRR estimate"
          value={`£${summary.mrrGbp.toFixed(2)}`}
          sub={`${summary.payingSubscribers} subscriber${
            summary.payingSubscribers === 1 ? "" : "s"
          }`}
          tone="accent"
        />
      </section>

      <form
        method="GET"
        action="/admin/payments"
        className="mt-6 flex flex-wrap items-end gap-2 rounded border border-brand-line bg-brand-surface p-3"
      >
        <label className="flex flex-col text-xs text-brand-muted">
          Tier
          <select
            name="tier"
            defaultValue={tier}
            className="mt-1 rounded border border-brand-line bg-brand-bg px-2 py-1.5 text-xs text-brand-text"
          >
            <option value="all">All</option>
            <option value="free">Free (standard)</option>
            <option value="trial">Trial</option>
            <option value="paid">Paid (incl. verified)</option>
            <option value="verified">Verified only</option>
            <option value="expired">Expired</option>
          </select>
        </label>
        <label className="flex flex-col text-xs text-brand-muted">
          Sort
          <select
            name="sort"
            defaultValue={sort}
            className="mt-1 rounded border border-brand-line bg-brand-bg px-2 py-1.5 text-xs text-brand-text"
          >
            <option value="newest">Newest</option>
            <option value="expiring">Expiring soon</option>
            <option value="tier">Tier</option>
            <option value="trade">Trade</option>
          </select>
        </label>
        <label className="flex flex-1 flex-col text-xs text-brand-muted">
          Search
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="slug, display name or trading name"
            className="mt-1 min-w-[12rem] rounded border border-brand-line bg-brand-bg px-2 py-1.5 text-xs text-brand-text"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-brand-accent px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90"
        >
          Apply
        </button>
        {(tier !== "all" || sort !== "newest" || q) && (
          <Link
            href="/admin/payments"
            className="rounded border border-brand-line px-3 py-1.5 text-xs text-brand-muted hover:bg-brand-line hover:text-brand-text"
          >
            Reset
          </Link>
        )}
      </form>

      <div className="mt-4 overflow-x-auto rounded border border-brand-line">
        <table className="min-w-full text-xs">
          <thead className="bg-brand-surface text-left text-brand-muted">
            <tr>
              <Th>Slug</Th>
              <Th>Name</Th>
              <Th>City / Trade</Th>
              <Th>Tier</Th>
              <Th>Plan</Th>
              <Th>Expires</Th>
              <Th>Add-ons</Th>
              <Th>Stripe</Th>
              <Th>Joined</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-6 text-center text-xs text-brand-muted"
                >
                  No listings match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const addons = countEnabledAddons(row.addons_enabled);
                const expiryIso =
                  row.tier === "app_trial"
                    ? row.trial_expires_at
                    : row.paid_expires_at;
                return (
                  <tr
                    key={row.id}
                    className="border-t border-brand-line hover:bg-brand-line/40"
                  >
                    <td className="px-3 py-2 align-top">
                      <Link
                        href={`/${row.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-accent hover:underline"
                      >
                        {row.slug}
                      </Link>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-brand-text">
                        {row.display_name}
                      </div>
                      {row.trading_name && (
                        <div className="text-[11px] text-brand-muted">
                          {row.trading_name}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div>{row.city}</div>
                      <div className="text-[11px] text-brand-muted">
                        {row.primary_trade}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span
                        className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${tierBadgeClass(
                          row.tier
                        )}`}
                      >
                        {tierLabel(row.tier)}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top text-brand-muted">
                      {planLabel(row.tier, row.last_payment_plan)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div>{fmtRelativeExpiry(expiryIso)}</div>
                      <div className="text-[11px] text-brand-muted">
                        {fmtDate(expiryIso)}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      {addons.count === 0 ? (
                        <span className="text-brand-muted">0</span>
                      ) : (
                        <span
                          title={addons.labels.join(", ")}
                          className="cursor-help text-brand-text"
                        >
                          {addons.count}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-col gap-0.5">
                        {row.stripe_customer_id ? (
                          <a
                            href={`https://dashboard.stripe.com/customers/${encodeURIComponent(
                              row.stripe_customer_id
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-brand-accent hover:underline"
                          >
                            cust ↗
                          </a>
                        ) : (
                          <span className="text-[11px] text-brand-muted">
                            cust —
                          </span>
                        )}
                        {row.stripe_subscription_id ? (
                          <a
                            href={`https://dashboard.stripe.com/subscriptions/${encodeURIComponent(
                              row.stripe_subscription_id
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-brand-accent hover:underline"
                          >
                            sub ↗
                          </a>
                        ) : (
                          <span className="text-[11px] text-brand-muted">
                            sub —
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-brand-muted">
                      {fmtDate(row.joined_at ?? row.created_at)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <RowActions id={row.id} tier={row.tier} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <nav
        aria-label="Pagination"
        className="mt-3 flex items-center justify-between text-xs text-brand-muted"
      >
        <div>
          {total === 0
            ? "0 results"
            : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(
                page * PAGE_SIZE,
                total
              )} of ${total.toLocaleString()}`}
        </div>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`/admin/payments${buildQuery(params, { page: page - 1 })}`}
              className="rounded border border-brand-line px-2 py-1 text-brand-text hover:bg-brand-line"
            >
              ← Prev
            </Link>
          )}
          <span>
            Page {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/payments${buildQuery(params, { page: page + 1 })}`}
              className="rounded border border-brand-line px-2 py-1 text-brand-text hover:bg-brand-line"
            >
              Next →
            </Link>
          )}
        </div>
      </nav>
    </div>
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

function SummaryCard({
  label,
  value,
  sub,
  tone
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "success" | "warn" | "danger" | "accent";
}) {
  const accent =
    tone === "success"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-amber-300"
        : tone === "danger"
          ? "text-red-300"
          : tone === "accent"
            ? "text-brand-accent"
            : "text-brand-text";
  return (
    <div className="rounded border border-brand-line bg-brand-surface px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-brand-muted">
        {label}
      </div>
      <div className={`mt-0.5 text-base font-semibold ${accent}`}>{value}</div>
      {sub && <div className="text-[11px] text-brand-muted">{sub}</div>}
    </div>
  );
}

function RowActions({
  id,
  tier
}: {
  id: string;
  tier: Row["tier"];
}) {
  return (
    <div className="flex flex-col gap-1">
      {tier !== "app_expired" && (
        <form
          action={`/api/admin/listings/${encodeURIComponent(id)}/expire`}
          method="POST"
        >
          <button
            type="submit"
            className="w-full rounded border border-red-500/40 px-2 py-0.5 text-[11px] text-red-300 hover:bg-red-500/10"
          >
            Force expire
          </button>
        </form>
      )}
      <form
        action={`/api/admin/listings/${encodeURIComponent(id)}/extend`}
        method="POST"
      >
        <button
          type="submit"
          className="w-full rounded border border-brand-line px-2 py-0.5 text-[11px] text-brand-text hover:bg-brand-line"
        >
          +30 days
        </button>
      </form>
    </div>
  );
}
