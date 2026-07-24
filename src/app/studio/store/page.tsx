// /studio/store — Capability Store.
// Visual bundle catalog per V2 Q9. Sells outcomes, not images.
// Reads from src/lib/design/pricing/bundles.ts.

import { redirect } from "next/navigation";
import { loadStudioSession } from "@/lib/studio/session";
import { CapabilityStore } from "@/components/studio/store/CapabilityStore";
import { BUNDLES } from "@/lib/design/pricing/bundles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Capability Store — Studio", robots: { index: false } };

export default async function StorePage() {
  const session = await loadStudioSession();
  if (!session) redirect("/studio");
  return <CapabilityStore bundles={BUNDLES} merchantName={session.merchant.display_name}/>;
}
