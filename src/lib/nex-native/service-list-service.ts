// src/lib/nex-native/service-list-service.ts
//
// Bridge Services-B · sealed 2026-09-30 · server-side CRUD for the
// nex_service table (Migration 112). Backs the ServiceList block on
// cover Templates 04 Tradesperson · 05 Salon · 09 Premium Business.
//
// Named "service-list-service" so the file name doesn't collide with
// the "service" concept (this is a service that manages "services").
//
// All mutations run under the service role (nexSupabaseAdmin). RLS on
// the underlying table denies every client-side write · the seller's
// /manage/services page is the only path to modify these rows.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

export const NEX_SERVICE_NAME_MAX = 80;
export const NEX_SERVICE_DESCRIPTION_MAX = 300;
export const NEX_SERVICE_FROM_PRICE_MAX = 40;

export interface NexServiceRow {
  id: NexUuid;
  business_id: NexUuid;
  name: string;
  description: string;
  from_price: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function listServices(
  businessId: NexUuid,
): Promise<NexServiceRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_service")
    .select(
      "id, business_id, name, description, from_price, sort_order, created_at, updated_at",
    )
    .eq("business_id", businessId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(
      `service-list-service.listServices(${businessId}): ${error.message}`,
    );
  }
  return (data ?? []) as NexServiceRow[];
}

export async function insertService(input: {
  businessId: NexUuid;
  name: string;
  description?: string;
  fromPrice?: string;
  sortOrder?: number;
}): Promise<NexServiceRow> {
  const name = clampText(input.name, NEX_SERVICE_NAME_MAX);
  if (name.length === 0) {
    throw new Error("Service name is required");
  }
  const description = clampText(
    input.description ?? "",
    NEX_SERVICE_DESCRIPTION_MAX,
  );
  const fromPrice = clampText(input.fromPrice ?? "", NEX_SERVICE_FROM_PRICE_MAX);
  const sortOrder =
    typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
      ? Math.max(0, Math.min(9999, Math.floor(input.sortOrder)))
      : await nextSortOrder(input.businessId);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_service")
    .insert({
      business_id: input.businessId,
      name,
      description,
      from_price: fromPrice,
      sort_order: sortOrder,
    })
    .select(
      "id, business_id, name, description, from_price, sort_order, created_at, updated_at",
    )
    .single();
  if (error || !data) {
    throw new Error(
      `service-list-service.insertService: ${error?.message ?? "no data"}`,
    );
  }
  return data as NexServiceRow;
}

export async function updateService(
  id: NexUuid,
  patch: {
    name?: string;
    description?: string;
    fromPrice?: string;
    sortOrder?: number;
  },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (typeof patch.name === "string") {
    const trimmed = clampText(patch.name, NEX_SERVICE_NAME_MAX);
    if (trimmed.length === 0) {
      throw new Error("Service name cannot be empty");
    }
    update.name = trimmed;
  }
  if (typeof patch.description === "string") {
    update.description = clampText(
      patch.description,
      NEX_SERVICE_DESCRIPTION_MAX,
    );
  }
  if (typeof patch.fromPrice === "string") {
    update.from_price = clampText(patch.fromPrice, NEX_SERVICE_FROM_PRICE_MAX);
  }
  if (typeof patch.sortOrder === "number" && Number.isFinite(patch.sortOrder)) {
    update.sort_order = Math.max(0, Math.min(9999, Math.floor(patch.sortOrder)));
  }
  if (Object.keys(update).length === 0) return;
  const { error } = await nexSupabaseAdmin
    .from("nex_service")
    .update(update)
    .eq("id", id);
  if (error) {
    throw new Error(
      `service-list-service.updateService(${id}): ${error.message}`,
    );
  }
}

export async function deleteService(id: NexUuid): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_service")
    .delete()
    .eq("id", id);
  if (error) {
    throw new Error(
      `service-list-service.deleteService(${id}): ${error.message}`,
    );
  }
}

export async function reorderServices(
  businessId: NexUuid,
  orderedIds: NexUuid[],
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await nexSupabaseAdmin
      .from("nex_service")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("business_id", businessId);
    if (error) {
      throw new Error(
        `service-list-service.reorderServices(${orderedIds[i]}@${i}): ${error.message}`,
      );
    }
  }
}

function clampText(v: string, max: number): string {
  return String(v).trim().slice(0, max);
}

async function nextSortOrder(businessId: NexUuid): Promise<number> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_service")
    .select("sort_order")
    .eq("business_id", businessId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (error) {
    throw new Error(
      `service-list-service.nextSortOrder(${businessId}): ${error.message}`,
    );
  }
  const max = data?.[0]?.sort_order;
  return typeof max === "number" ? max + 1 : 0;
}
