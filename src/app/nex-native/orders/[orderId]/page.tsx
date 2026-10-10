// src/app/nex-native/orders/[orderId]/page.tsx
//
// Customer order status page · Slice 4b · offline payment doctrine.
// ------------------------------------------------------------------
// Server Component · shows:
//   · order state chip (created / paid / completed / cancelled / refunded)
//   · timeline of nex_order_event rows
//   · product name + price · business display_name + logo
//   · seller contact (public_phone / public_email / website_url)
//   · payment_instructions (bank details etc.)
//   · COD / pickup badges when the seller has activated them
//   · "Message seller" link to the source conversation (when present)
//   · buyer's own customer_note if they attached one
//
// Access: caller MUST be the customer on the order · owner-of-business is
// silently redirected to the merchant fulfilment queue instead.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import * as orderService from "@/lib/nex-native/order-service";
import type { NexOrderState } from "@/lib/nex-native/types";
import {
  customerCancelOrderAction,
  customerMarkPaymentSentAction,
} from "../../_actions";
import { SubmitButton } from "../../_submit-button";
import { NexNativeShell } from "../../_shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_BADGE_CLASS: Record<NexOrderState, string> = {
  created:   "bg-blue-100    text-blue-900    border-blue-300",
  pending:   "bg-amber-100   text-amber-900   border-amber-300",
  paid:      "bg-green-100   text-green-900   border-green-300",
  completed: "bg-emerald-100 text-emerald-900 border-emerald-300",
  cancelled: "bg-neutral-200 text-neutral-700 border-neutral-300",
  refunded:  "bg-rose-100    text-rose-900    border-rose-300",
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ e?: string; m?: string }>;
}) {
  const { orderId } = await params;
  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(`/nex-native/conversations?e=unauthenticated&m=${encodeURIComponent("sign in to view your order")}`);
  }

  const order = await orderService.getOrderById(orderId);
  if (!order) notFound();

  if (order.customer_account_id !== session.account.id) {
    const business = await businessService.getBusinessById(order.business_id);
    if (business && business.owner_account_id === session.account.id) {
      redirect("/nex-native/manage/orders");
    }
    return (
      <NexNativeShell>
        <main className="mx-auto max-w-2xl px-4 py-6">
          <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            You are not authorised to view this order.
          </div>
        </main>
      </NexNativeShell>
    );
  }

  const [business, product, events] = await Promise.all([
    businessService.getBusinessById(order.business_id),
    productService.getProductById(order.product_id),
    orderService.listOrderEvents(order.id),
  ]);
  if (!business) notFound();

  const priceFormatted = `${order.currency} ${(order.price_pence / 100).toFixed(2)}`;

  return (
    <NexNativeShell>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-4 border-b border-neutral-300 pb-3">
          <Link href="/nex-native/orders" className="text-xs text-neutral-500 underline">
            ← your orders
          </Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-neutral-900">
                {product?.name ?? "(product removed)"}
              </h1>
              <p className="text-xs text-neutral-500">
                {priceFormatted} · order{" "}
                <code className="font-mono">{order.id.slice(0, 8)}…</code>{" "}
                · placed {new Date(order.created_at).toLocaleString()}
              </p>
            </div>
            <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${STATE_BADGE_CLASS[order.state]}`}>
              {order.state}
            </span>
          </div>
        </header>

        {banner && (
          <div
            className={`mb-4 rounded border p-3 text-xs ${
              banner.code === "cancelled" || banner.code === "payment_sent"
                ? "border-green-300 bg-green-50 text-green-900"
                : "border-red-300 bg-red-50 text-red-900"
            }`}
            role="status"
          >
            {banner.message}
          </div>
        )}

        {order.customer_note && (
          <section className="mb-4 rounded border border-neutral-200 bg-neutral-50 p-3 text-sm">
            <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
              Your note to the seller
            </div>
            <p className="whitespace-pre-wrap text-neutral-800">{order.customer_note}</p>
          </section>
        )}

        {order.dispatch_tracking_url && (
          <section className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm">
            <div className="mb-1 text-xs uppercase tracking-wide text-blue-700">
              Dispatch tracking
            </div>
            <a
              href={order.dispatch_tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-mono text-xs text-blue-900 underline"
            >
              {order.dispatch_tracking_url}
            </a>
          </section>
        )}

        <section className="mb-4 rounded border border-neutral-200 bg-white p-3">
          <div className="mb-2 flex items-start gap-3">
            {business.logo_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={business.logo_url}
                alt={`${business.display_name} logo`}
                className="h-12 w-12 flex-shrink-0 rounded border border-neutral-200 object-contain bg-white"
              />
            )}
            <div className="min-w-0">
              <div className="font-medium text-neutral-900">{business.display_name}</div>
              <div className="text-xs text-neutral-500">
                <Link href={`/nex-native/${business.slug}`} className="font-mono underline">
                  /nex-native/{business.slug}
                </Link>
              </div>
            </div>
          </div>

          {(business.public_phone || business.public_email || business.website_url) && (
            <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs text-neutral-700">
              {business.public_phone && (
                <>
                  <dt className="text-neutral-500">Phone</dt>
                  <dd>
                    <a href={`tel:${business.public_phone}`} className="underline">
                      {business.public_phone}
                    </a>
                  </dd>
                </>
              )}
              {business.public_email && (
                <>
                  <dt className="text-neutral-500">Email</dt>
                  <dd>
                    <a href={`mailto:${business.public_email}`} className="underline">
                      {business.public_email}
                    </a>
                  </dd>
                </>
              )}
              {business.website_url && (
                <>
                  <dt className="text-neutral-500">Website</dt>
                  <dd>
                    <a href={business.website_url} target="_blank" rel="noopener noreferrer" className="underline">
                      {business.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  </dd>
                </>
              )}
            </dl>
          )}
        </section>

        <section className="mb-4 rounded border border-neutral-200 bg-neutral-50 p-3">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Paying the seller
          </h2>
          <p className="mb-2 text-sm text-neutral-800">
            NEX does not process payments. You settle directly with the seller.
          </p>
          {business.payment_instructions ? (
            <div className="mb-2 rounded border border-neutral-200 bg-white p-2 text-xs text-neutral-800">
              <div className="mb-1 text-neutral-500">Seller&apos;s instructions:</div>
              <div className="whitespace-pre-wrap">{business.payment_instructions}</div>
            </div>
          ) : (
            <p className="mb-2 text-xs text-neutral-600">
              The seller has not published payment instructions · use NEX Chat to ask them how to pay.
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {business.accepts_cod && (
              <span className="rounded border border-green-300 bg-green-50 px-2 py-0.5 text-xs text-green-900">
                Cash on delivery available
              </span>
            )}
            {business.accepts_pickup && (
              <span className="rounded border border-green-300 bg-green-50 px-2 py-0.5 text-xs text-green-900">
                Customer pickup available
              </span>
            )}
          </div>
          {order.source_conversation_id && (
            <Link
              href={`/nex-native/conversations/${order.source_conversation_id}`}
              className="mt-3 inline-block rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
            >
              Message seller in NEX Chat
            </Link>
          )}
        </section>

        <section className="mb-4">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Timeline
          </h2>
          {events.length === 0 ? (
            <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              No events yet.
            </p>
          ) : (
            <ol className="grid gap-2">
              {events.map((e) => (
                <li key={e.id} className="rounded border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{e.event}</span>
                    <span className="text-xs text-neutral-500">
                      {new Date(e.created_at).toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {order.state === "created" && (
          <section className="mb-4 rounded border border-neutral-200 bg-white p-3">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Tell the seller you&apos;ve sent payment
            </h2>
            <p className="mb-2 text-xs text-neutral-600">
              Send the money to the seller (bank transfer · COD arranged · pickup)
              then tap below. The seller confirms once they receive it.
            </p>
            <form action={customerMarkPaymentSentAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="order_id" value={order.id} />
              <label className="min-w-0 flex-1 text-xs text-neutral-600">
                Note to seller (optional)
                <input
                  type="text"
                  name="reason"
                  maxLength={200}
                  placeholder="e.g. paid by bank transfer · ref order id"
                  className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
                />
              </label>
              <SubmitButton
                label="I've sent payment"
                pendingLabel="Notifying seller…"
              />
            </form>
          </section>
        )}

        {(order.state === "created" || order.state === "pending") && (
          <section className="mb-4 rounded border border-neutral-200 bg-white p-3">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Cancel this order
            </h2>
            <p className="mb-2 text-xs text-neutral-600">
              You can cancel while the order is still pre-payment. After the
              seller marks it paid, contact them for a refund instead.
            </p>
            <form action={customerCancelOrderAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="order_id" value={order.id} />
              <label className="min-w-0 flex-1 text-xs text-neutral-600">
                Reason (optional)
                <input
                  type="text"
                  name="reason"
                  maxLength={200}
                  placeholder="Changed my mind · anything the seller should know"
                  className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
                />
              </label>
              <SubmitButton
                label="Cancel order"
                pendingLabel="Cancelling…"
                variant="secondary"
              />
            </form>
          </section>
        )}

        <p className="text-xs text-neutral-500">
          Once the seller receives payment they will mark this order paid · the state chip above updates automatically.
        </p>
      </main>
    </NexNativeShell>
  );
}
