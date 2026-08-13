// directory_seeds — Supabase-backed CRUD for the canonical UK trade directory.
//
// Live source of truth (Philip 2026-08-13 · Option B migration). The JSON
// files under data/directory-seeds/**/*.json remain as archive/audit but
// are NOT read by the runtime anymore — everything flows through this module.
//
// Auth: this module uses supabaseAdmin (service-role · bypasses RLS). Callers
// (feed API, Collector save API) are responsible for their own auth guards
// (isAdminAuthed) at the API layer above.

import "server-only";
import { supabaseNexAdmin as supabaseAdmin } from "@/lib/supabaseNexAdmin";
import type { DirectorySeed } from "./directorySeedLoader";

export type SaveResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string };

/**
 * List every seed in the directory. Ordered by imported_at ASC so admin_ref
 * numbering (NEX-D-001 = oldest) stays stable across reads.
 */
export async function listDirectorySeeds(): Promise<DirectorySeed[]> {
  const res = await supabaseAdmin
    .from("directory_seeds")
    .select("*")
    .order("imported_at", { ascending: true });

  if (res.error) {
    console.error("[directorySeedsDb.listDirectorySeeds]", res.error);
    return [];
  }
  return (res.data ?? []).map(rowToSeed);
}

/**
 * Return a global admin_ref map keyed by seed.id — pairs each seed with its
 * NEX-D-XXX number based on the GLOBAL imported_at order across every trade
 * category.
 *
 * Philip 2026-08-13 (identity-preservation rule): admin_ref numbering must
 * NOT depend on any filter · the same seed always gets the same NEX-D-XXX
 * regardless of whether the current page is Refacing-only, Kitchens-only,
 * or unfiltered. Category filters change what is displayed · never alter the
 * identity of existing records.
 *
 * Deliberately lean: SELECT id + imported_at only · runs in parallel with
 * the filtered feed query so total wall time is max(cheap-map, filtered-feed)
 * rather than sum.
 */
export async function listSeedRefMap(): Promise<Map<string, string>> {
  const res = await supabaseAdmin
    .from("directory_seeds")
    .select("id, imported_at")
    .order("imported_at", { ascending: true });
  const out = new Map<string, string>();
  if (res.error) {
    console.error("[directorySeedsDb.listSeedRefMap]", res.error);
    return out;
  }
  const rows = (res.data ?? []) as Array<{ id: string; imported_at: string | null }>;
  for (let i = 0; i < rows.length; i++) {
    out.set(rows[i].id, `NEX-D-${String(i + 1).padStart(3, "0")}`);
  }
  return out;
}

/**
 * Filter seeds by category — used by the public feed. Cheaper than pulling
 * the whole table when the caller only wants one category.
 */
export async function listDirectorySeedsByCategory(category: string): Promise<DirectorySeed[]> {
  const res = await supabaseAdmin
    .from("directory_seeds")
    .select("*")
    .eq("category", category)
    .order("imported_at", { ascending: true });

  if (res.error) {
    console.error("[directorySeedsDb.listDirectorySeedsByCategory]", res.error);
    return [];
  }
  return (res.data ?? []).map(rowToSeed);
}

/**
 * Insert a new seed. Returns the persisted id + slug on success, or a typed
 * error. Unique violations (23505 · duplicate slug or duplicate email) are
 * translated to human-readable errors so the caller can surface them.
 */
export async function insertDirectorySeed(seed: Partial<DirectorySeed>): Promise<SaveResult> {
  const row = seedToRow(seed);
  const res = await supabaseAdmin
    .from("directory_seeds")
    .insert(row)
    .select("id, slug")
    .maybeSingle();

  if (res.error) {
    // Postgres unique_violation
    if ((res.error as { code?: string }).code === "23505") {
      return { ok: false, error: `duplicate: ${res.error.message}` };
    }
    return { ok: false, error: res.error.message };
  }
  if (!res.data) return { ok: false, error: "insert returned no row" };
  return { ok: true, id: res.data.id as string, slug: res.data.slug as string };
}

