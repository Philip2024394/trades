// src/app/nex-native/manage/analytics/page.tsx
//
// Merchant analytics · pilot scope.
// --------------------------------
// Server Component · aggregates real order + ledger data via
// analytics-service.getMerchantOverview. Every metric is derived from
// persisted rows · nothing invented · null-safe zero when data is absent.
//
// Doctrine references:
//   · Identity Doctrine · scoped to the caller's owned business
//   · Anti-fabrication · no "trending up" claims · no synthetic metrics
//   · Every currency shown in its own row · never silently converted

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import * as analyticsService from "@/lib/nex-native/analytics-service";
import type { DailyRevenue, MonthlyRevenue } from "@/lib/nex-native/analytics-service";
import type { NexOrderState } from "@/lib/nex-native/types";
import { signOutAction } from "../../_actions";
import { NexNativeShell } from "../../_shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_LABEL: Record<NexOrderState, string> = {
  created: "created",
  pending: "pending",
  paid: "paid",
  completed: "completed",
  cancelled: "cancelled",
  refunded: "refunded",
};

function formatPence(pence: number, currency: string): string {
  return `${currency} ${(pence / 100).toFixed(2)}`;
}

export default async function Page() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const owned = await businessService.listBusinessesByOwner(session.account.id);
  if (owned.length === 0) redirect("/nex-native/onboarding");
  const business = owned[0];

  const overview = await analyticsService.getMerchantOverview(business.id);
  const productNames = new Map<string, string>();
  for (const t of overview.top_products) {
    const p = await productService.getProductById(t.product_id);
    if (p) productNames.set(t.product_id, p.name);
  }

  const currencies = new Set<string>([
    ...Object.keys(overview.gross_revenue_by_currency),
    ...Object.keys(overview.net_revenue_by_currency),
    ...Object.keys(overview.refunded_amount_by_currency),
  ]);

  // Time-series · one dense array per currency the merchant has actually
  // billed in · both 30-day and 90-day windows. Skip if the merchant has
  // never billed anything (avoid rendering an empty chart in a dead currency).
  const timeseries = await Promise.all(
    Array.from(currencies).sort().map(async (c) => ({
      currency: c,
      last30:  await analyticsService.getDailyRevenue(business.id, 30, c),
      last90:  await analyticsService.getDailyRevenue(business.id, 90, c),
      net30:   await analyticsService.getDailyNetRevenue(business.id, 30, c),
      mom6:    await analyticsService.getMonthOverMonthRevenue(business.id, 6, c),
    }))
  );

  return (
    <NexNativeShell>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-neutral-300 pb-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">
              Analytics · {business.display_name}
            </h1>
            <p className="text-xs text-neutral-500">
              <Link href="/nex-native/manage" className="underline">← back to manage</Link>
              {" · "}
              <Link href="/nex-native/manage/orders" className="underline">orders</Link>
              {" · "}
              <a
                href="/nex-native/manage/analytics/export.csv"
                className="underline"
                download
              >
                download CSV
              </a>
              {" · "}
              as of {new Date(overview.as_of).toLocaleString()}
            </p>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="text-xs text-neutral-500 underline">
              sign out
            </button>
          </form>
        </header>

        {overview.total_orders === 0 ? (
          <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-3 text-xs text-neutral-600">
            No orders yet · analytics appear once customers start placing orders.
          </p>
        ) : (
          <>
            <section className="mb-4 grid gap-3 sm:grid-cols-3">
              <StatCard label="Total orders" value={overview.total_orders.toString()} />
              <StatCard label="Last 7 days"  value={overview.orders_last_7d.toString()}  />
              <StatCard label="Last 30 days" value={overview.orders_last_30d.toString()} />
            </section>

            <section className="mb-4">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Orders by state
              </h2>
              <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                {(Object.keys(overview.orders_by_state) as NexOrderState[]).map((s) => (
                  <li
                    key={s}
                    className="flex items-baseline justify-between rounded border border-neutral-200 bg-white px-3 py-2"
                  >
                    <span className="text-xs text-neutral-500">{STATE_LABEL[s]}</span>
                    <span className="font-medium text-neutral-900">{overview.orders_by_state[s]}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mb-4">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Revenue
              </h2>
              {currencies.size === 0 ? (
                <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                  No paid orders yet.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {Array.from(currencies).sort().map((c) => (
                    <li key={c} className="rounded border border-neutral-200 bg-white px-3 py-2 text-sm">
                      <div className="mb-1 text-xs uppercase text-neutral-500">{c}</div>
                      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
                        <dt className="text-neutral-500">Gross</dt>
                        <dd className="text-neutral-900">
                          {formatPence(overview.gross_revenue_by_currency[c] ?? 0, c)}
                        </dd>
                        <dt className="text-neutral-500">Refunded</dt>
                        <dd className="text-neutral-900">
                          {formatPence(overview.refunded_amount_by_currency[c] ?? 0, c)}
                        </dd>
                        <dt className="text-neutral-500">Net</dt>
                        <dd className="font-medium text-neutral-900">
                          {formatPence(overview.net_revenue_by_currency[c] ?? 0, c)}
                        </dd>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-neutral-500">
                Net revenue is computed from the double-entry ledger and is
                automatically reversal-safe. Gross counts every order that
                was ever paid (including those later refunded).
              </p>
            </section>

            {timeseries.length > 0 && (
              <section className="mb-4">
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Daily revenue
                </h2>
                <div className="grid gap-4">
                  {timeseries.map(({ currency: c, last30, last90, net30, mom6 }) => (
                    <div key={c} className="grid gap-2">
                      <div>
                        <div className="mb-1 text-xs text-neutral-500">
                          {c} · last 30 days (gross · includes refunded)
                        </div>
                        <DailyRevenueChart currency={c} data={last30} />
                      </div>
                      <div>
                        <div className="mb-1 text-xs text-neutral-500">
                          {c} · last 30 days (net · paid + completed only)
                        </div>
                        <NetRevenueChart currency={c} data={net30} />
                      </div>
                      <div>
                        <div className="mb-1 text-xs text-neutral-500">
                          {c} · last 90 days
                        </div>
                        <DailyRevenueChart currency={c} data={last90} />
                      </div>
                      <div>
                        <div className="mb-1 text-xs text-neutral-500">
                          {c} · last 6 months (month-over-month)
                        </div>
                        <MonthlyRevenueChart currency={c} data={mom6} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  Each bar is one UTC day (daily charts) or one UTC calendar
                  month (MoM chart) · height proportional to gross revenue
                  billed in that bucket. Empty buckets are shown as a flat
                  baseline · never fabricated.
                </p>
              </section>
            )}

            <section className="mb-4">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Top products (by gross revenue)
              </h2>
              {overview.top_products.length === 0 ? (
                <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                  No paid orders yet — top products appear once you have your first sale.
                </p>
              ) : (
                <ol className="grid gap-2">
                  {overview.top_products.map((t, idx) => (
                    <li
                      key={t.product_id}
                      className="flex items-start justify-between gap-3 rounded border border-neutral-200 bg-white px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-neutral-900">
                          {idx + 1}. {productNames.get(t.product_id) ?? "(product removed)"}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {t.order_count} order{t.order_count === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div className="text-right text-sm text-neutral-900">
                        {formatPence(t.gross_revenue_pence, t.currency)}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </main>
    </NexNativeShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-200 bg-white px-3 py-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function DailyRevenueChart({ currency, data }: { currency: string; data: DailyRevenue[] }) {
  const max = data.reduce((m, d) => Math.max(m, d.gross_revenue_pence), 0);
  const total = data.reduce((s, d) => s + d.gross_revenue_pence, 0);
  const orders = data.reduce((s, d) => s + d.order_count, 0);
  const width = 320;
  const height = 96;
  const padTop = 4;
  const padBottom = 12;
  const barGap = 2;
  const barW = (width - barGap * (data.length - 1)) / data.length;
  const drawableH = height - padTop - padBottom;

  return (
    <div className="rounded border border-neutral-200 bg-white p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2 text-xs">
        <span className="uppercase text-neutral-500">{currency}</span>
        <span className="text-neutral-700">
          {orders} order{orders === 1 ? "" : "s"} · {currency}{" "}
          {(total / 100).toFixed(2)} gross
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Daily gross revenue in ${currency} · last ${data.length} days`}
        className="block w-full"
      >
        {/* baseline */}
        <line
          x1={0}
          x2={width}
          y1={height - padBottom + 0.5}
          y2={height - padBottom + 0.5}
          stroke="#e5e5e5"
          strokeWidth={1}
        />
        {data.map((d, i) => {
          const h = max === 0 ? 0 : (d.gross_revenue_pence / max) * drawableH;
          const x = i * (barW + barGap);
          const y = height - padBottom - h;
          return (
            <g key={d.day}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, d.gross_revenue_pence > 0 ? 1 : 0)}
                fill={d.gross_revenue_pence > 0 ? "#171717" : "transparent"}
              />
              <title>
                {d.day} · {d.order_count} order
                {d.order_count === 1 ? "" : "s"} · {currency}{" "}
                {(d.gross_revenue_pence / 100).toFixed(2)}
              </title>
            </g>
          );
        })}
        {/* first + last date labels */}
        <text
          x={0}
          y={height - 2}
          fontSize={8}
          fill="#737373"
          textAnchor="start"
        >
          {data[0]?.day.slice(5)}
        </text>
        <text
          x={width}
          y={height - 2}
          fontSize={8}
          fill="#737373"
          textAnchor="end"
        >
          {data[data.length - 1]?.day.slice(5)}
        </text>
      </svg>
    </div>
  );
}

// Slice 5f · NET revenue chart · same shape as DailyRevenueChart with green bars.
function NetRevenueChart({ currency, data }: { currency: string; data: DailyRevenue[] }) {
  const max = data.reduce((m, d) => Math.max(m, d.gross_revenue_pence), 0);
  const total = data.reduce((s, d) => s + d.gross_revenue_pence, 0);
  const orders = data.reduce((s, d) => s + d.order_count, 0);
  const width = 320;
  const height = 96;
  const padTop = 4;
  const padBottom = 12;
  const barGap = 2;
  const barW = (width - barGap * (data.length - 1)) / data.length;
  const drawableH = height - padTop - padBottom;
  return (
    <div className="rounded border border-neutral-200 bg-white p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2 text-xs">
        <span className="uppercase text-neutral-500">{currency} · net</span>
        <span className="text-neutral-700">
          {orders} order{orders === 1 ? "" : "s"} · {currency}{" "}
          {(total / 100).toFixed(2)} net
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" className="block w-full"
        aria-label={`Daily NET revenue in ${currency} · last ${data.length} days`}>
        <line x1={0} x2={width} y1={height - padBottom + 0.5} y2={height - padBottom + 0.5}
          stroke="#e5e5e5" strokeWidth={1} />
        {data.map((d, i) => {
          const h = max === 0 ? 0 : (d.gross_revenue_pence / max) * drawableH;
          const x = i * (barW + barGap);
          const y = height - padBottom - h;
          return (
            <g key={d.day}>
              <rect x={x} y={y} width={barW}
                height={Math.max(h, d.gross_revenue_pence > 0 ? 1 : 0)}
                fill={d.gross_revenue_pence > 0 ? "#059669" : "transparent"} />
              <title>
                {d.day} · {d.order_count} order{d.order_count === 1 ? "" : "s"} · {currency}{" "}
                {(d.gross_revenue_pence / 100).toFixed(2)} net
              </title>
            </g>
          );
        })}
        <text x={0} y={height - 2} fontSize={8} fill="#737373" textAnchor="start">
          {data[0]?.day.slice(5)}
        </text>
        <text x={width} y={height - 2} fontSize={8} fill="#737373" textAnchor="end">
          {data[data.length - 1]?.day.slice(5)}
        </text>
      </svg>
    </div>
  );
}

// Slice 5d · Month-over-month bar chart · same visual language as daily.
function MonthlyRevenueChart({ currency, data }: { currency: string; data: MonthlyRevenue[] }) {
  const max = data.reduce((m, d) => Math.max(m, d.gross_revenue_pence), 0);
  const total = data.reduce((s, d) => s + d.gross_revenue_pence, 0);
  const orders = data.reduce((s, d) => s + d.order_count, 0);
  const width = 320;
  const height = 96;
  const padTop = 4;
  const padBottom = 14;
  const barGap = 4;
  const barW = (width - barGap * (data.length - 1)) / data.length;
  const drawableH = height - padTop - padBottom;

  return (
    <div className="rounded border border-neutral-200 bg-white p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2 text-xs">
        <span className="uppercase text-neutral-500">{currency}</span>
        <span className="text-neutral-700">
          {orders} order{orders === 1 ? "" : "s"} · {currency}{" "}
          {(total / 100).toFixed(2)} gross · last {data.length} months
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Monthly gross revenue in ${currency} · last ${data.length} months`}
        className="block w-full"
      >
        <line
          x1={0}
          x2={width}
          y1={height - padBottom + 0.5}
          y2={height - padBottom + 0.5}
          stroke="#e5e5e5"
          strokeWidth={1}
        />
        {data.map((d, i) => {
          const h = max === 0 ? 0 : (d.gross_revenue_pence / max) * drawableH;
          const x = i * (barW + barGap);
          const y = height - padBottom - h;
          return (
            <g key={d.month}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, d.gross_revenue_pence > 0 ? 1 : 0)}
                fill={d.gross_revenue_pence > 0 ? "#0f766e" : "transparent"}
              />
              <text
                x={x + barW / 2}
                y={height - 2}
                fontSize={8}
                fill="#737373"
                textAnchor="middle"
              >
                {d.month.slice(5)}
              </text>
              <title>
                {d.month} · {d.order_count} order
                {d.order_count === 1 ? "" : "s"} · {currency}{" "}
                {(d.gross_revenue_pence / 100).toFixed(2)}
              </title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
