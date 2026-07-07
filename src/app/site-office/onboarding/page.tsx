// /site-office/onboarding — merchant "day one wow" wizard.
//
// Five steps. Each takes ~30 seconds. At the end the merchant has:
//   • Products seeded (25 canonical references, 5 offers)
//   • AI Visualiser scope bound to their trade
//   • A tile embed snippet ready to drop into their existing site
//   • Business Hub with non-zero counters
//
// Funnel events fire at every stage transition. No new business
// features shipped here — this is a curated first-experience over the
// primitives that already exist.

import { redirect } from "next/navigation";
import { getMerchantId, loadMerchantSession } from "@/lib/os/merchantSession";
import { recordFunnelEvent } from "@/lib/os/pilot/funnel";
import { OnboardingWizard } from "./OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await loadMerchantSession();
  const merchantId = await getMerchantId();
  if (!merchantId || !session) {
    redirect("/site-office?next=/site-office/onboarding");
  }
  const cohort = process.env.PILOT_COHORT || "pilot-1";
  // First-visit funnel entry (idempotent per participant + stage but the
  // participant may not exist yet — that's fine, event still lands with
  // no participant_id and gets attributed later via merchant_id join).
  await recordFunnelEvent({
    cohort,
    stage: "merchant.onboarding_started",
    merchantId,
    actorKind: "merchant"
  });

  return (
    <OnboardingWizard
      cohort={cohort}
      merchantDisplayName={session.displayName}
      primaryTrade={session.primaryTrade}
    />
  );
}
