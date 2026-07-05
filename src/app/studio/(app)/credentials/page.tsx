// Studio verified-badges manager.

import { loadStudioSession } from "@/lib/studio/session";
import { CredentialManager } from "@/components/studio/CredentialManager";

export const dynamic = "force-dynamic";

export default async function StudioCredentialsPage() {
  const session = await loadStudioSession();
  if (!session) return null;
  return <CredentialManager />;
}
