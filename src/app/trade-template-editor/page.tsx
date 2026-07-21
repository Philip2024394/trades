// /trade-template-editor — one clean URL for the trade Templates editor
// (iPhone-frame preview + colour palette + shade + feed colour + feed image).
//
// Resolves the signed-in merchant's slug from the studio session and
// redirects to their /trade-off/edit/[slug]/templates picker. Templates
// route uses slug-only auth (no token), so no lookup is needed.
//
// Not signed in → bounced to login with next=/trade-template-editor so
// they land back here (and get forwarded) after auth.

import { redirect } from "next/navigation";
import { loadMerchantSession } from "@/lib/os/merchantSession";

export const dynamic = "force-dynamic";

export default async function TradeTemplateEditorRedirect() {
  const session = await loadMerchantSession();
  if (!session) redirect("/trade-off/login?next=/trade-template-editor");
  redirect(`/trade-off/edit/${session.slug}/templates`);
}