/**
 * SQL-backed duplicate detection. Runs before every Collector save. Returns
 * a list of potential matches with match-type ranking (strong/medium/fuzzy)
 * so the Collector UI can show them to the worker.
 */
export type DuplicateHit = {
  match_type: "strong" | "medium" | "fuzzy";
  id: string;
  slug: string;
  business_name: string;
  town: string | null;
  signal: string;
};

export async function findDuplicateCandidates(candidate: {
  business_name: string;
  website?: string | null;
  telephone?: string | null;
  email?: string | null;
  postcode?: string | null;
  town?: string | null;
}): Promise<DuplicateHit[]> {
  const cDomain    = normDomain(candidate.website);
  const cPhone     = normPhone(candidate.telephone);
  const cEmail     = (candidate.email ?? "").trim().toLowerCase();
  const cName      = normName(candidate.business_name);
  const cPostcode  = normPostcode(candidate.postcode);
  const cTown      = (candidate.town ?? "").trim().toLowerCase();

  // Pull all seeds once — at 500-2000 rows this is faster than 4 separate
  // filtered queries. When the table crosses ~5000, migrate to per-signal
  // queries with SQL LIKE / trigram indexes.
  const seeds = await listDirectorySeeds();
  const hits: DuplicateHit[] = [];

  for (const s of seeds) {
    const sDomain   = normDomain(s.website ?? null);
    const sPhone    = normPhone(s.telephone ?? null);
    const sEmail    = (s.email ?? "").trim().toLowerCase();
    const sName     = normName(s.business_name);
    const sPostcode = normPostcode(s.postcode ?? null);
    const sTown     = (s.town ?? "").trim().toLowerCase();

    if (cDomain && sDomain && cDomain === sDomain) {
      hits.push({ match_type: "strong", id: s.id, slug: s.slug, business_name: s.business_name, town: s.town, signal: `website domain (${cDomain})` }); continue;
    }
    if (cPhone && sPhone && cPhone.length >= 7 && cPhone === sPhone) {
      hits.push({ match_type: "strong", id: s.id, slug: s.slug, business_name: s.business_name, town: s.town, signal: `phone` }); continue;
    }
    if (cEmail && sEmail && cEmail === sEmail) {
      hits.push({ match_type: "strong", id: s.id, slug: s.slug, business_name: s.business_name, town: s.town, signal: `email` }); continue;
    }
    if (cPostcode && sPostcode && cPostcode === sPostcode && cName && sName && cName === sName) {
      hits.push({ match_type: "strong", id: s.id, slug: s.slug, business_name: s.business_name, town: s.town, signal: `same postcode + same name` }); continue;
    }
    if (cName && sName && cName === sName && cTown && sTown && cTown === sTown) {
      hits.push({ match_type: "medium", id: s.id, slug: s.slug, business_name: s.business_name, town: s.town, signal: `same normalised name + same town` }); continue;
    }
    if (cName && sName && cName.length >= 5 && sName.length >= 5 && (cName.includes(sName) || sName.includes(cName))) {
      hits.push({ match_type: "fuzzy", id: s.id, slug: s.slug, business_name: s.business_name, town: s.town, signal: `similar company name` });
    }
  }

  return hits.slice(0, 10);
}

/**
 * Merge newly-discovered capabilities + evidence into an EXISTING seed.
 *
 * Path C worker · one-company/many-services model (Philip 2026-08-13):
 *   When the URL queue processor finds a URL that matches an already-known
 *   company (via findDuplicateCandidates), instead of dropping the row as
 *   a duplicate we merge the newly-detected capabilities into the existing
 *   seed. A single business often manufactures AND refurbishes AND installs —
 *   duplicate records would fragment the marketplace.
 *
 * Merge policy:
 *   · capabilities: union · new "yes" values win, existing "yes" preserved
 *   · refacing_evidence: append new items (dedupe by url+summary)
 *   · refacing_qualification: upgrade only (A+ > A > B > C > excluded)
 *   · other fields: never overwritten by the merge — the existing seed's
 *     canonical fields (business_name, phone, email, postcode) stay put
 *     unless they were empty and the new fetch supplies them.
 *
 * Returns { ok:true } on success · logs but doesn't throw on partial failures.
 */
