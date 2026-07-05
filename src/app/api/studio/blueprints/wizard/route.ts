// Blueprint wizard — persists the 5-step answers.
//
//   POST /api/studio/blueprints/wizard
//     Body: {
//       primaryOutcome: OutcomeSlug,
//       secondaryOutcomes?: OutcomeSlug[],
//       coveragePostcode?: string,
//       coverageRadiusMi?: number
//     }
//     → { ok, ranked: [...top 6 blueprint slugs by rank score] }
//
// Writes to studio_brand_outcomes (upsert by brand_id) then returns
// the recommender output so the wizard can jump the merchant straight
// to the top-ranked blueprint's preview.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  blueprintRegistry,
  OUTCOME_SLUGS
} from "@/lib/studio/blueprints";
import { peerPopularityByBlueprint } from "@/lib/studio/blueprints/peerPopularity";
import type { CredentialScheme, OutcomeSlug } from "@/lib/studio/blueprints";

export const runtime = "nodejs";

type PostBody = {
  primaryOutcome?: string;
  secondaryOutcomes?: string[];
  coveragePostcode?: string | null;
  coverageRadiusMi?: number | null;
};

type CredentialsRow = { scheme: string; status: string };

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }

  if (!body.primaryOutcome || !isOutcome(body.primaryOutcome)) {
    return NextResponse.json(
      { ok: false, error: "primary-outcome-required" },
      { status: 400 }
    );
  }
  const primary = body.primaryOutcome;
  const secondary = (body.secondaryOutcomes ?? []).filter(isOutcome);

  const upsert = await supabaseAdmin
    .from("studio_brand_outcomes")
    .upsert(
      {
        brand_id: session.brand.id,
        primary_outcome: primary,
        secondary_outcomes: secondary,
        coverage_postcode: body.coveragePostcode ?? null,
        coverage_radius_mi: body.coverageRadiusMi ?? null,
        answered_wizard_at: new Date().toISOString()
      },
      { onConflict: "brand_id" }
    );
  if (upsert.error) {
    return NextResponse.json(
      { ok: false, error: upsert.error.message },
      { status: 500 }
    );
  }

  const credsRes = await supabaseAdmin
    .from("studio_brand_credentials")
    .select("scheme, status")
    .eq("brand_id", session.brand.id)
    .eq("status", "verified");
  const heldCredentials = ((credsRes.data ?? []) as CredentialsRow[])
    .map((r) => r.scheme as CredentialScheme);

  const peerPopularity = await peerPopularityByBlueprint();

  const ranked = blueprintRegistry
    .rank({
      merchantTradeSlug: session.merchant.primary_trade,
      wizardOutcomes: [primary, ...secondary],
      heldCredentials,
      peerPopularity
    })
    .slice(0, 6);

  return NextResponse.json({
    ok: true,
    ranked: ranked.map((r) => ({
      slug: r.manifest.slug,
      name: r.manifest.name,
      tagline: r.manifest.tagline,
      score: r.manifest.score,
      variant: r.manifest.variant,
      rankScore: r.score,
      rankReasons: r.reasons,
      browserCard: r.manifest.browserCard
    }))
  });
}

function isOutcome(v: string): v is OutcomeSlug {
  return (OUTCOME_SLUGS as readonly string[]).includes(v);
}
