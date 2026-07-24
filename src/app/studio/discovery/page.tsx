// /studio/discovery — Business Discovery 7-question intake.
// Per V3 Q11 canonical questions. Populates Brand DNA v1 for the
// merchant. Downstream Studios read from that Brand DNA.

import { redirect } from "next/navigation";
import { loadStudioSession } from "@/lib/studio/session";
import { DiscoveryWizard } from "@/components/studio/discovery/DiscoveryWizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discovery — Studio", robots: { index: false } };

export default async function DiscoveryPage() {
  const session = await loadStudioSession();
  if (!session) redirect("/studio");
  return (
    <DiscoveryWizard
      merchantName={session.merchant.display_name}
      trade={session.merchant.primary_trade ?? ""}
    />
  );
}
