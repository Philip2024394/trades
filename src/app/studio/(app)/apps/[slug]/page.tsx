// Studio App Store — detail route.
//
// Renders a single App's full manifest as a shareable Studio URL. The
// detail client fetches its own data so the merchant sees fresh
// install state on every visit.

import { loadStudioSession } from "@/lib/studio/session";
import { AppDetailPanel } from "@/components/studio/AppDetailPanel";

export const dynamic = "force-dynamic";

export default async function StudioAppDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await loadStudioSession();
  if (!session) return null;
  const { slug } = await params;
  return <AppDetailPanel slug={slug} merchantSlug={session.merchant.slug} />;
}
