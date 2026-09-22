// /nex-head-quarters/email-harvest
//
// EMAIL HARVEST section landing page = Overview (real evidence-backed).

import { findEmailHarvestPage } from "@/lib/nex-hq/email-harvest-manifest";
import EmailHarvestOverview from "./overview-page";

export const dynamic = "force-dynamic";

export default function EmailHarvestRoot() {
  const page = findEmailHarvestPage("overview")!;
  return <EmailHarvestOverview page={page} />;
}
