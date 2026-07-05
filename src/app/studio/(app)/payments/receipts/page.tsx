// Studio receipt settings page.

import { loadStudioSession } from "@/lib/studio/session";
import { PaymentReceiptSettings } from "@/components/studio/PaymentReceiptSettings";

export const dynamic = "force-dynamic";

export default async function StudioPaymentReceiptsPage() {
  const session = await loadStudioSession();
  if (!session) return null;
  return <PaymentReceiptSettings />;
}
