// Studio Industry Pack detail.
//
// Shareable per-pack URL rendering the full manifest + resolved App
// list. Merchants land here from the browser card's "Details" button
// or when directly linked from the AI recommender.

import { loadStudioSession } from "@/lib/studio/session";
import { PackDetailPanel } from "@/components/studio/PackDetailPanel";

export const dynamic = "force-dynamic";

export default async function StudioPackDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await loadStudioSession();
  if (!session) return null;
  const { slug } = await params;
  return <PackDetailPanel slug={slug} merchantSlug={session.merchant.slug} />;
}
