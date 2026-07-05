// Blueprint install.
//
//   POST /api/studio/blueprints/[id]/install
//     Body: { pageId?: string, force?: boolean }
//     → { ok, installedPages: string[] }
//
// Content-Preserving Swap v1: writes the blueprint's layout as a NEW
// draft revision for each page in the manifest. Never touches the
// published row. Merchant-specific content preservation lands in
// Lane 3 (draft-merge across smartSwap); v1 sets a fresh draft and
// stashes the previous draft's sections into layout_json.stash[] so
// nothing is lost on rollback.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { blueprintRegistry } from "@/lib/studio/blueprints";
import type { BlueprintSectionSeed } from "@/lib/studio/blueprints";
import { buildLayoutFromSeeds } from "@/lib/studio/blueprints/buildLayout";

export const runtime = "nodejs";

type PostBody = { pageId?: string; force?: boolean };

type ExistingLayoutRow = {
  id: string;
  layout_json: Record<string, unknown>;
  version: number;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  const { id } = await ctx.params;
  const manifest = blueprintRegistry.get(id);
  if (!manifest) {
    return NextResponse.json(
      { ok: false, error: "not-found" },
      { status: 404 }
    );
  }

  let body: PostBody = {};
  try {
    body = (await req.json()) as PostBody;
  } catch {
    // empty body is fine — install everything
  }

  // Pages to install: either the single pageId the caller asked for,
  // or all pages defined in the manifest.
  const pageIds = body.pageId
    ? [body.pageId]
    : (Object.keys(manifest.layout) as string[]);

  const installedPages: string[] = [];

  for (const pageId of pageIds) {
    const sections =
      (manifest.layout as Record<string, BlueprintSectionSeed[]>)[pageId];
    if (!sections || sections.length === 0) continue;

    // Look up the merchant's current draft (if any)
    const existingRes = await supabaseAdmin
      .from("studio_layouts")
      .select("id, layout_json, version")
      .eq("brand_id", session.brand.id)
      .eq("page_id", pageId)
      .eq("status", "draft")
      .maybeSingle();
    const existing = existingRes.data as ExistingLayoutRow | null;

    const nextLayoutJson = await buildLayoutJson(sections, existing, {
      heroPool: pageId === "home" ? manifest.heroPool : undefined,
      assetContext: {
        industry: manifest.trades[0],
        style: manifest.variant,
        seed: `install:${session.brand.id}:${manifest.slug}`
      }
    });

    if (existing) {
      const upd = await supabaseAdmin
        .from("studio_layouts")
        .update({
          layout_json: nextLayoutJson,
          version: existing.version + 1,
          blueprint_id: manifest.slug,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);
      if (upd.error) {
        return NextResponse.json(
          { ok: false, error: upd.error.message, pageId },
          { status: 500 }
        );
      }
    } else {
      const ins = await supabaseAdmin.from("studio_layouts").insert({
        merchant_id: session.merchant.id,
        brand_id: session.brand.id,
        page_id: pageId,
        breakpoint: "default",
        layout_json: nextLayoutJson,
        status: "draft",
        version: 1,
        blueprint_id: manifest.slug
      });
      if (ins.error) {
        return NextResponse.json(
          { ok: false, error: ins.error.message, pageId },
          { status: 500 }
        );
      }
    }

    installedPages.push(pageId);
  }

  // Record install history
  const insertInstall = await supabaseAdmin
    .from("studio_blueprint_installs")
    .insert({
      brand_id: session.brand.id,
      blueprint_id: manifest.slug,
      design_variant: manifest.variant
    });
  if (insertInstall.error) {
    // Non-fatal — layout writes succeeded
    console.error("blueprint install history write failed", insertInstall.error);
  }

  return NextResponse.json({ ok: true, installedPages });
}

// Content-preserving stash builder.
//
// v1 replaces the draft's sections wholesale, but stashes anything the
// merchant had before so they can restore individual items. Lane 3
// upgrades this to per-role smart swap.
async function buildLayoutJson(
  seeds: BlueprintSectionSeed[],
  existing: ExistingLayoutRow | null,
  options: Parameters<typeof buildLayoutFromSeeds>[1] = {}
): Promise<Record<string, unknown>> {
  const built = await buildLayoutFromSeeds(seeds, options);

  const prevStash: unknown[] = [];
  if (existing) {
    const prevJson = existing.layout_json ?? {};
    const prevSections =
      ((prevJson as { sections?: unknown }).sections as unknown[]) ?? [];
    const existingStash =
      ((prevJson as { stash?: unknown }).stash as unknown[]) ?? [];
    prevStash.push(...prevSections, ...existingStash);
  }

  return {
    sections: built.sections,
    rows: built.rows,
    stash: prevStash
  };
}
