// xratedtrade.com — merchant order dashboard.
//
// Lists every order that hit the merchant's cart. Filterable by status
// (all / paid / pending / failed) and fulfilment (all / unfulfilled /
// fulfilled). Merchant can flip fulfilled_at from a row to mark
// completed. CSV export via the /api endpoint.
//
// Auth: edit_token — same magic-link pattern every other /edit page
// uses.

import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/trade-off/DashboardHeader";
import { DashboardFooter } from "@/components/trade-off/DashboardFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { OrdersIsland } from "@/components/trade-off/OrdersIsland";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Orders | xratedtrade.com",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[]; ref?: string | string[] }>;
type Params = Promise<{ slug: string }>;

type OrderRow = {
  id: string;
  order_ref: string;
  amount_pence: number;
  currency: string;
  provider: string;
  status: string;
  customer_email: string | null;
  customer_name: string | null;
  cart_items: unknown;
  created_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
  note: string | null;
};

export default async function OrdersEditPage({
  params,
  searchParams
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const rawToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  const focusRef = typeof sp.ref === "string" ? sp.ref : Array.isArray(sp.ref) ? sp.ref[0] : "";

  if (!slug || !token) return <InvalidLink reason="missing-token" />;

  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, edit_token, display_name")
    .eq("slug", slug)
    .maybeSingle();
  if (!row.data) return <InvalidLink reason="not-found" />;
  if (row.data.edit_token !== token) return <InvalidLink reason="bad-token" />;

  const ordersRes = await supabaseAdmin
    .from("hammerex_xrated_orders")
    .select(
      "id, order_ref, amount_pence, currency, provider, status, customer_email, customer_name, cart_items, created_at, paid_at, fulfilled_at, note"
    )
    .eq("listing_id", row.data.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const orders = (ordersRes.data ?? []) as OrderRow[];

  // Summary stats
  const paidOrders = orders.filter((o) => o.status === "paid");
  const paidTotalPence = paidOrders.reduce((s, o) => s + o.amount_pence, 0);
  const unfulfilledCount = paidOrders.filter((o) => !o.fulfilled_at).length;

  const backHref = `/trade-off/edit/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`;
  const paymentsHref = `/trade-off/edit/${encodeURIComponent(slug)}/payments?token=${encodeURIComponent(token)}`;

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <DashboardHeader />
      <section className="mx-auto max-w-4xl px-4 pb-2 pt-10">
        <Link
          href={backHref}
          className="inline-flex h-9 items-center text-xs font-bold text-brand-muted transition hover:text-brand-accent"
        >
          &larr; Back to dashboard
        </Link>
      </section>
      <section className="mx-auto max-w-4xl px-4 pb-6 pt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          Online Payments &middot; Orders
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Your orders
        </h1>
        <p className="mt-3 max-w-2xl text-[13px] text-brand-muted">
          Every order that came through your cart. Money already settled
          direct to your payment provider — this is just your fulfilment
          view.{" "}
          <Link href={paymentsHref} className="text-brand-accent underline">
            Payment setup →
          </Link>
        </p>
      </section>

      <OrdersIsland
        slug={slug}
        token={token}
        orders={orders}
        focusRef={focusRef}
        stats={{
          total: orders.length,
          paid: paidOrders.length,
          paid_total_pence: paidTotalPence,
          unfulfilled: unfulfilledCount
        }}
      />

      <DashboardFooter slug={slug} token={token} />
    </main>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <DashboardHeader />
      <section className="mx-auto max-w-md px-4 pb-24 pt-16 text-center">
        <h1 className="text-2xl font-extrabold">Link expired or invalid</h1>
        <p className="mt-3 text-[13px] text-brand-muted">
          Re-open your dashboard from the link in your email. ({reason})
        </p>
      </section>
    </main>
  );
}
