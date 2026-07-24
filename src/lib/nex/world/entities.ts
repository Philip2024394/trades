// Entity resolver + relationship builder.
//
// For any (kind, id) fetch a small entity ref + its immediate
// relationships. Traversal depth is bounded so a "show me everything
// connected to X" call doesn't chain across the whole platform.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type EntityCloud, type EntityKind, type EntityRef, type Relationship } from "./types";

export type LoadEntityInput = {
  kind:   EntityKind;
  id:     string;
  /** Maximum relationship-depth to walk. Default 1 (immediate neighbours). */
  depth?: number;
};

export async function loadEntityCloud(input: LoadEntityInput): Promise<EntityCloud | null> {
  const evidence = evidenceFor(`world entity cloud for ${input.kind}`, []);

  const root = await resolveRoot(input.kind, input.id);
  if (!root) return null;

  const entities:      EntityRef[]    = [root];
  const relationships: Relationship[] = [];
  const seen           = new Set<string>([`${root.kind}:${root.id}`]);

  const depth = input.depth ?? 1;
  const queue: EntityRef[] = [root];

  for (let level = 0; level < depth; level++) {
    const next: EntityRef[] = [];
    for (const node of queue) {
      const neighbours = await loadNeighbours(node);
      for (const r of neighbours) {
        relationships.push(r);
        const oppositeKey = `${r.to.kind}:${r.to.id}`;
        if (!seen.has(oppositeKey)) {
          seen.add(oppositeKey);
          entities.push(r.to);
          next.push(r.to);
        }
      }
    }
    if (next.length === 0) break;
    queue.length = 0;
    queue.push(...next);
  }

  return { root, entities, relationships, evidence };
}

async function resolveRoot(kind: EntityKind, id: string): Promise<EntityRef | null> {
  switch (kind) {
    case "customer": {
      const r = await supabaseAdmin.from("app_crm_contacts").select("id, display_name").eq("id", id).maybeSingle();
      if (!r.data) return null;
      return { kind, id: String(r.data.id), label: String(r.data.display_name) };
    }
    case "project": {
      const r = await supabaseAdmin.from("hammerex_sitebook_projects").select("id, title").eq("id", id).maybeSingle();
      if (!r.data) return null;
      return { kind, id: String(r.data.id), label: String(r.data.title) };
    }
    case "quote": {
      const r = await supabaseAdmin.from("app_quote_workspace_quotes").select("id, title").eq("id", id).maybeSingle();
      if (!r.data) return null;
      return { kind, id: String(r.data.id), label: String(r.data.title) };
    }
    case "job": {
      const r = await supabaseAdmin.from("app_job_diary_jobs").select("id, title").eq("id", id).maybeSingle();
      if (!r.data) return null;
      return { kind, id: String(r.data.id), label: String(r.data.title) };
    }
    case "cost": {
      const r = await supabaseAdmin.from("hammerex_sitebook_costs").select("id, description").eq("id", id).maybeSingle();
      if (!r.data) return null;
      return { kind, id: String(r.data.id), label: String(r.data.description ?? "(cost)") };
    }
    case "photo": {
      const r = await supabaseAdmin.from("hammerex_sitebook_photos").select("id, caption").eq("id", id).maybeSingle();
      if (!r.data) return null;
      return { kind, id: String(r.data.id), label: String(r.data.caption ?? "Photo") };
    }
    case "product": {
      const r = await supabaseAdmin.from("hammerex_xrated_products").select("id, name").eq("id", id).maybeSingle();
      if (!r.data) return null;
      return { kind, id: String(r.data.id), label: String(r.data.name) };
    }
    case "review": {
      const r = await supabaseAdmin.from("hammerex_network_reviews").select("id, reviewer_display_name, body").eq("id", id).maybeSingle();
      if (!r.data) return null;
      return { kind, id: String(r.data.id), label: `Review by ${String(r.data.reviewer_display_name)}` };
    }
    case "merchant": {
      const r = await supabaseAdmin.from("hammerex_trade_off_listings").select("id, display_name").eq("id", id).maybeSingle();
      if (!r.data) return null;
      return { kind, id: String(r.data.id), label: String(r.data.display_name) };
    }
    case "supplier":
    case "property":
      // Supplier + property don't have canonical tables today —
      // callers use their derived ids (Phase 16 / Phase 9).
      return { kind, id, label: kind };
  }
}

async function loadNeighbours(node: EntityRef): Promise<Relationship[]> {
  const evidence = evidenceFor("world entity neighbours", []);
  const out: Relationship[] = [];

  switch (node.kind) {
    case "customer": {
      // Customer → projects (via app_quote_workspace_quotes.homeowner_party_id) is complex.
      // For a first pass we surface projects via CRM contact's activity trail (Phase 8) — omitted here.
      break;
    }
    case "project": {
      // project → costs
      const costs = await supabaseAdmin
        .from("hammerex_sitebook_costs")
        .select("id, description")
        .eq("project_id", node.id)
        .limit(20);
      for (const r of costs.data ?? []) {
        out.push({
          from: node,
          to:   { kind: "cost", id: String(r.id), label: String(r.description ?? "cost") },
          kind: "belongs_to",
          evidence
        });
      }
      // project → photos
      const photos = await supabaseAdmin
        .from("hammerex_sitebook_photos")
        .select("id, caption")
        .eq("project_id", node.id)
        .limit(20);
      for (const r of photos.data ?? []) {
        out.push({
          from: node,
          to:   { kind: "photo", id: String(r.id), label: String(r.caption ?? "Photo") },
          kind: "captured_on",
          evidence
        });
      }
      // project → job diary jobs
      const jobs = await supabaseAdmin
        .from("app_job_diary_jobs")
        .select("id, title")
        .eq("project_id", node.id)
        .limit(20);
      for (const r of jobs.data ?? []) {
        out.push({
          from: node,
          to:   { kind: "job", id: String(r.id), label: String(r.title) },
          kind: "sits_on",
          evidence
        });
      }
      break;
    }
    case "quote": {
      const r = await supabaseAdmin
        .from("app_quote_workspace_quotes")
        .select("project_id")
        .eq("id", node.id)
        .maybeSingle();
      if (r.data?.project_id) {
        const proj = await supabaseAdmin.from("hammerex_sitebook_projects").select("title").eq("id", r.data.project_id).maybeSingle();
        if (proj.data) {
          out.push({
            from: node,
            to:   { kind: "project", id: String(r.data.project_id), label: String(proj.data.title) },
            kind: "priced_in",
            evidence
          });
        }
      }
      break;
    }
    default:
      break;
  }

  return out;
}
