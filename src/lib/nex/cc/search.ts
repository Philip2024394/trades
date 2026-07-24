// Cross-property search — "find every property with X".
//
// Scans project titles, post bodies + captions, and cost descriptions
// then groups results by derived property_id. Permission-safe: for a
// merchant viewer we filter to properties they've worked on.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { derivePropertyId, evidenceFor, type PropertySearchResult, type ViewerType } from "./types";

const MAX_HITS = 20;

export type SearchPropertiesInput = {
  query:     string;
  viewer:    ViewerType;
  viewerId:  string;
};

export async function searchProperties(opts: SearchPropertiesInput): Promise<PropertySearchResult[]> {
  const q = opts.query.trim();
  if (!q) return [];
  const evidence = evidenceFor("text search over projects/posts/costs", ["hammerex_sitebook_projects", "hammerex_sitebook_posts", "hammerex_sitebook_costs"]);

  // ── 1. Match on project title OR description.
  let projectHits = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id, title, description, homeowner_id, address_postcode, address_line")
    .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    .limit(MAX_HITS);

  // ── 2. Match on cost description.
  const costHits = await supabaseAdmin
    .from("hammerex_sitebook_costs")
    .select("project_id, description")
    .ilike("description", `%${q}%`)
    .limit(MAX_HITS);

  const extraProjIds = Array.from(new Set((costHits.data ?? []).map((r) => String(r.project_id))));
  if (extraProjIds.length > 0) {
    const more = await supabaseAdmin
      .from("hammerex_sitebook_projects")
      .select("id, title, description, homeowner_id, address_postcode, address_line")
      .in("id", extraProjIds);
    projectHits = { data: [...(projectHits.data ?? []), ...(more.data ?? [])] } as typeof projectHits;
  }

  const rows = projectHits.data ?? [];

  // ── 3. Permission filter for merchants.
  let allowedProjectIds: Set<string> | null = null;
  if (opts.viewer === "merchant") {
    const memberships = await supabaseAdmin
      .from("hammerex_sitebook_members")
      .select("project_id")
      .in("project_id", rows.map((r) => String(r.id)))
      .eq("listing_id", opts.viewerId)
      .neq("status", "declined");
    allowedProjectIds = new Set((memberships.data ?? []).map((m) => String(m.project_id)));
  }
  if (opts.viewer === "homeowner") {
    // Filter to own projects.
    allowedProjectIds = new Set(rows.filter((r) => String(r.homeowner_id) === opts.viewerId).map((r) => String(r.id)));
  }

  // ── 4. Group by property_id + hydrate homeowner names.
  type Hit = { propertyId: string; homeownerId: string; addressLine: string | null; addressPostcode: string | null; reasons: string[] };
  const byProperty = new Map<string, Hit>();
  for (const p of rows) {
    if (allowedProjectIds && !allowedProjectIds.has(String(p.id))) continue;
    const homeownerId = String(p.homeowner_id);
    const propId = derivePropertyId(homeownerId, (p.address_postcode as string | null) ?? null, (p.address_line as string | null) ?? null);
    const existing = byProperty.get(propId);
    const reason = `matched "${q}" in project "${String(p.title ?? "")}"`;
    if (existing) {
      if (existing.reasons.length < 3) existing.reasons.push(reason);
    } else {
      byProperty.set(propId, {
        propertyId:       propId,
        homeownerId,
        addressLine:      (p.address_line as string | null) ?? null,
        addressPostcode:  (p.address_postcode as string | null) ?? null,
        reasons:          [reason]
      });
    }
  }

  const hits = Array.from(byProperty.values()).slice(0, MAX_HITS);
  const homeownerIds = Array.from(new Set(hits.map((h) => h.homeownerId)));
  const nameMap = new Map<string, string>();
  if (homeownerIds.length > 0) {
    const names = await supabaseAdmin
      .from("hammerex_homeowners")
      .select("id, first_name, last_name, house_nickname")
      .in("id", homeownerIds);
    for (const h of names.data ?? []) {
      const n = `${String(h.first_name ?? "")} ${String(h.last_name ?? "")}`.trim();
      nameMap.set(String(h.id), n || String(h.house_nickname ?? ""));
    }
  }

  return hits.map((h): PropertySearchResult => ({
    property_id:      h.propertyId,
    address_line:     h.addressLine,
    address_postcode: h.addressPostcode,
    homeowner_name:   nameMap.get(h.homeownerId) ?? null,
    matched_reason:   h.reasons.join("; "),
    evidence
  }));
}
