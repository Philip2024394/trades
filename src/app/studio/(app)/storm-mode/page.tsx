// Storm-mode settings route.

import { loadStudioSession } from "@/lib/studio/session";
import { StormModeSettings } from "@/components/studio/StormModeSettings";

export const dynamic = "force-dynamic";

export default async function StudioStormModePage() {
  const session = await loadStudioSession();
  if (!session) return null;
  return <StormModeSettings />;
}
