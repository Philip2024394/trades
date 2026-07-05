// Publish-Live — the "60-second moment".
//
//   POST /api/studio/publish-live
//     Body: {
//       blueprintSlug: string,      // which blueprint to install
//       desiredSlug?: string        // optional new URL slug for the merchant
//     }
//     → { ok, liveUrl, slug, publishedPages }
//
// Atomic per-merchant flow:
//   1. If desiredSlug set + differs from current, validate + reserve it
//      atomically on hammerex_trade_off_listings.
//   2. Build the blueprint's layout for every page in the manifest.
//   3. Upsert each page as a draft (Content-Preserving Swap: preserves
//      prior draft's sections into layout_json.stash[]).
//   4. Snapshot each new draft into a versioned published row (matching
//      /api/studio/publish semantics — append-only, incremented version,
//      parent_layout_id link).
//   5. Return the live URL.
//
// Idempotent on retries: if the merchant's current slug already matches
// desiredSlug, step 1 no-ops. If a published version already exists for
// a page, we still write a fresh version (safe — append-only).

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { blueprintRegistry } from "@/lib/studio/blueprints";
import { buildLayoutFromSeeds } from "@/lib/studio/blueprints/buildLayout";
import type { BlueprintSectionSeed } from "@/lib/studio/blueprints";
import { slugifyXrated, validateXratedSlug } from "@/lib/xratedSlug";
import { isReservedSlug } from "@/lib/tradeOff";
import { scorePage } from "@/lib/studio/scoring";
import type { StudioLayoutJson } from "@/lib/studio/schema";

export const runtime = "nodejs";

type PostBody = {
  blueprintSlug?: string;
  desiredSlug?: string;
};

type ExistingLayoutRow = {
  id: string;
  layout_json: Record<string, unknown>;
  version: number;
};

