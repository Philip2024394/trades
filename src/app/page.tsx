// The canonical landing page — bright warm audience gate, with a
// visitor-aware hook strip above it that only shows when we have
// confidence about who's arrived (homeowner search, trade community
// referrer, B2B image query, or a ?ref= referral link).

import { AudienceGateBright } from "@/components/homepage/AudienceGateBright";
import { SmartVisitorHook } from "@/components/homepage/SmartVisitorHook";
import { HomepageDiscoveryStrip } from "@/components/homepage/HomepageDiscoveryStrip";

export const metadata = {
  title: "Thenetworkers · For every trade, homeowner, and merchant",
  description:
    "One network. One profile. One community — for every trade, homeowner, and merchant in the UK. Free for life."
};

export default async function Home({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  return (
    <main className="bg-[#FBF6EC]">
      <SmartVisitorHook searchParams={params} />
      <AudienceGateBright />
      {/* Resource ecosystem — surfaces every Phase 2/3 SEO pillar so
          direct + returning visitors discover the tools without
          typing URLs. Kept below the hero so the existing conversion
          path is not disturbed. */}
      <HomepageDiscoveryStrip />
    </main>
  );
}
