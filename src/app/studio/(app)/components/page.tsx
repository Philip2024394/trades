// Merchant component library — /studio/components.
//
// Server component loads the session for context; the client
// component owns the fetch loop, previews, delete, and insert-into-
// page flow. Available pages come from the same canonical list the
// Pages index shows (Module 0.4).

import { loadStudioSession } from "@/lib/studio/session";
import { StudioComponentLibrary } from "@/components/studio/StudioComponentLibrary";

export const dynamic = "force-dynamic";

const AVAILABLE_PAGES: { id: string; name: string }[] = [
  { id: "home", name: "Home" },
  { id: "plant-hire", name: "Plant Hire" }
];

export default async function StudioComponentsPage() {
  const session = await loadStudioSession();
  if (!session) return null;
  return (
    <StudioComponentLibrary
      brandName={session.brand.name}
      merchantSlug={session.merchant.slug}
      availablePages={AVAILABLE_PAGES}
    />
  );
}
