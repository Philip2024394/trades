// POST /api/os/onboarding/complete — marks the merchant's onboarding
// as complete + records the terminal funnel event.
import { NextResponse } from "next/server";
import {
  requireMerchantSession,
  MerchantNotAuthenticatedError
} from "@/lib/os/merchantSession";
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
  const participantId = await findOrCreateParticipant({
    cohort,
    merchantId: session.merchantId,
    merchantDisplayName: session.displayName
  });
  await recordFunnelEvent({
    cohort,
    stage: "merchant.tile_published",
    participantId,
    merchantId: session.merchantId,
    actorKind: "merchant"
  });
  await recordFunnelEvent({
    cohort,
    stage: "merchant.onboarding_completed",
    participantId,
    merchantId: session.merchantId,
    actorKind: "merchant"
  });
  return NextResponse.json({ ok: true });
}
