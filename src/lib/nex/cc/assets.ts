// Asset inventory — the "things installed at this property" list.
//
// Sources we lean on:
//   • hammerex_sitebook_home_care_items — the homeowner's care register
//     (title, cadence, next_due_at, previous_trade_listing_id, notes).
//   • hammerex_sitebook_costs — cost lines with kind='materials' or
//     'supplier' that hint at what was installed.
//
// Assets are BEST-EFFORT: we tag them from the title text. When Trade
// OS gets a dedicated os_assets table, swap the source here.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type AssetItem, type AssetKind } from "./types";

const KIND_RULES: Array<{ re: RegExp; kind: AssetKind }> = [
  { re: /\bboiler\b/i,                    kind: "boiler" },
  { re: /\broof|slate|tile|felt\b/i,      kind: "roof" },
  { re: /\bkitchen\b/i,                   kind: "kitchen" },
  { re: /\bbathroom|shower|bath\b/i,      kind: "bathroom" },
  { re: /\bwindow|glaz\b/i,               kind: "windows" },
  { re: /\bdoor\b/i,                      kind: "doors" },
  { re: /\bfloor|flooring|carpet|wood|tile\b/i, kind: "flooring" },
  { re: /\belect|socket|light|wire\b/i,   kind: "electrical" },
  { re: /\bplumb|pipe|drain\b/i,          kind: "plumbing" },
  { re: /\bheat|radiator|underfloor\b/i,  kind: "heating" },
  { re: /\bsolar|pv|battery\b/i,          kind: "solar" }
];

function tagKind(label: string): AssetKind {
  for (const r of KIND_RULES) if (r.re.test(label)) return r.kind;
  return "other";
}

export type BuildAssetsInput = {
  homeownerId: string;
  projectIds:  string[];
  now?:        Date;
};

export async function buildAssets(opts: BuildAssetsInput): Promise<AssetItem[]> {
  const now = opts.now ?? new Date();
  const evidence = evidenceFor(
    "hammerex_sitebook_home_care_items + hammerex_sitebook_costs",
    ["hammerex_sitebook_home_care_items", "hammerex_sitebook_costs"]
  );

  const [careRows, costRows] = await Promise.all([
    supabaseAdmin
      .from("hammerex_sitebook_home_care_items")
      .select("title, next_due_at, cadence_days, last_done_at, previous_trade_listing_id, previous_trade_name")
      .eq("homeowner_id", opts.homeownerId),
    opts.projectIds.length > 0
      ? supabaseAdmin
          .from("hammerex_sitebook_costs")
          .select("description, kind, trade_name, created_at")
          .in("project_id", opts.projectIds)
          .in("kind", ["materials", "supplier"])
      : Promise.resolve({ data: [] })
  ]);

  const items: AssetItem[] = [];
  const seen = new Set<string>();

  // ── Care items become primary asset entries (they carry warranty
  //    + cadence + next due).
  for (const r of careRows.data ?? []) {
    const title = String(r.title ?? "");
    if (!title) continue;
    const kind = tagKind(title);
    const key  = `care:${kind}:${title.toLowerCase().slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      key,
      kind,
      label:             title,
      installed_at:      (r.last_done_at as string | null) ?? null,
      trade_name:        (r.previous_trade_name as string | null) ?? null,
      supplier:          null,
      warranty_expires_at: null,      // no explicit column yet; would derive from care cadence + years
      next_maintenance_at: (r.next_due_at as string | null) ?? null,
      cadence_days:      typeof r.cadence_days === "number" ? (r.cadence_days as number) : null,
      evidence
    });
  }

  // ── Cost lines add material/product asset hints.
  for (const r of costRows.data ?? []) {
    const desc = String(r.description ?? "").trim();
    if (!desc || desc.length < 3) continue;
    const kind = tagKind(desc);
    const key  = `cost:${kind}:${desc.toLowerCase().slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      key,
      kind,
      label:               desc,
      installed_at:        (r.created_at as string | null) ?? null,
      trade_name:          (r.trade_name as string | null) ?? null,
      supplier:            r.kind === "supplier" ? (r.trade_name as string | null) ?? null : null,
      warranty_expires_at: null,
      next_maintenance_at: null,
      cadence_days:        null,
      evidence
    });
  }

  // Sort — most recently installed first, "other" kind last.
  items.sort((a, b) => {
    if (a.kind === "other" && b.kind !== "other") return 1;
    if (b.kind === "other" && a.kind !== "other") return -1;
    const at = a.installed_at ?? "";
    const bt = b.installed_at ?? "";
    return bt.localeCompare(at);
  });
  void now;
  return items;
}
