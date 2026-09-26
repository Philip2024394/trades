// src/app/nex-native/manage/orders/page.tsx
//
// Merchant fulfilment queue · pilot scope.
// ----------------------------------------
// Server Component · lists every order for the merchant's single owned
// business (pilot: one business per user). Actions:
//   · Mark as paid          · created → paid  · posts ledger entry
//   · Mark as completed     · paid → completed
//   · Cancel                · created / pending → cancelled
//   · Refund                · paid / completed → refunded · posts reversal
//
// Doctrine references:
//   · Identity Doctrine · every action guarded by owner_account_id
//   · State machine trigger 007 enforces valid transitions at the DB layer
//     · this page NEVER offers invalid buttons (the UI mirrors the trigger)
//   · Reversal-safe · refund posts a compensating ledger entry · never
//     mutates historical facts

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as orderService from "@/lib/nex-native/order-service";
import * as productService from "@/lib/nex-native/product-service";
import type { NexOrderRow, NexOrderState, NexProductRow } from "@/lib/nex-native/types";
import {
  cancelOrderAction,
  markOrderCompletedAction,
  markOrderPaidAction,
  refundOrderAction,
  signOutAction,
  updateMerchantNoteAction,
  updateOrderTrackingAction,
} from "../../_actions";
import { SubmitButton } from "../../_submit-button";
import { NexNativeShell } from "../../_shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string; state?: string; q?: string; sort?: string }>;
}

const SUCCESS_CODES = new Set([
  "marked_paid",
  "marked_completed",
  "cancelled",
  "refunded",
  "merchant_note_updated",
  "tracking_updated",
]);

const STATE_LABEL: Record<NexOrderState, string> = {
  created: "created",
  pending: "pending",
  paid: "paid",
  completed: "completed",
  cancelled: "cancelled",
  refunded: "refunded",
};

const STATE_BADGE_CLASS: Record<NexOrderState, string> = {
  created:   "bg-blue-100    text-blue-900    border-blue-300",
  pending:   "bg-amber-100   text-amber-900   border-amber-300",
  paid:      "bg-green-100   text-green-900   border-green-300",
  completed: "bg-emerald-100 text-emerald-900 border-emerald-300",
  cancelled: "bg-neutral-200 text-neutral-700 border-neutral-300",
  refunded:  "bg-rose-100    text-rose-900    border-rose-300",
};

function formatGbp(pence: number): string {
  return (pence / 100).toFixed(2);
}

function nextAllowedActions(state: NexOrderState): {
  paid: boolean;
  completed: boolean;
  cancelled: boolean;
  refunded: boolean;
} {
  switch (state) {
    case "created":   return { paid: true,  completed: false, cancelled: true,  refunded: false };
    case "pending":   return { paid: true,  completed: false, cancelled: true,  refunded: false };
    case "paid":      return { paid: false, completed: true,  cancelled: false, refunded: true  };
    case "completed": return { paid: false, completed: false, cancelled: false, refunded: true  };
    case "cancelled": return { paid: false, completed: false, cancelled: false, refunded: false };
    case "refunded":  return { paid: false, completed: false, cancelled: false, refunded: false };
  }
}

