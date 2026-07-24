// Property resolver — turn a hint into a PropertyRef with permission
// check baked in.
//
// Hints supported:
//   • { kind: "property_id", id }  — the derived pseudo-id
//   • { kind: "project_id",  id }  — look up the project → property
//   • { kind: "address",     query, homeowner_id? } — fuzzy address
//   • { kind: "postcode",    postcode, homeowner_id? } — postcode
//
// Permission: for a homeowner viewer the resolved property MUST
// belong to them. For a merchant viewer they MUST be a member on at
// least one project at that property (via hammerex_sitebook_members).

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { derivePropertyId, type PropertyRef, type ViewerType } from "./types";

export type PropertyRefHint =
  | { kind: "property_id"; id: string }
  | { kind: "project_id";  id: string }
  | { kind: "address";     query: string; homeownerId?: string }
  | { kind: "postcode";    postcode: string; homeownerId?: string };

export type ResolveOk  = { ok: true;  property: PropertyRef; project_ids: string[] };
export type ResolveErr = { ok: false; reason: "not_found" | "ambiguous" | "not_yours"; matches?: PropertyRef[] };

export type ResolveInput = {
  hint:              PropertyRefHint;
  viewer:            ViewerType;
  viewerId:          string;     // homeowner_id OR merchant listing_id
};

const MAX_MATCHES = 8;

type ProjectRow = {
  id: string;
  homeowner_id: string;
  address_postcode: string | null;
  address_line: string | null;
  address_city: string | null;
  created_at: string;
};

export async function resolveProperty(input: ResolveInput): Promise<ResolveOk | ResolveErr> {
  // ── 1. Load candidate projects.
  let projects: ProjectRow[] = [];

  if (input.hint.kind === "project_id") {
    const r = await supabaseAdmin
      .from("hammerex_sitebook_projects")
      .select("id, homeowner_id, address_postcode, address_line, address_city, created_at")
      .eq("id", input.hint.id)
      .maybeSingle();
    if (r.data) projects = [r.data as ProjectRow];
  } else if (input.hint.kind === "property_id") {
    // Capture the id in a local — closures can't narrow through
    // input.hint on a later re-check.
    const targetId = input.hint.id;
    const q = supabaseAdmin
      .from("hammerex_sitebook_projects")
      .select("id, homeowner_id, address_postcode, address_line, address_city, created_at");
    const r = input.viewer === "homeowner"
      ? await q.eq("homeowner_id", input.viewerId)
      : await q; // merchant path filtered below via membership
    projects = (r.data ?? []).filter((p) => derivePropertyId(String(p.homeowner_id), (p.address_postcode as string | null) ?? null, (p.address_line as string | null) ?? null) === targetId) as ProjectRow[];
  } else if (input.hint.kind === "postcode") {
    let q = supabaseAdmin
      .from("hammerex_sitebook_projects")
      .select("id, homeowner_id, address_postcode, address_line, address_city, created_at")
      .ilike("address_postcode", `${input.hint.postcode}%`)
      .limit(MAX_MATCHES);
    if (input.hint.homeownerId) q = q.eq("homeowner_id", input.hint.homeownerId);
    if (input.viewer === "homeowner") q = q.eq("homeowner_id", input.viewerId);
    projects = ((await q).data ?? []) as ProjectRow[];
  } else {   // address text search
    let q = supabaseAdmin
      .from("hammerex_sitebook_projects")
      .select("id, homeowner_id, address_postcode, address_line, address_city, created_at")
      .ilike("address_line", `%${input.hint.query}%`)
      .limit(MAX_MATCHES);
    if (input.hint.homeownerId) q = q.eq("homeowner_id", input.hint.homeownerId);
    if (input.viewer === "homeowner") q = q.eq("homeowner_id", input.viewerId);
    projects = ((await q).data ?? []) as ProjectRow[];
  }

  if (projects.length === 0) return { ok: false, reason: "not_found" };

  // ── 2. Apply merchant membership filter if merchant viewer.
  if (input.viewer === "merchant") {
    const projectIds = projects.map((p) => p.id);
    const memberships = await supabaseAdmin
      .from("hammerex_sitebook_members")
      .select("project_id")
      .in("project_id", projectIds)
      .eq("listing_id", input.viewerId)
      .neq("status", "declined");
    const okIds = new Set((memberships.data ?? []).map((m) => String(m.project_id)));
    projects = projects.filter((p) => okIds.has(String(p.id)));
    if (projects.length === 0) return { ok: false, reason: "not_yours" };
  }

  // ── 3. Group by derived property_id.
  const byPropId = new Map<string, ProjectRow[]>();
  for (const p of projects) {
    const propId = derivePropertyId(String(p.homeowner_id), p.address_postcode, p.address_line);
    const cur = byPropId.get(propId) ?? [];
    cur.push(p);
    byPropId.set(propId, cur);
  }

  if (byPropId.size > 1) {
    // Ambiguous — surface the top matches so the caller can ask.
    const homeownerIds = Array.from(new Set(Array.from(byPropId.values()).flat().map((p) => String(p.homeowner_id))));
    const nameMap = await loadHomeownerNames(homeownerIds);
    const matches: PropertyRef[] = Array.from(byPropId.entries()).slice(0, MAX_MATCHES).map(([propId, rows]) => {
      const first = rows.sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
      return propRef(propId, first, nameMap.get(String(first.homeowner_id)) ?? null);
    });
    return { ok: false, reason: "ambiguous", matches };
  }

  const [propId, rows] = Array.from(byPropId.entries())[0];
  const first = rows.sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  const nameMap = await loadHomeownerNames([String(first.homeowner_id)]);
  const property = propRef(propId, first, nameMap.get(String(first.homeowner_id)) ?? null);
  return { ok: true, property, project_ids: rows.map((r) => String(r.id)) };
}

async function loadHomeownerNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const r = await supabaseAdmin
    .from("hammerex_homeowners")
    .select("id, first_name, last_name, house_nickname")
    .in("id", ids);
  const out = new Map<string, string>();
  for (const row of r.data ?? []) {
    const name = String(row.first_name ?? "") + " " + String(row.last_name ?? "").trim();
    out.set(String(row.id), name.trim().length > 0 ? name.trim() : String(row.house_nickname ?? ""));
  }
  return out;
}

function propRef(propId: string, first: ProjectRow, homeownerName: string | null): PropertyRef {
  return {
    property_id:      propId,
    homeowner_id:     String(first.homeowner_id),
    homeowner_name:   homeownerName,
    address_line:     (first.address_line as string | null) ?? null,
    address_postcode: (first.address_postcode as string | null) ?? null,
    address_city:     (first.address_city as string | null) ?? null,
    first_seen_at:    first.created_at
  };
}
