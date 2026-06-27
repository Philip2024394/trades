// GET /<slug>/card.png  (rewritten from /<slug>/card.png and
// /trade/<slug>/card.png — see next.config.mjs).
//
// Thin wrapper around the shared card image generator at
// /api/trade-off/card-image. We re-export the same handler with the
// slug taken from the dynamic route segment instead of a query param,
// so the public URL can be a clean static-looking PNG path that
// previews inline in WhatsApp Web and Twitter cards.

import { type NextRequest } from "next/server";
import { renderCardImage } from "@/lib/cardImage";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const download = req.nextUrl.searchParams.get("download") === "1";
  return renderCardImage(slug, { download });
}
