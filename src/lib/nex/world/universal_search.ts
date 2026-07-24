// Universal search — one query, every entity kind.
//
// Runs cross-source text search. Permission model still applies —
// each source table's own permission gate holds (a merchant sees
// their own listings; a homeowner sees their own projects).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type UniversalSearchHit } from "./types";

export type UniversalSearchInput = {
  query:          string;
  merchantSlug?:  string;
  limit?:         number;
};

export async function universalSearch(opts: UniversalSearchInput): Promise<UniversalSearchHit[]> {
  const q = opts.query.trim();
  if (!q) return [];
  const limit = opts.limit ?? 20;

  const evidence = evidenceFor("universal search across 5 entity kinds", ["hammerex_sitebook_projects", "app_crm_contacts", "hammerex_xrated_products", "hammerex_sitebook_photos", "hammerex_sitebook_costs"]);

  const [projects, contacts, products, photos, costs] = await Promise.all([
    supabaseAdmin
      .from("hammerex_sitebook_projects")
      .select("id, title, description")
      .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(limit),
    supabaseAdmin
      .from("app_crm_contacts")
      .select("id, display_name, postcode")
      .ilike("display_name", `%${q}%`)
      .limit(limit),
    supabaseAdmin
      .from("hammerex_xrated_products")
      .select("id, name, description")
      .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(limit),
    supabaseAdmin
      .from("hammerex_sitebook_photos")
      .select("id, caption")
      .ilike("caption", `%${q}%`)
      .limit(limit),
    supabaseAdmin
      .from("hammerex_sitebook_costs")
      .select("id, description")
      .ilike("description", `%${q}%`)
      .limit(limit)
  ]);

  const hits: UniversalSearchHit[] = [];

  for (const p of projects.data ?? []) {
    hits.push({
      entity:   { kind: "project", id: String(p.id), label: String(p.title) },
      matched:  "project.title/description",
      snippet:  `${String(p.title)} — ${String(p.description ?? "").slice(0, 80)}`,
      evidence
    });
  }
  for (const c of contacts.data ?? []) {
    hits.push({
      entity:   { kind: "customer", id: String(c.id), label: String(c.display_name) },
      matched:  "contact.display_name",
      snippet:  String(c.display_name) + (c.postcode ? ` · ${c.postcode}` : ""),
      evidence
    });
  }
  for (const p of products.data ?? []) {
    hits.push({
      entity:   { kind: "product", id: String(p.id), label: String(p.name) },
      matched:  "product.name/description",
      snippet:  `${String(p.name)} — ${String(p.description ?? "").slice(0, 80)}`,
      evidence
    });
  }
  for (const ph of photos.data ?? []) {
    hits.push({
      entity:   { kind: "photo", id: String(ph.id), label: String(ph.caption ?? "Photo") },
      matched:  "photo.caption",
      snippet:  String(ph.caption ?? ""),
      evidence
    });
  }
  for (const c of costs.data ?? []) {
    hits.push({
      entity:   { kind: "cost", id: String(c.id), label: String(c.description ?? "cost") },
      matched:  "cost.description",
      snippet:  String(c.description ?? ""),
      evidence
    });
  }

  return hits.slice(0, limit);
}
