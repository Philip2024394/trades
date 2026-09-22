// /nex-head-quarters/email-harvest/[slug]
//
// Dynamic dispatcher · reads the canonical EMAIL_HARVEST manifest.
// Real pages render their own dashboards. Stubs + partials render the
// honest EmailHarvestStub component. `real_via_reuse` entries redirect
// permanently to their canonical existing route (no duplicate dashboard).

import { redirect, notFound } from "next/navigation";
import { findEmailHarvestPage } from "@/lib/nex-hq/email-harvest-manifest";
import { EmailHarvestStub } from "@/components/nex-head-quarters/EmailHarvestStub";
import EmailHarvestOverview from "../overview-page";
import EmailHarvestProofHealth from "../proof-health-page";

export const dynamic = "force-dynamic";

export default async function EmailHarvestSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = findEmailHarvestPage(slug);
  if (!page) notFound();

  if (page.status === "real_via_reuse" && page.href) {
    redirect(page.href);
  }

  // Real pages · hand-built (overview + proof-health only for this wave)
  if (slug === "overview") return <EmailHarvestOverview page={page} />;
  if (slug === "proof-health") return <EmailHarvestProofHealth page={page} />;

  // Every other page uses the honest stub component (partial / stub)
  return <EmailHarvestStub page={page} />;
}
