import { loadStudioSession } from "@/lib/studio/session";
import { StudioMediaLibrary } from "@/components/studio/StudioMediaLibrary";

export const dynamic = "force-dynamic";

export default async function StudioMediaPage() {
  const session = await loadStudioSession();
  if (!session) return null;
  return <StudioMediaLibrary brandName={session.brand.name} />;
}
