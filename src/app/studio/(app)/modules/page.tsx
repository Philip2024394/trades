// Studio Business Modules — honest inventory.

import { loadStudioSession } from "@/lib/studio/session";
import { BusinessModulesGrid } from "@/components/studio/BusinessModulesGrid";

export const dynamic = "force-dynamic";

export default async function StudioModulesPage() {
  const session = await loadStudioSession();
  if (!session) return null;
  return (
    <BusinessModulesGrid primaryTrade={session.merchant.primary_trade} />
  );
}
