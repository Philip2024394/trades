// Studio Blueprint Wizard.

import { loadStudioSession } from "@/lib/studio/session";
import { BlueprintWizard } from "@/components/studio/blueprints/BlueprintWizard";
// Side-effect: register every blueprint before the wizard ranks anything
import "@/lib/studio/blueprints";

export const dynamic = "force-dynamic";

export default async function StudioBlueprintWizardPage() {
  const session = await loadStudioSession();
  if (!session) return null;
  return (
    <BlueprintWizard
      currentSlug={session.merchant.slug}
      displayName={session.merchant.display_name}
    />
  );
}