export default async function Page({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const params = await searchParams;
  const banner = params.e && params.m ? { code: params.e, message: params.m } : null;
  const bannerIsSuccess = banner ? SUCCESS_CODES.has(banner.code) : false;

  const stateFilterRaw = (params.state ?? "").toLowerCase();
  const KNOWN_STATES = ["created", "pending", "paid", "completed", "cancelled", "refunded"] as const;
  // Multi-state via comma-separated: ?state=paid,pending
  const stateFilterList: NexOrderState[] = stateFilterRaw
    ? stateFilterRaw.split(",").map((s) => s.trim()).filter((s): s is NexOrderState =>
        (KNOWN_STATES as readonly string[]).includes(s))
    : [];
  const stateFilter: NexOrderState | undefined =
    stateFilterList.length === 1 ? stateFilterList[0] : undefined;

  const searchRaw = String(params.q ?? "").trim();
  const KNOWN_SORTS = ["newest", "oldest", "price_desc", "price_asc"] as const;
  const sortRaw = String(params.sort ?? "newest");
  const sort: (typeof KNOWN_SORTS)[number] = (KNOWN_SORTS as readonly string[]).includes(sortRaw)
    ? (sortRaw as (typeof KNOWN_SORTS)[number]) : "newest";

  const owned = await businessService.listBusinessesByOwner(session.account.id);
  if (owned.length === 0) redirect("/nex-native/onboarding");
  const business = owned[0];

  const orders = await orderService.searchOrders(business.id, {
    states: stateFilterList.length > 0 ? stateFilterList : undefined,
    search: searchRaw.length > 0 ? searchRaw : undefined,
    sort,
  });

  // Enrich with product names in one round-trip
  const productIds = Array.from(new Set(orders.map((o) => o.product_id)));
  const productRows: NexProductRow[] = await Promise.all(
    productIds.map((id) => productService.getProductById(id))
  ).then((rows) => rows.filter((r): r is NexProductRow => Boolean(r)));
  const productById = new Map(productRows.map((p) => [p.id, p]));

  // Slice 4i · fetch event timeline per order (parallel)
  const eventsByOrder = new Map<string, Awaited<ReturnType<typeof orderService.listOrderEvents>>>();
  await Promise.all(orders.map(async (o) => {
    eventsByOrder.set(o.id, await orderService.listOrderEvents(o.id));
  }));

  return (
    <NexNativeShell>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-neutral-300 pb-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">
              Orders · {business.display_name}
            </h1>
            <p className="text-xs text-neutral-500">
              <Link href="/nex-native/manage" className="underline">← back to products</Link>
              {" · "}
              <Link href={`/nex-native/${business.slug}`} className="underline">public page</Link>
              {" · "}
              <a href="/nex-native/manage/orders/export.csv" download className="underline">download CSV</a>
            </p>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="text-xs text-neutral-500 underline">
              sign out
            </button>
          </form>
        </header>

        {banner && (
          <div
            className={`mb-4 rounded border p-3 text-xs ${
              bannerIsSuccess
                ? "border-green-300 bg-green-50 text-green-900"
                : "border-red-300 bg-red-50 text-red-900"
            }`}
            role="status"
          >
            {banner.code === "marked_paid" && (
              <>Order marked paid · <span className="font-mono">{banner.message}…</span></>
            )}
            {banner.code === "marked_completed" && (
              <>Order marked completed · <span className="font-mono">{banner.message}…</span></>
            )}
            {banner.code === "cancelled" && (
              <>Order cancelled · <span className="font-mono">{banner.message}…</span></>
            )}
            {banner.code === "refunded" && (
              <>Order refunded · <span className="font-mono">{banner.message}…</span></>
            )}
            {!SUCCESS_CODES.has(banner.code) && banner.message}
          </div>
        )}

        <nav className="mb-3 flex flex-wrap gap-2 text-xs">
          <FilterLink current={stateFilter} value={undefined} label="all" />
          <FilterLink current={stateFilter} value="created" label="created" />
          <FilterLink current={stateFilter} value="pending" label="pending" />
          <FilterLink current={stateFilter} value="paid" label="paid" />
          <FilterLink current={stateFilter} value="completed" label="completed" />
          <FilterLink current={stateFilter} value="cancelled" label="cancelled" />
          <FilterLink current={stateFilter} value="refunded" label="refunded" />
        </nav>

        {/* Slice 4h · search + sort form · GET-submits so URL stays shareable */}
        <form method="get" action="/nex-native/manage/orders" className="mb-4 flex flex-wrap items-end gap-2 rounded border border-neutral-200 bg-neutral-50 p-3">
          {stateFilterList.length > 0 && (
            <input type="hidden" name="state" value={stateFilterList.join(",")} />
          )}
          <label className="text-xs text-neutral-600">
            Search
            <input
              type="text"
              name="q"
              defaultValue={searchRaw}
              placeholder="id prefix or note substring"
              className="mt-1 block min-h-[36px] w-56 rounded border border-neutral-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="text-xs text-neutral-600">
            Sort
            <select
              name="sort"
              defaultValue={sort}
              className="mt-1 block min-h-[36px] rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
            >
              <option value="newest">newest</option>
              <option value="oldest">oldest</option>
              <option value="price_desc">price (high→low)</option>
              <option value="price_asc">price (low→high)</option>
            </select>
          </label>
          <button
            type="submit"
            className="min-h-[36px] rounded bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800"
          >
            Apply
          </button>
          {(searchRaw || sort !== "newest") && (
            <a
              href={stateFilter ? `/nex-native/manage/orders?state=${stateFilter}` : "/nex-native/manage/orders"}
              className="text-[11px] text-neutral-500 underline"
            >
              clear
            </a>
          )}
        </form>

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Orders ({orders.length}
            {stateFilterList.length > 0 && ` · state ${stateFilterList.join("+")}`}
            {searchRaw && ` · matching "${searchRaw}"`}
            {sort !== "newest" && ` · sort ${sort}`})
          </h2>

          {orders.length === 0 ? (
            <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-3 text-xs text-neutral-600">
              No orders yet{stateFilter ? ` in state '${stateFilter}'` : ""}.
            </p>
          ) : (
            <ul className="grid gap-3">
              {orders.map((o) => {
                const product = productById.get(o.product_id);
                const allowed = nextAllowedActions(o.state);
                return (
                  <li
                    key={o.id}
                    className="rounded border border-neutral-200 bg-white p-3 text-sm text-neutral-800"
                  >
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-neutral-900">
                          {product?.name ?? "(product removed)"}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {o.currency} {formatGbp(o.price_pence)} · id{" "}
                          <code className="font-mono">{o.id.slice(0, 8)}…</code>{" "}
                          · created {new Date(o.created_at).toLocaleString()}
                        </div>
                      </div>
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${STATE_BADGE_CLASS[o.state]}`}
                      >
                        {STATE_LABEL[o.state]}
                      </span>
                    </div>

                    {o.customer_note && (
                      <div className="mb-2 rounded border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-800">
                        <div className="text-neutral-500">Buyer note</div>
                        <div className="whitespace-pre-wrap">{o.customer_note}</div>
                      </div>
                    )}

                    {(allowed.paid || allowed.completed || allowed.cancelled || allowed.refunded) ? (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {allowed.paid && (
                          <form action={markOrderPaidAction}>
                            <input type="hidden" name="order_id" value={o.id} />
                            <SubmitButton
                              label="Mark paid"
                              pendingLabel="Marking paid…"
                              variant="secondary"
                            />
                          </form>
                        )}
                        {allowed.completed && (
                          <form action={markOrderCompletedAction}>
                            <input type="hidden" name="order_id" value={o.id} />
                            <SubmitButton
                              label="Mark completed"
                              pendingLabel="Completing…"
                              variant="secondary"
                            />
                          </form>
                        )}
                        {allowed.cancelled && (
                          <form action={cancelOrderAction}>
                            <input type="hidden" name="order_id" value={o.id} />
                            <SubmitButton
                              label="Cancel"
                              pendingLabel="Cancelling…"
                              variant="secondary"
                            />
                          </form>
                        )}
                        {allowed.refunded && (
                          <form action={refundOrderAction}>
                            <input type="hidden" name="order_id" value={o.id} />
                            <SubmitButton
                              label="Refund"
                              pendingLabel="Refunding…"
                              variant="secondary"
                            />
                          </form>
                        )}
                      </div>
                    ) : (
                      <p className="mb-3 text-xs text-neutral-500">
                        Terminal state · no further transitions available.
                      </p>
                    )}

                    <form action={updateMerchantNoteAction} className="rounded border border-neutral-200 bg-neutral-50 p-2">
                      <input type="hidden" name="order_id" value={o.id} />
                      <label className="block text-xs text-neutral-600">
                        Your note (internal · not shown to buyer)
                        <textarea
                          name="merchant_note"
                          maxLength={500}
                          rows={2}
                          placeholder="Tracking · dispatch date · handling notes · max 500 chars"
                          defaultValue={o.merchant_note ?? ""}
                          className="mt-1 block w-full rounded border border-neutral-300 px-2 py-2 text-xs"
                        />
                      </label>
                      <div className="mt-2 flex justify-end">
                        <SubmitButton
                          label="Save note"
                          pendingLabel="Saving…"
                          variant="secondary"
                        />
                      </div>
                    </form>

                    <form action={updateOrderTrackingAction} className="mt-2 rounded border border-neutral-200 bg-neutral-50 p-2">
                      <input type="hidden" name="order_id" value={o.id} />
                      <label className="block text-xs text-neutral-600">
                        Dispatch / tracking URL (shown to buyer)
                        <input
                          type="url"
                          name="dispatch_tracking_url"
                          maxLength={1024}
                          placeholder="https://tracking.example.com/parcel/ABC123"
                          defaultValue={o.dispatch_tracking_url ?? ""}
                          className="mt-1 block min-h-[40px] w-full rounded border border-neutral-300 px-2 py-2 text-xs"
                        />
                      </label>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-neutral-500">
                          must start with http:// or https:// · leave blank to clear
                        </span>
                        <SubmitButton label="Save tracking" pendingLabel="Saving…" variant="secondary" />
                      </div>
                    </form>

                    {/* Slice 4i · event timeline · collapsed by default */}
                    {(() => {
                      const events = eventsByOrder.get(o.id) ?? [];
                      if (events.length === 0) return null;
                      return (
                        <details className="mt-2 rounded border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-700">
                          <summary className="cursor-pointer font-medium text-neutral-800">
                            History ({events.length} event{events.length === 1 ? "" : "s"})
                          </summary>
                          <ol className="mt-2 space-y-1">
                            {events.map((ev) => {
                              const meta = ev.metadata as Record<string, unknown>;
                              const reason = typeof meta?.reason === "string" ? meta.reason : null;
                              return (
                                <li key={ev.id} className="flex items-baseline gap-2">
                                  <span className="w-16 shrink-0 font-mono text-[10px] text-neutral-500">
                                    {new Date(ev.created_at).toLocaleTimeString()}
                                  </span>
                                  <span className="font-medium text-neutral-900">{ev.event}</span>
                                  {reason && (
                                    <span className="truncate text-neutral-600">· {reason}</span>
                                  )}
                                  <span className="ml-auto shrink-0 text-[10px] text-neutral-400">
                                    {new Date(ev.created_at).toLocaleDateString()}
                                  </span>
                                </li>
                              );
                            })}
                          </ol>
                        </details>
                      );
                    })()}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </NexNativeShell>
  );
}

function FilterLink({
  current,
  value,
  label,
}: {
  current: NexOrderState | undefined;
  value: NexOrderState | undefined;
  label: string;
}) {
  const active = current === value;
  const href = value
    ? `/nex-native/manage/orders?state=${value}`
    : "/nex-native/manage/orders";
  return (
    <Link
      href={href}
      className={`rounded border px-2 py-1 ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500"
      }`}
    >
      {label}
    </Link>
  );
}
