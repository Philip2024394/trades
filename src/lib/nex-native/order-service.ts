// src/lib/nex-native/order-service.ts
//
// order-service · commerce operations with idempotency.
//
// Doctrine:
//   · Identity Doctrine · every FK is a UUID · never phone/email
//   · Anti-fabrication · price/currency SNAPSHOTTED at creation from real
//     product record · never invented
//   · Founder 2026-09-24 · idempotency MUST prevent duplicate commerce
//     from retries · nex_order.idempotency_key UNIQUE nullable
//   · Every state transition writes a nex_order_event row (immutable)

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import { getProductById } from "./product-service";
import type {
  NexOrderEventInsert,
  NexOrderEventRow,
  NexOrderRow,
  NexOrderState,
  NexUuid,
} from "./types";

export interface CreateOrderInput {
  customer_account_id: NexUuid;
  product_id: NexUuid;
  source_conversation_id?: NexUuid | null;
  /** Optional client-supplied stable key per creation attempt. When set,
   *  a duplicate attempt returns the existing order instead of creating
   *  a new one. When null, no dedup happens. */
  idempotency_key?: string | null;
  /** Optional buyer note attached at placement · trimmed · max 500 chars. */
  customer_note?: string | null;
}

/**
 * Create an order · price/currency snapshotted from the real product ·
 * business_id derived from the product · IDEMPOTENT when idempotency_key
 * supplied.
 *
 * Never fabricates state on error. If the product doesn't exist, throws.
 * If the idempotency_key collides, returns the existing order without
 * mutating anything.
 */
export async function createOrder(input: CreateOrderInput): Promise<NexOrderRow> {
  // 1 · Resolve the real product (fails loudly if missing)
  const product = await getProductById(input.product_id);
  if (!product) {
    throw new Error(
      `order-service.createOrder: product ${input.product_id} does not exist · refusing to fabricate order`
    );
  }

  // 2 · Idempotency dedup (before INSERT)
  if (input.idempotency_key) {
    const { data: existing, error: readErr } = await nexSupabaseAdmin
      .from("nex_order")
      .select("*")
      .eq("idempotency_key", input.idempotency_key)
      .maybeSingle();
    if (readErr) throw new Error(`order-service.createOrder dedup: ${readErr.message}`);
    if (existing) return existing as NexOrderRow;
  }

  // 3 · Normalise customer_note (trim · empty→null · cap 500)
  let customerNote: string | null = null;
  if (typeof input.customer_note === "string") {
    const trimmed = input.customer_note.trim();
    if (trimmed.length === 0) {
      customerNote = null;
    } else if (trimmed.length > 500) {
      throw new Error(
        `order-service.createOrder: customer_note max 500 chars · got ${trimmed.length}`
      );
    } else {
      customerNote = trimmed;
    }
  }

  // 4 · INSERT with snapshotted price/currency from real product record
  const { data, error } = await nexSupabaseAdmin
    .from("nex_order")
    .insert({
      customer_account_id: input.customer_account_id,
      business_id: product.business_id,
      product_id: product.id,
      source_conversation_id: input.source_conversation_id ?? null,
      state: "created",
      price_pence: product.price_pence,
      currency: product.currency,
      idempotency_key: input.idempotency_key ?? null,
      customer_note: customerNote,
    })
    .select("*")
    .single();

  if (error || !data) {
    // If we lost a race on the unique idempotency_key, re-read and return.
    if (input.idempotency_key && error?.code === "23505") {
      const { data: raced } = await nexSupabaseAdmin
        .from("nex_order")
        .select("*")
        .eq("idempotency_key", input.idempotency_key)
        .maybeSingle();
      if (raced) return raced as NexOrderRow;
    }
    throw new Error(
      `order-service.createOrder: ${error?.message ?? "no row returned"}`
    );
  }
  const order = data as NexOrderRow;

  // 4 · Immutable event trail · created
  await recordOrderEvent({
    order_id: order.id,
    event: "created",
    actor_account_id: input.customer_account_id,
    metadata: {
      product_id: order.product_id,
      business_id: order.business_id,
      price_pence: order.price_pence,
      currency: order.currency,
    },
  });

  return order;
}

/**
 * Update the merchant-only internal note. Empty string normalises to
 * NULL · trim · 500-char cap · never fabricated. Storage untouched on any
 * violation (throws). Editable at any state.
 */