export async function mergeCapabilitiesIntoSeed(
  targetId: string,
  patch: {
    capabilities?: DirectorySeed["capabilities"];
    refacing_evidence?: DirectorySeed["refacing_evidence"];
    refacing_qualification?: DirectorySeed["refacing_qualification"];
    fillIfEmpty?: {
      email?: string | null;
      telephone?: string | null;
      postcode?: string | null;
      description?: string | null;
    };
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cur = await supabaseAdmin
    .from("directory_seeds")
    .select("id, capabilities, refacing_evidence, refacing_qualification, email, telephone, postcode, description")
    .eq("id", targetId)
    .maybeSingle();
  if (cur.error) return { ok: false, error: cur.error.message };
  if (!cur.data) return { ok: false, error: "target_seed_not_found" };

  const existing = cur.data as {
    capabilities?: DirectorySeed["capabilities"];
    refacing_evidence?: DirectorySeed["refacing_evidence"];
    refacing_qualification?: DirectorySeed["refacing_qualification"];
    email: string | null;
    telephone: string | null;
    postcode: string | null;
    description: string | null;
  };

  // Union capabilities (new "yes" wins · never demotes existing "yes" to "unknown").
  const mergedCaps: DirectorySeed["capabilities"] = { ...(existing.capabilities ?? {}) };
  if (patch.capabilities) {
    for (const [k, v] of Object.entries(patch.capabilities)) {
      if (v === "yes") mergedCaps[k as keyof NonNullable<DirectorySeed["capabilities"]>] = "yes";
      else if (v === "no" && mergedCaps[k as keyof NonNullable<DirectorySeed["capabilities"]>] !== "yes") {
        mergedCaps[k as keyof NonNullable<DirectorySeed["capabilities"]>] = "no";
      }
    }
  }

  // Append evidence · dedupe by (url, summary) so re-fetching the same URL
  // doesn't stack duplicate quotes.
  const mergedEvidence = [...(existing.refacing_evidence ?? [])];
  if (patch.refacing_evidence?.length) {
    const key = (e: { url: string; summary: string }) => `${e.url}::${e.summary}`;
    const seen = new Set(mergedEvidence.map(key));
    for (const e of patch.refacing_evidence) {
      if (!seen.has(key(e))) { mergedEvidence.push(e); seen.add(key(e)); }
    }
  }

  // Qualification upgrade only. A+ > A > B > C > excluded.
  const rank: Record<string, number> = { "A+": 5, "A": 4, "B": 3, "C": 2, "excluded": 1 };
  const cur_q = existing.refacing_qualification ?? undefined;
  const new_q = patch.refacing_qualification ?? undefined;
  let finalQ: DirectorySeed["refacing_qualification"] = cur_q;
  if (new_q && (!cur_q || (rank[new_q] ?? 0) > (rank[cur_q] ?? 0))) {
    finalQ = new_q;
  }

  const update: Row = {
    capabilities: mergedCaps,
    refacing_evidence: mergedEvidence,
    refacing_qualification: finalQ,
  };

  // Only backfill empties · never overwrite existing canonical fields.
  if (patch.fillIfEmpty) {
    const f = patch.fillIfEmpty;
    if (!existing.email && f.email)             update.email = f.email;
    if (!existing.telephone && f.telephone)     update.telephone = f.telephone;
    if (!existing.postcode && f.postcode)       update.postcode = f.postcode;
    if (!existing.description && f.description) update.description = f.description;
  }

  const upd = await supabaseAdmin
    .from("directory_seeds")
    .update(update)
    .eq("id", targetId);
  if (upd.error) return { ok: false, error: upd.error.message };
  return { ok: true };
}

// ─── row ↔ seed conversion ────────────────────────────────────
type Row = Record<string, unknown>;

/** DB row → DirectorySeed shape (matches the type used everywhere else). */
function rowToSeed(row: Row): DirectorySeed {
  return {
    id:                      row.id as string,
    slug:                    row.slug as string,
    business_name:           row.business_name as string,
    category:                (row.category ?? null) as string | null,
    primary_trade:           (row.primary_trade ?? "") as string,
    address_line_1:          (row.address_line_1 ?? null) as string | null,
    address_line_2:          (row.address_line_2 ?? null) as string | null,
    town:                    (row.town ?? null) as string | null,
    county:                  (row.county ?? null) as string | null,
    postcode:                (row.postcode ?? null) as string | null,
    country:                 (row.country ?? "United Kingdom") as string,
    telephone:               (row.telephone ?? null) as string | null,
    website:                 (row.website ?? null) as string | null,
    email:                   (row.email ?? null) as string | null,
    opening_hours:           row.opening_hours ?? null,
    description:             (row.description ?? null) as string | null,
    services:                (row.services ?? []) as string[],
    google_rating:           (row.google_rating ?? null) as number | null,
    google_review_count:     (row.google_review_count ?? null) as number | null,
    google_maps_url:         (row.google_maps_url ?? null) as string | null,
    latitude:                (row.latitude ?? null) as number | null,
    longitude:               (row.longitude ?? null) as number | null,
    tags:                    (row.tags ?? []) as string[],
    status:                  (row.status ?? "listed") as string,
    claimed:                 Boolean(row.claimed),
    verified:                Boolean(row.verified),
    visibility:              (row.visibility ?? "public") as string,
    photos:                  (row.photos ?? []) as string[],
    cover_image:             (row.cover_image ?? null) as string | null,
    source:                  (row.source ?? "refacing_discovery") as string,
    imported_at:             (row.imported_at as string),
    capabilities:            (row.capabilities ?? {}) as DirectorySeed["capabilities"],
    refacing_evidence:       (row.refacing_evidence ?? []) as DirectorySeed["refacing_evidence"],
    refacing_qualification:  (row.refacing_qualification ?? undefined) as DirectorySeed["refacing_qualification"],
    email_source:            (row.email_source ?? null) as DirectorySeed["email_source"],
    email_verified:          Boolean(row.email_verified),
    email_checked_at:        (row.email_checked_at ?? null) as string | null,
    lifecycle_status:        (row.lifecycle_status ?? "unclaimed") as DirectorySeed["lifecycle_status"],
    last_verified_at:        (row.last_verified_at ?? null) as string | null,
    directory_state:         (row.directory_state ?? "listed") as DirectorySeed["directory_state"],
    email_status:            (row.email_status ?? undefined) as DirectorySeed["email_status"],
  };
}

/** DirectorySeed (partial) → DB row (drops undefined; keeps null explicit). */
function seedToRow(seed: Partial<DirectorySeed>): Row {
  const row: Row = {};
  const put = <K extends keyof DirectorySeed>(k: K) => {
    if (seed[k] !== undefined) row[k as string] = seed[k];
  };
  (Object.keys(seed) as Array<keyof DirectorySeed>).forEach(put);
  return row;
}

// ─── normalisation helpers (must match Collector form / save API) ─
function normPhone(s: string | null): string { return (s ?? "").replace(/[^\d]/g, ""); }
function normDomain(url: string | null): string {
  if (!url) return "";
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").split("/")[0]; }
}
function normName(s: string | null): string {
  return (s ?? "").toLowerCase()
    .replace(/\b(ltd|limited|plc|llp|co|company|group)\b/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function normPostcode(s: string | null): string { return (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
