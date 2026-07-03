// Studio Design Presets page.
//
// Live at /studio/presets. Renders the picker inside the shell. The
// picker owns all state; this page is just the auth gate + mount.

import { loadStudioSession } from "@/lib/studio/session";
import { DesignPresetPicker } from "@/components/studio/DesignPresetPicker";

export const dynamic = "force-dynamic";

export default async function StudioPresetsPage() {
  const session = await loadStudioSession();
  if (!session) return null;

  return <DesignPresetPicker />;
}
