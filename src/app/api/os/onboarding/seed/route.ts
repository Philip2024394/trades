// POST /api/os/onboarding/seed — merchant kicks off the sample seed.
// Records funnel events at each step.
import { NextResponse } from "next/server";
import {
  requireMerchantSession,
  MerchantNotAuthenticatedError
} from "@/lib/os/merchantSession";
import { seedMerchant } from "@/lib/os/pilot/seedMerchant";
import {
  findOrCreateParticipant,
  recordFunnelEvent
} from "@/lib/os/pilot/funnel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  let session;
  try {
    session = await requireMerchantSession();
  } catch (e) {
    if (e instanceof MerchantNotAuthenticatedError) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated." },
        { status: 401 }
      );
    }
    throw e;
  }
  const cohort = process.env.PILOT_COHORT || "pilot-1";

  // Ensure participant row exists so subsequent funnel events attach.
  const participantId = await findOrCreateParticipant({
    cohort,
    merchantId: session.merchantId,
    merchantDisplayName: session.displayName
  });

  await recordFunnelEvent({
    cohort,
    stage: "merchant.trade_confirmed",
    participantId,
    merchantId: session.merchantId,
    actorKind: "merchant",
    meta: { primary_trade: session.primaryTrade }
  });

  const result = await seedMerchant({
    merchantId: session.merchantId,
    primaryTrade: session.primaryTrade
  });

  await recordFunnelEvent({
    cohort,
    stage: "merchant.products_seeded",
    participantId,
    merchantId: session.merchantId,
    actorKind: "system",
    meta: {
      canonicals: result.canonicalsSeeded,
      offers: result.offersCreated
    }
  });
  await recordFunnelEvent({
    cohort,
    stage: "merchant.scope_bound",
    participantId,
    merchantId: session.merchantId,
    actorKind: "system",
    meta: { leaves: result.scopeBound }
  });

  return NextResponse.json({
    ok: true,
    participantId,
    result
  });
}
