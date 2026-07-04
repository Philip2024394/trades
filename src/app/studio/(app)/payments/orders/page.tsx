// Studio payment orders page.

import { loadStudioSession } from "@/lib/studio/session";
import { PaymentOrdersDashboard } from "@/components/studio/PaymentOrdersDashboard";

export const dynamic = "force-dynamic";

export default async function StudioPaymentOrdersPage() {
  const session = await loadStudioSession();
  if (!session) return null;
  return <PaymentOrdersDashboard />;
}
