// GET /api/trade-off/card-image?slug=<slug>
//
// Query-string entry to the shared business-card generator (lib/cardImage).
// Used directly by the Web Share API path in ShareCardButton — the JS
// fetches this URL, gets a PNG, and attaches it to navigator.share.
//
// For the clean static-looking PNG URL (e.g. WhatsApp / Twitter inline
// previews), see /trade/<slug>/card.png/route.tsx + the next.config
// rewrite that surfaces it as /<slug>/card.png.

import { type NextRequest } from "next/server";
import { renderCardImage } from "@/lib/cardImage";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const download = req.nextUrl.searchParams.get("download") === "1";
  return renderCardImage(slug, { download });
}
