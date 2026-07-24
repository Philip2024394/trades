// /studio/studios/van-wrap — merchant-facing Van Wrap generation page.
//
// Reads the merchant session server-side, hands off to the client
// component for the generate/refine loop.

import { redirect } from "next/navigation";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { VanWrapStudio } from "@/components/studio/studios/VanWrapStudio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Van Wrap Studio", robots: { index: false } };

export default async function Page() {
  const session = await loadStudioSession();
  if (!session) redirect("/studio");

  const { data: identity } = await supabaseAdmin
    .from("hammerex_brand_identity")
    .select("brand_json, version, updated_at")
    .eq("merchant_slug", session.merchant.slug)
    .maybeSingle();

  if (!identity) redirect("/studio/discovery");

  const brand = identity.brand_json as { name?: string };

  return (
    <VanWrapStudio
      merchantName={session.merchant.display_name}
      brandName={brand.name ?? session.merchant.display_name}
      brandVersion={identity.version}
    />
  );
}