export async function updateMerchantNote(
  id: NexUuid,
  merchantNote: string | null
): Promise<NexOrderRow> {
  let value: string | null = merchantNote;
  if (typeof value === "string") {
    value = value.trim();
    if (value.length === 0) value = null;
    else if (value.length > 500) {
      throw new Error(
        `order-service.updateMerchantNote: merchant_note max 500 chars · got ${value.length}`
      );
    }
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_order")
    .update({ merchant_note: value })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `order-service.updateMerchantNote: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexOrderRow;
}

/** Update the merchant-provided dispatch/tracking URL · empty/whitespace
 *  clears to null · http/https prefix required · length cap 1024 (DB CHECK). */
export async function updateOrderTracking(
  id: NexUuid,
  url: string | null,
): Promise<NexOrderRow> {
  let value: string | null = null;
  if (typeof url === "string") {
    const trimmed = url.trim();
    if (trimmed.length > 0) {
      if (!/^https?:\/\//i.test(trimmed)) {
        throw new Error(
          "order-service.updateOrderTracking: url must start with http:// or https://"
        );
      }
      if (trimmed.length > 1024) {
        throw new Error(
          `order-service.updateOrderTracking: url max 1024 chars · got ${trimmed.length}`
        );
      }
      value = trimmed;
    }
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_order")
    .update({ dispatch_tracking_url: value })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `order-service.updateOrderTracking: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexOrderRow;
}

/** List every order for a business · newest-first · optional state filter. */
export async function listOrdersByBusiness(
  businessId: NexUuid,
  state?: NexOrderState
): Promise<NexOrderRow[]> {
  let q = nexSupabaseAdmin.from("nex_order").select("*").eq("business_id", businessId);
  if (state) q = q.eq("state", state);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(`order-service.listOrdersByBusiness: ${error.message}`);
  return (data as NexOrderRow[]) ?? [];
}

/** Wave B Slice 4h · search + filter + sort for the merchant orders queue.
 *  Additive · doesn't replace listOrdersByBusiness (existing callers untouched).
 *  Filtering + sorting done in-DB except substring search which is JS-side
 *  (Supabase .or with %ilike% + prefix on uuid is achievable but keeps the
 *  service API narrow for now). */
export type OrderQueueSort = "newest" | "oldest" | "price_desc" | "price_asc";
export interface OrderQueueQuery {
  states?: NexOrderState[];
  search?: string;
  sort?: OrderQueueSort;
  limit?: number;
}
export async function searchOrders(
  businessId: NexUuid,
  q: OrderQueueQuery = {},
): Promise<NexOrderRow[]> {
  const limit = Math.max(1, Math.min(500, q.limit ?? 100));
  if (q.states) {
    for (const s of q.states) {
      if (!["created", "pending", "paid", "completed", "cancelled", "refunded"].includes(s)) {
        throw new Error(`order-service.searchOrders: unknown state '${s}'`);
      }
    }
  }
  let query = nexSupabaseAdmin.from("nex_order").select("*").eq("business_id", businessId);
  if (q.states && q.states.length > 0) {
    query = query.in("state", q.states);
  }
  const sort = q.sort ?? "newest";
  switch (sort) {
    case "newest":     query = query.order("created_at", { ascending: false }); break;
    case "oldest":     query = query.order("created_at", { ascending: true }); break;
    case "price_desc": query = query.order("price_pence", { ascending: false }); break;
    case "price_asc":  query = query.order("price_pence", { ascending: true }); break;
  }
  query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw new Error(`order-service.searchOrders: ${error.message}`);
  let rows = (data as NexOrderRow[]) ?? [];
  if (q.search) {
    const needle = q.search.trim().toLowerCase();
    if (needle.length > 0) {
      rows = rows.filter((r) =>
        r.id.toLowerCase().startsWith(needle) ||
        (r.customer_note?.toLowerCase().includes(needle) ?? false) ||
        (r.merchant_note?.toLowerCase().includes(needle) ?? false),
      );
    }
  }
  return rows;
}

/** List every order placed by a customer · newest-first. */
export async function listOrdersByCustomer(
  customerAccountId: NexUuid
): Promise<NexOrderRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_order")
    .select("*")
    .eq("customer_account_id", customerAccountId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`order-service.listOrdersByCustomer: ${error.message}`);
  return (data as NexOrderRow[]) ?? [];
}

/** Read one order by NEX UUID. */
export async function getOrderById(id: NexUuid): Promise<NexOrderRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_order")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`order-service.getOrderById: ${error.message}`);
  return (data as NexOrderRow) ?? null;
}

/** Transition order state · writes an immutable event row alongside. */
export async function transitionOrderState(
  id: NexUuid,
  toState: NexOrderState,
  actorAccountId?: NexUuid | null,
  metadata?: Record<string, unknown>
): Promise<NexOrderRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_order")
    .update({ state: toState })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `order-service.transitionOrderState: ${error?.message ?? "no row returned"}`
    );
  }
  await recordOrderEvent({
    order_id: id,
    event: toState,
    actor_account_id: actorAccountId ?? null,
    metadata: metadata ?? {},
  });
  return data as NexOrderRow;
}

/** Write an immutable event row. */
export async function recordOrderEvent(
  input: NexOrderEventInsert
): Promise<NexOrderEventRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_order_event")
    .insert({
      order_id: input.order_id,
      event: input.event,
      actor_account_id: input.actor_account_id ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `order-service.recordOrderEvent: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexOrderEventRow;
}

/** Read every event for an order, chronological. */
export async function listOrderEvents(
  orderId: NexUuid
): Promise<NexOrderEventRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_order_event")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`order-service.listOrderEvents: ${error.message}`);
  return (data as NexOrderEventRow[]) ?? [];
}
