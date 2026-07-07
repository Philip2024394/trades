// POST /api/apps/ai-visualiser/classify
//
// Given a source image + a merchant id, returns whether the photo is
// in-scope for anything the merchant sells. If yes — returns the best
// leaf slug to steer the design tree. If no — returns detected leaf
// so the UI can offer marketplace routing.
//
// Runs BEFORE any credit is consumed.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveActiveProvider } from "@/lib/ai-visualiser/providers/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONFIDENCE_ACCEPT = 0.55;

type ClassifyPayload = {
  merchantId?: unknown;
  imageUrl?: unknown;
};

export async function POST(req: NextRequest) {
  let body: ClassifyPayload;
  try {
    body = (await req.json()) as ClassifyPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const merchantId =
    typeof body.merchantId === "string" ? body.merchantId.trim() : "";
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  if (!merchantId || !imageUrl) {
    return NextResponse.json(
      { ok: false, error: "merchantId and imageUrl are required." },
      { status: 400 }
    );
  }

  // Load merchant scope + join to taxonomy for classifier prompts
  const { data: scopeRows, error: scopeErr } = await supabaseAdmin
    .from("app_ai_visualiser_catalogue_scope")
    .select("leaf_slug, ai_visualiser_taxonomy_leaves!inner(slug, display_name, classifier_prompts)")
    .eq("merchant_id", merchantId)
    .eq("is_enabled", true);

  if (scopeErr) {
    console.error("[ai-visualiser] scope load error", scopeErr);
    return NextResponse.json(
      { ok: false, error: "Could not load merchant scope." },
      { status: 500 }
    );
  }

  type LeafJoin = {
    slug: string;
    display_name: string;
    classifier_prompts: string[];
  };
  const scope = (scopeRows || []).map((r) => {
    const rawLeaf = (
      r as unknown as {
        ai_visualiser_taxonomy_leaves?: LeafJoin | LeafJoin[];
      }
    ).ai_visualiser_taxonomy_leaves;
    const leaf: LeafJoin | undefined = Array.isArray(rawLeaf)
      ? rawLeaf[0]
      : rawLeaf;
    return {
      leafSlug: r.leaf_slug as string,
      displayName: leaf?.display_name ?? r.leaf_slug,
      prompts: leaf?.classifier_prompts ?? []
    };
  });

  if (scope.length === 0) {
    return NextResponse.json({
      ok: true,
      inScope: false,
      reason: "no-scope"
    });
  }

  const candidatePrompts = scope.flatMap((s) =>
    s.prompts.map((p) => ({ leafSlug: s.leafSlug, prompt: p }))
  );

  // Also load a small set of common OFF-scope leaves so we can offer
  // marketplace routing when confidence in an in-scope match is low.
  const { data: allLeaves } = await supabaseAdmin
    .from("ai_visualiser_taxonomy_leaves")
    .select("slug, display_name, classifier_prompts")
    .eq("is_active", true);

  const offScopePrompts =
    (allLeaves || [])
      .filter((l) => !scope.some((s) => s.leafSlug === l.slug))
      .flatMap((l) =>
        (l.classifier_prompts || []).slice(0, 2).map((p: string) => ({
          leafSlug: l.slug as string,
          prompt: p
        }))
      );

  const { provider, isLive } = await resolveActiveProvider();

  const result = await provider
    .classify({
      imageUrl,
      candidatePrompts: [...candidatePrompts, ...offScopePrompts]
    })
    .catch((err) => {
      console.error("[ai-visualiser] classify failed", err);
      return null;
    });

  if (!result) {
    // Provider error — fail OPEN so we don't block real customers over
    // a transient outage. In-scope with unknown leaf. The merchant can
    // still choose a leaf manually in the design tree.
    return NextResponse.json({
      ok: true,
      inScope: true,
      leafSlug: scope[0].leafSlug,
      confidence: 0,
      liveClassifier: isLive,
      degraded: true
    });
  }

  const inScopeSlugs = new Set(scope.map((s) => s.leafSlug));
  const bestInScope =
    result.bestLeafSlug && inScopeSlugs.has(result.bestLeafSlug)
      ? result.bestLeafSlug
      : null;

  if (bestInScope && result.confidence >= CONFIDENCE_ACCEPT) {
    return NextResponse.json({
      ok: true,
      inScope: true,
      leafSlug: bestInScope,
      confidence: result.confidence,
      liveClassifier: isLive
    });
  }

  // Off-scope path — capture routed-lead intent
  if (result.bestLeafSlug && !inScopeSlugs.has(result.bestLeafSlug)) {
    return NextResponse.json({
      ok: true,
      inScope: false,
      detectedLeafSlug: result.bestLeafSlug,
      confidence: result.confidence,
      liveClassifier: isLive
    });
  }

  return NextResponse.json({
    ok: true,
    inScope: false,
    reason: "low-confidence",
    confidence: result.confidence,
    liveClassifier: isLive
  });
}
