// src/lib/nex/brains/_supabase.ts
//
// Thin Supabase client wrapper for the Living Trade Brain tables
// (ADR-0037). All server-side · service-role only · never exposed to
// browser code.
//
// Callers (writer · loader · runtime cache · admin routes) import from
// here rather than instantiating their own Supabase client.
// Instantiation is lazy so environments without Supabase credentials
// (local dev · CI without secrets) can still boot the runtime — the
// file-pack loader remains available as a fallback.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  BrainRow,
  BrainVersionRow,
  BrainDraftRow,
  BrainCertificationRow,
  BrainDependencyRow,
  BrainAnswerRow,
  BrainFieldOutcomeRow,
  BrainReviewActionRow,
  NexEventRow,
} from "./_living_types";

// ---------- Lazy client ----------

let cached: SupabaseClient | null = null;
let cachedTried = false;

/**
 * Returns a service-role Supabase client, or null when the environment
 * does not carry credentials. Callers MUST handle the null case (fall
 * back to file-pack loader).
 */
export function brainSupabase(): SupabaseClient | null {
  if (cached || cachedTried) return cached;
  cachedTried = true;
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SERVICE_ROLE_KEY ??
    null;
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-nex-role": "living-brain-runtime" } },
  });
  return cached;
}

/** True when Supabase credentials are present in env. */
export function brainSupabaseAvailable(): boolean {
  return brainSupabase() != null;
}

// ---------- Typed readers ----------

export async function getBrainBySlug(slug: string): Promise<BrainRow | null> {
  const sb = brainSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("hammerex_nex_brains")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`getBrainBySlug(${slug}): ${error.message}`);
  return (data as BrainRow | null) ?? null;
}

export async function listBrains(opts?: {
  status?: string;
  lifecycle_stage?: string;
  category?: string;
  trade?: string;
  primary_country?: string;
  primary_language?: string;
}): Promise<BrainRow[]> {
  const sb = brainSupabase();
  if (!sb) return [];
  let q = sb.from("hammerex_nex_brains").select("*");
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.lifecycle_stage) q = q.eq("lifecycle_stage", opts.lifecycle_stage);
  if (opts?.category) q = q.eq("category", opts.category);
  if (opts?.trade) q = q.eq("trade", opts.trade);
  if (opts?.primary_country) q = q.eq("primary_country", opts.primary_country);
  if (opts?.primary_language) q = q.eq("primary_language", opts.primary_language);
  const { data, error } = await q;
  if (error) throw new Error(`listBrains: ${error.message}`);
  return (data as BrainRow[] | null) ?? [];
}

export async function getBrainVersionById(id: string): Promise<BrainVersionRow | null> {
  const sb = brainSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("hammerex_nex_brain_versions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getBrainVersionById(${id}): ${error.message}`);
  return (data as BrainVersionRow | null) ?? null;
}

export async function getCurrentBrainVersion(slug: string): Promise<BrainVersionRow | null> {
  const brain = await getBrainBySlug(slug);
  if (!brain || !brain.current_version_id) return null;
  return getBrainVersionById(brain.current_version_id);
}

export async function listBrainVersions(slug: string): Promise<BrainVersionRow[]> {
  const sb = brainSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("hammerex_nex_brain_versions")
    .select("*")
    .eq("brain_slug", slug)
    .order("authored_at", { ascending: false });
  if (error) throw new Error(`listBrainVersions(${slug}): ${error.message}`);
  return (data as BrainVersionRow[] | null) ?? [];
}

export async function getBrainDraft(
  slug: string,
  author_id: string
): Promise<BrainDraftRow | null> {
  const sb = brainSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("hammerex_nex_brain_drafts")
    .select("*")
    .eq("brain_slug", slug)
    .eq("author_id", author_id)
    .maybeSingle();
  if (error) throw new Error(`getBrainDraft(${slug}, ${author_id}): ${error.message}`);
  return (data as BrainDraftRow | null) ?? null;
}

export async function listBrainDraftsForReview(): Promise<BrainDraftRow[]> {
  const sb = brainSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("hammerex_nex_brain_drafts")
    .select("*")
    .eq("status", "submitted_for_review")
    .order("submitted_at", { ascending: true });
  if (error) throw new Error(`listBrainDraftsForReview: ${error.message}`);
  return (data as BrainDraftRow[] | null) ?? [];
}

export async function getPrimaryCertification(
  slug: string
): Promise<BrainCertificationRow | null> {
  const sb = brainSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("hammerex_nex_brain_certifications")
    .select("*")
    .eq("brain_slug", slug)
    .eq("is_primary", true)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(`getPrimaryCertification(${slug}): ${error.message}`);
  return (data as BrainCertificationRow | null) ?? null;
}

export async function listBrainDependencies(
  parent_brain_slug: string
): Promise<BrainDependencyRow[]> {
  const sb = brainSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("hammerex_nex_brain_dependencies")
    .select("*")
    .eq("parent_brain_slug", parent_brain_slug)
    .is("removed_at", null);
  if (error) throw new Error(`listBrainDependencies(${parent_brain_slug}): ${error.message}`);
  return (data as BrainDependencyRow[] | null) ?? [];
}

// ---------- Typed writers (raw — most callers should go through withBrainWrite) ----------

export async function insertBrainAnswer(row: Omit<BrainAnswerRow, "id">): Promise<string> {
  const sb = brainSupabase();
  if (!sb) throw new Error("insertBrainAnswer: Supabase not available");
  const { data, error } = await sb
    .from("hammerex_nex_brain_answers")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(`insertBrainAnswer: ${error.message}`);
  return (data as { id: string }).id;
}

export async function insertBrainFieldOutcome(
  row: Omit<BrainFieldOutcomeRow, "id">
): Promise<string> {
  const sb = brainSupabase();
  if (!sb) throw new Error("insertBrainFieldOutcome: Supabase not available");
  const { data, error } = await sb
    .from("hammerex_nex_brain_field_outcomes")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(`insertBrainFieldOutcome: ${error.message}`);
  return (data as { id: string }).id;
}

export async function insertBrainReviewAction(
  row: Omit<BrainReviewActionRow, "id">
): Promise<string> {
  const sb = brainSupabase();
  if (!sb) throw new Error("insertBrainReviewAction: Supabase not available");
  const { data, error } = await sb
    .from("hammerex_nex_brain_review_actions")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(`insertBrainReviewAction: ${error.message}`);
  return (data as { id: string }).id;
}

export async function insertNexEvent(
  row: Omit<NexEventRow, "id" | "occurred_at"> & { occurred_at?: string }
): Promise<string> {
  const sb = brainSupabase();
  if (!sb) throw new Error("insertNexEvent: Supabase not available");
  const { data, error } = await sb
    .from("hammerex_nex_events")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(`insertNexEvent: ${error.message}`);
  return (data as { id: string }).id;
}
