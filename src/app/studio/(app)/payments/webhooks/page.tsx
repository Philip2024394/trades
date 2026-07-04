// Studio payment webhooks page.

import { loadStudioSession } from "@/lib/studio/session";
import { PaymentWebhookLog } from "@/components/studio/PaymentWebhookLog";

export const dynamic = "force-dynamic";

export default async function StudioPaymentWebhooksPage() {
  const session = await loadStudioSession();
  if (!session) return null;
  return <PaymentWebhookLog />;
}
