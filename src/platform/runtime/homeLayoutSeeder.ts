// Platform Runtime — home page layout seeder.
//
// Writes a pack-declared starter layout to studio_layouts for the
// merchant's home page (draft status, default breakpoint).
//
// PRESERVATION-ORIENTED: skips seeding if the merchant already has
// ANY layout row (draft or published) for their home page. Merchants
// who have started editing keep their work; reinstalling a pack never
// wipes their layout.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import {
  studioId,
  type SectionInstance,
  type StudioLayoutJson
} from "@/lib/studio/schema";
import type { PackHomeLayoutSeed } from "@/platform/packs/types";

export type HomeLayoutSeedResult =
  | { kind: "seeded"; sections: number; rows: number }
  | { kind: "skipped-existing" }
  | { kind: "skipped-empty-seed" }
  | { kind: "error"; reason: string };

export async function seedHomeLayout(args: {
  merchantId: string;
  brandId: string;
  seed: PackHomeLayoutSeed;
}): Promise<HomeLayoutSeedResult> {
  if (args.seed.sections.length === 0) {
    return { kind: "skipped-empty-seed" };
  }

  // Preservation gate: any existing home layout row (draft OR
  // published, any breakpoint) means the merchant has started here.
  // Do NOT overwrite.
  const existing = await supabaseAdmin
    .from("studio_layouts")
    .select("id")
    .eq("merchant_id", args.merchantId)
    .eq("brand_id", args.brandId)
    .eq("page_id", "home")
    .limit(1)
    .maybeSingle();
  if (existing.data) {
    return { kind: "skipped-existing" };
  }

  // Build the layout. Every section gets its own row (single-column
  // layout) — merchants can drag into multi-column rows later.
  const sections: SectionInstance[] = [];
  const rows: { id: string; columns: string[] }[] = [];

  for (const seedSection of args.seed.sections) {
    const reg = sectionRegistry.get(seedSection.key);
    if (!reg) {
      // Unknown section — skip silently. Pack manifests shouldn't
      // reference unregistered sections, but if they do the install
      // still succeeds with fewer sections rather than aborting.
      continue;
    }
    const instanceId = studioId("sec");
    const config = {
      ...reg.defaultConfig(),
      ...(seedSection.config ?? {})
    };
    sections.push({ instanceId, key: seedSection.key, config });
    rows.push({ id: studioId("row"), columns: [instanceId] });
  }

  if (sections.length === 0) {
    return { kind: "skipped-empty-seed" };
  }

  const layoutJson: StudioLayoutJson = { sections, rows };

  const ins = await supabaseAdmin.from("studio_layouts").insert({
    merchant_id: args.merchantId,
    brand_id: args.brandId,
    page_id: "home",
    breakpoint: "default",
    layout_json: layoutJson,
    status: "draft",
    version: 1
  });

  if (ins.error) {
    return { kind: "error", reason: ins.error.message };
  }

  return { kind: "seeded", sections: sections.length, rows: rows.length };
}