type PublishedRow = { id: string; version: number };

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  let body: PostBody = {};
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }

  const blueprintSlug = body.blueprintSlug;
  if (!blueprintSlug) {
    return NextResponse.json(
      { ok: false, error: "blueprint-slug-required" },
      { status: 400 }
    );
  }
  const manifest = blueprintRegistry.get(blueprintSlug);
  if (!manifest) {
    return NextResponse.json(
      { ok: false, error: "blueprint-not-found" },
      { status: 404 }
    );
  }

  // ─── Step 1 · slug claim (only if different from current) ────
  let finalSlug = session.merchant.slug;
  const requested = body.desiredSlug?.trim().toLowerCase();
  if (requested && requested !== finalSlug) {
    const normalised = slugifyXrated(requested);
    const err = validateXratedSlug(normalised);
    if (err) {
      return NextResponse.json(
        { ok: false, error: "slug-invalid", detail: err },
        { status: 400 }
      );
    }
    if (isReservedSlug(normalised)) {
      return NextResponse.json(
        { ok: false, error: "slug-reserved" },
        { status: 409 }
      );
    }
    // Atomic claim: try to set. Unique index on slug throws on collision.
    const claim = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .update({ slug: normalised })
      .eq("id", session.merchant.id)
      .select("slug")
      .single();
    if (claim.error) {
      // 23505 = unique_violation
      const code =
        (claim.error as { code?: string }).code ?? "";
      if (code === "23505") {
        return NextResponse.json(
          { ok: false, error: "slug-taken" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { ok: false, error: claim.error.message },
        { status: 500 }
      );
    }
    finalSlug = claim.data.slug as string;
  }

  // ─── Step 2 + 3 · install every page draft ────────────────────
  const pageIds = Object.keys(manifest.layout);
  const publishedPages: string[] = [];

  for (const pageId of pageIds) {
    const seeds =
      (manifest.layout as Record<string, BlueprintSectionSeed[]>)[pageId];
    if (!seeds || seeds.length === 0) continue;

    const existingRes = await supabaseAdmin
      .from("studio_layouts")
      .select("id, layout_json, version")
      .eq("brand_id", session.brand.id)
      .eq("page_id", pageId)
      .eq("status", "draft")
      .maybeSingle();
    const existing = existingRes.data as ExistingLayoutRow | null;

    // Only the home page participates in hero rotation — every other
    // page's hero (services, contact, etc.) stays as-authored.
    const built = await buildLayoutFromSeeds(seeds, {
      heroPool: pageId === "home" ? manifest.heroPool : undefined,
      assetContext: {
        industry: manifest.trades[0],
        style: manifest.variant,
        // Real install → per-brand seed so two merchants get different rolls.
        seed: `install:${session.brand.id}:${manifest.slug}`
      }
    });
    const nextJson = mergeStash(built, existing);

    let draftId: string;
    if (existing) {
      const upd = await supabaseAdmin
        .from("studio_layouts")
        .update({
          layout_json: nextJson,
          version: existing.version + 1,
          blueprint_id: manifest.slug,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id)
        .select("id")
        .single();
      if (upd.error || !upd.data) {
        return NextResponse.json(
          { ok: false, error: upd.error?.message ?? "draft-update-failed", pageId },
          { status: 500 }
        );
      }
      draftId = upd.data.id;
    } else {
      const ins = await supabaseAdmin
        .from("studio_layouts")
        .insert({
          merchant_id: session.merchant.id,
          brand_id: session.brand.id,
          page_id: pageId,
          breakpoint: "default",
          layout_json: nextJson,
          status: "draft",
          version: 1,
          blueprint_id: manifest.slug
        })
        .select("id")
        .single();
      if (ins.error || !ins.data) {
        return NextResponse.json(
          { ok: false, error: ins.error?.message ?? "draft-insert-failed", pageId },
          { status: 500 }
        );
      }
      draftId = ins.data.id;
    }

    // ─── Step 4 · snapshot draft → published ─────────────────
    // Append-only: fresh row per publish, incremented version,
    // parent_layout_id chained to previous published version.
    const previousPubRes = await supabaseAdmin
      .from("studio_layouts")
      .select("id, version")
      .eq("brand_id", session.brand.id)
      .eq("page_id", pageId)
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const previousPub = previousPubRes.data as PublishedRow | null;

    const draftJsonRes = await supabaseAdmin
      .from("studio_layouts")
      .select("layout_json")
      .eq("id", draftId)
      .single();
    if (draftJsonRes.error || !draftJsonRes.data) {
      return NextResponse.json(
        { ok: false, error: "draft-fetch-failed", pageId },
        { status: 500 }
      );
    }

    const pub = await supabaseAdmin.from("studio_layouts").insert({
      merchant_id: session.merchant.id,
      brand_id: session.brand.id,
      page_id: pageId,
      breakpoint: "default",
      layout_json: draftJsonRes.data.layout_json,
      status: "published",
      version: (previousPub?.version ?? 0) + 1,
      parent_layout_id: previousPub?.id ?? null,
      blueprint_id: manifest.slug,
      published_at: new Date().toISOString()
    });
    if (pub.error) {
      return NextResponse.json(
        { ok: false, error: pub.error.message, pageId },
        { status: 500 }
      );
    }
    publishedPages.push(pageId);
  }

  // Install history
  await supabaseAdmin
    .from("studio_blueprint_installs")
    .insert({
      brand_id: session.brand.id,
      blueprint_id: manifest.slug,
      design_variant: manifest.variant
    });

  const origin = new URL(req.url).origin;
  const liveUrl = `${origin}/trade/${finalSlug}`;

  // ─── Real metrics for the success reveal ─────────────────────
  // Load every published page + score it. Honest numbers, not
  // fabricated — if the scorer returns 82 for SEO, that's what we
  // show.
  const publishedRes = await supabaseAdmin
    .from("studio_layouts")
    .select("layout_json")
    .eq("brand_id", session.brand.id)
    .eq("status", "published");
  const publishedLayouts = ((publishedRes.data ?? []) as {
    layout_json: unknown;
  }[]).map((r) => r.layout_json as StudioLayoutJson);

  let totalSections = 0;
  const dimensionAverages: Record<string, number[]> = {
    conversion: [],
    seo: [],
    trust: [],
    mobile: [],
    accessibility: [],
    speed: [],
    brandConsistency: []
  };
  for (const layout of publishedLayouts) {
    totalSections += layout?.sections?.length ?? 0;
    if (!layout?.sections) continue;
    try {
      const result = scorePage(layout);
      // scorePage returns loading/accessibility/sales/seo/mobile/
      // brandConsistency. Map to the manifest's score labels for the
      // success reveal.
      dimensionAverages.seo.push(result.dimensions.seo);
      dimensionAverages.accessibility.push(result.dimensions.accessibility);
      dimensionAverages.mobile.push(result.dimensions.mobile);
      dimensionAverages.speed.push(result.dimensions.loading);
      dimensionAverages.conversion.push(result.dimensions.sales);
      dimensionAverages.brandConsistency.push(
        result.dimensions.brandConsistency
      );
    } catch {
      // one bad page shouldn't kill the metric summary
    }
  }
  const avg = (xs: number[]) =>
    xs.length === 0
      ? 0
      : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

  const metrics = {
    pageCount: publishedLayouts.length,
    sectionCount: totalSections,
    // From the manifest — those are its design targets. Real page-
    // score averages sit alongside for honesty.
    manifestTargets: {
      conversion: manifest.score.conversion,
      seo: manifest.score.seo,
      trust: manifest.score.trust,
      mobile: manifest.score.mobile,
      accessibility: manifest.score.accessibility,
      speed: manifest.score.speed
    },
    liveScores: {
      seo: avg(dimensionAverages.seo),
      accessibility: avg(dimensionAverages.accessibility),
      mobile: avg(dimensionAverages.mobile),
      speed: avg(dimensionAverages.speed),
      conversion: avg(dimensionAverages.conversion),
      brandConsistency: avg(dimensionAverages.brandConsistency)
    }
  };

  return NextResponse.json({
    ok: true,
    slug: finalSlug,
    liveUrl,
    publishedPages,
    metrics
  });
}

// Content-Preserving Swap · stash-merge (matches install route).
function mergeStash(
  built: { sections: unknown[]; rows: unknown[] },
  existing: ExistingLayoutRow | null
): Record<string, unknown> {
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
