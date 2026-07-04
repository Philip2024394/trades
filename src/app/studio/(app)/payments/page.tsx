// Studio payment methods page.

import { loadStudioSession } from "@/lib/studio/session";
import { PaymentProviderSettings } from "@/components/studio/PaymentProviderSettings";

export const dynamic = "force-dynamic";

export default async function StudioPaymentsPage() {
  const session = await loadStudioSession();
  if (!session) return null;
  return <PaymentProviderSettings />;
}
