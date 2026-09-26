// src/lib/nex-native/banner-service.ts
//
// banner-service · Wave B Slice 12a · Social Banner MVP.
//
// Doctrine:
//   · Identity Doctrine · every FK is UUID · business_id required · product_id optional
//   · Anti-fabrication · caller inputs stored trimmed · empty→null where applicable
//   · CHECK against known palette/status values at both app + DB
//   · Storage untouched on any validation rejection

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

export type NexBannerPalette = "ink" | "blush" | "gold" | "night" | "ivory";
export type NexBannerStatus = "draft" | "live" | "archived";

export const NEX_BANNER_PALETTES: readonly NexBannerPalette[] = [
  "ink", "blush", "gold", "night", "ivory",
] as const;

export const NEX_BANNER_STATUSES: readonly NexBannerStatus[] = [
  "draft", "live", "archived",
] as const;

export interface NexBannerRow {
  id: NexUuid;
  business_id: NexUuid;
  product_id: NexUuid | null;
  headline: string;
  subline: string | null;
  palette: NexBannerPalette;
  status: NexBannerStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateBannerInput {
  business_id: NexUuid;
  product_id?: NexUuid | null;
  headline: string;
  subline?: string | null;
  palette?: NexBannerPalette;
  status?: NexBannerStatus;
}

function normaliseHeadline(raw: string): string {
  const t = raw.trim();
  if (t.length === 0) {
    throw new Error(`banner-service: headline required · empty after trim`);
  }
  if (t.length > 80) {
    throw new Error(`banner-service: headline max 80 chars · got ${t.length}`);
  }
  return t;
}

function normaliseSubline(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  if (t.length > 160) {
    throw new Error(`banner-service: subline max 160 chars · got ${t.length}`);
  }
  return t;
}

function assertPalette(p: NexBannerPalette | undefined): NexBannerPalette {
  if (p === undefined) return "ink";
  if (!NEX_BANNER_PALETTES.includes(p)) {
    throw new Error(`banner-service: unknown palette '${p}' · allowed: ${NEX_BANNER_PALETTES.join(", ")}`);
  }
  return p;
}

function assertStatus(s: NexBannerStatus | undefined): NexBannerStatus {
  if (s === undefined) return "draft";
  if (!NEX_BANNER_STATUSES.includes(s)) {
    throw new Error(`banner-service: unknown status '${s}' · allowed: ${NEX_BANNER_STATUSES.join(", ")}`);
  }
  return s;
}

/** Create a banner · headline required · other fields defaulted. */
export async function createBanner(input: CreateBannerInput): Promise<NexBannerRow> {
  const headline = normaliseHeadline(input.headline);
  const subline = normaliseSubline(input.subline);
  const palette = assertPalette(input.palette);
  const status = assertStatus(input.status);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_banner")
    .insert({
      business_id: input.business_id,
      product_id: input.product_id ?? null,
      headline,
      subline,
      palette,
      status,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`banner-service.createBanner: ${error?.message ?? "no row"}`);
  }
  return data as NexBannerRow;
}

export async function getBannerById(id: NexUuid): Promise<NexBannerRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_banner")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`banner-service.getBannerById: ${error.message}`);
  return (data as NexBannerRow) ?? null;
}

/** List banners for a business · optional status filter · newest first. */
export async function listBannersByBusiness(
  businessId: NexUuid,
  status?: NexBannerStatus
): Promise<NexBannerRow[]> {
  let q = nexSupabaseAdmin.from("nex_banner").select("*").eq("business_id", businessId);
  if (status) q = q.eq("status", status);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(`banner-service.listBannersByBusiness: ${error.message}`);
  return (data as NexBannerRow[]) ?? [];
}

/** Partial update of headline/subline/palette (not status). */
export async function updateBannerBasics(
  id: NexUuid,
  patch: { headline?: string; subline?: string | null; palette?: NexBannerPalette }
): Promise<NexBannerRow> {
  const update: Record<string, string | null> = {};
  if (patch.headline !== undefined) update["headline"] = normaliseHeadline(patch.headline);
  if (patch.subline !== undefined)  update["subline"]  = normaliseSubline(patch.subline);
  if (patch.palette !== undefined)  update["palette"]  = assertPalette(patch.palette);
  if (Object.keys(update).length === 0) {
    const current = await getBannerById(id);
    if (!current) throw new Error(`banner-service.updateBannerBasics: banner ${id} not found`);
    return current;
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_banner")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) throw new Error(`banner-service.updateBannerBasics: ${error?.message ?? "no row"}`);
  return data as NexBannerRow;
}

/** Change status · draft → live → archived · idempotent. */
export async function updateBannerStatus(
  id: NexUuid,
  status: NexBannerStatus
): Promise<NexBannerRow> {
  const s = assertStatus(status);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_banner")
    .update({ status: s })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) throw new Error(`banner-service.updateBannerStatus: ${error?.message ?? "no row"}`);
  return data as NexBannerRow;
}
