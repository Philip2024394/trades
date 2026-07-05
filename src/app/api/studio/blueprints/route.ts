// Blueprint browser API.
//
//   GET /api/studio/blueprints?trade=<slug>&outcome=<slug>&variant=<v>
//     → { ok, blueprints: [...] }
//
// Session-authenticated. When no filter is supplied, returns the
// merchant-aware ranked list from the recommender. When filters ARE
// supplied, applies filters before ranking.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  blueprintRegistry,
  DESIGN_VARIANTS,
  OUTCOME_SLUGS
} from "@/lib/studio/blueprints";
import { coldStartOutcomes } from "@/lib/studio/blueprints/coldStart";
import { peerPopularityByBlueprint } from "@/lib/studio/blueprints/peerPopularity";
import type {
  CredentialScheme,
  DesignVariant,
  OutcomeSlug
} from "@/lib/studio/blueprints";

export const runtime = "nodejs";

type OutcomesRow = {
  primary_outcome: string;
  secondary_outcomes: string[];
};

type CredentialsRow = { scheme: string; status: string };

export async function GET(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const filterTrade = url.searchParams.get("trade") ?? undefined;
  const filterOutcome = url.searchParams.get("outcome") ?? undefined;
  const filterVariant = url.searchParams.get("variant") ?? undefined;

  const outcomesRes = await supabaseAdmin
    .from("studio_brand_outcomes")
    .select("primary_outcome, secondary_outcomes")
    .eq("brand_id", session.brand.id)
    .maybeSingle();
  const outcomesRow = outcomesRes.data as OutcomesRow | null;

  const credsRes = await supabaseAdmin
    .from("studio_brand_credentials")
    .select("scheme, status")
    .eq("brand_id", session.brand.id)
    .eq("status", "verified");
  const heldCredentials = ((credsRes.data ?? []) as CredentialsRow[])
    .map((r) => r.scheme as CredentialScheme);

  let wizardOutcomes: OutcomeSlug[] = [];
  if (outcomesRow) {
    if (isOutcome(outcomesRow.primary_outcome)) {
      wizardOutcomes.push(outcomesRow.primary_outcome);
    }
    for (const s of outcomesRow.secondary_outcomes ?? []) {
      if (isOutcome(s)) wizardOutcomes.push(s);
    }
  }
  // Cold-start: if the merchant hasn't answered the wizard we still
  // want a sensible rank. Trade-specific defaults keep the top slot
  // relevant instead of showing whatever the recency signal picks.
  if (wizardOutcomes.length === 0) {
    wizardOutcomes = coldStartOutcomes(session.merchant.primary_trade);
  }

  const peerPopularity = await peerPopularityByBlueprint();

  let ranked = blueprintRegistry.rank({
    merchantTradeSlug: session.merchant.primary_trade,
    wizardOutcomes,
    heldCredentials,
    peerPopularity
  });

  if (filterTrade) {
    ranked = ranked.filter((r) => r.manifest.trades.includes(filterTrade));
  }
  if (filterOutcome && isOutcome(filterOutcome)) {
    ranked = ranked.filter((r) =>
      r.manifest.outcomes.includes(filterOutcome)
    );
  }
  if (filterVariant && isVariant(filterVariant)) {
    ranked = ranked.filter((r) => r.manifest.variant === filterVariant);
  }

  return NextResponse.json({
    ok: true,
    blueprints: ranked.map((r) => ({
      slug: r.manifest.slug,
      name: r.manifest.name,
      tagline: r.manifest.tagline,
      description: r.manifest.description,
      trades: r.manifest.trades,
      outcomes: r.manifest.outcomes,
      variant: r.manifest.variant,
      score: r.manifest.score,
      requiredCredentials: r.manifest.requiredCredentials ?? [],
      suggestedApps: r.manifest.suggestedApps,
      browserCard: r.manifest.browserCard,
      rankScore: r.score,
      rankReasons: r.reasons
    }))
  });
}

function isOutcome(v: string): v is OutcomeSlug {
  return (OUTCOME_SLUGS as readonly string[]).includes(v);
}
function isVariant(v: string): v is DesignVariant {
  return (DESIGN_VARIANTS as readonly string[]).includes(v);
}
