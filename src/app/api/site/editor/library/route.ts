// GET /api/site/editor/library
//
// Unified image gallery for the Site Editor's Image Library drawer.
// Four sources merged into one list, filtered + searched server-side:
//
//   source=site      → The Site (hammerex_feed_tile_library, tier 2+3,
//                       active, non-empty fits_frames)
//   source=uploads   → merchant's own user-uploaded images
//                       (hammerex_site_editor_user_images)
//   source=canteen   → photos posted to the merchant's canteen
//                       (hammerex_canteen_posts.photo_urls)
//   source=yard      → photos the merchant posted to the Yard flow
//                       (yard posts also live in canteen_posts, filtered
//                        by kind='counter' or 'showcase')
//
// Query params:
//   source       — one of the four above (default: site)
//   q            — free-text search on subject / alt
//   fits         — frame slug — only return images whose fits_frames
//                  contains this slug
//   limit/offset — pagination (default 40 per page)
//
// Response: { images: Image[], hasMore: boolean }

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { computeFitsFrames } from "@/lib/siteEditor/frames";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Source = "site" | "uploads" | "canteen" | "yard";

export type LibraryImage = {
  id:             string;
  url:            string;
  subject:        string;
  source:         Source;
  natural_aspect: number | null;
  fits_frames:    string[];
};

const DEFAULT_LIMIT = 40;
const MAX_LIMIT     = 100;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sourceIn = (req.nextUrl.searchParams.get("source") ?? "site") as Source;
  const source: Source = ["site", "uploads", "canteen", "yard"].includes(sourceIn) ? sourceIn : "site";
  const q      = (req.nextUrl.searchParams.get("q")    ?? "").trim().toLowerCase();
  const fits   = (req.nextUrl.searchParams.get("fits") ?? "").trim();
  const limit  = Math.min(MAX_LIMIT, Math.max(1, Number(req.nextUrl.searchParams.get("limit")  ?? DEFAULT_LIMIT)));
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? 0));

  const merchantSlug = await getMerchantSlug();
  if ((source === "uploads" || source === "canteen" || source === "yard") && !merchantSlug) {
    return NextResponse.json({ images: [], hasMore: false });
  }

  if (source === "site") {
    return handleSite(q, fits, limit, offset);
  }
  if (source === "canteen" || source === "yard") {
    return handleCanteenOrYard(source, merchantSlug!, q, fits, limit, offset);
  }
  return handleUploads(merchantSlug!, q, fits, limit, offset);
}

// ============================================================ site

async function handleSite(q: string, fits: string, limit: number, offset: number): Promise<NextResponse> {
  let sel = supabaseAdmin
    .from("hammerex_feed_tile_library")
    .select("slug, url, alt, natural_aspect, fits_frames", { count: "exact" })
    .eq("active", true)
    .in("tier", [2, 3])
    .eq("has_brand_marks", false)
    .eq("is_banner", false)
    // Quality gate — never show images that don't fit any frame.
    .not("fits_frames", "eq", "{}")
    .order("tier", { ascending: false })
    .order("slug", { ascending: true })
    .range(offset, offset + limit);

  if (q) sel = sel.ilike("alt", `%${q}%`);
  if (fits) sel = sel.contains("fits_frames", [fits]);

  const res = await sel;
  if (res.error) {
    console.error("[library/site] failed:", res.error.message);
    return NextResponse.json({ images: [], hasMore: false });
  }
  const rows = res.data ?? [];
  const images: LibraryImage[] = rows.slice(0, limit).map((r) => ({
    id:             String(r.slug),
    url:            String(r.url),
    subject:        String(r.alt ?? ""),
    source:         "site",
    natural_aspect: (r.natural_aspect as number | null) ?? null,
    fits_frames:    (r.fits_frames as string[] | null) ?? []
  }));
  return NextResponse.json({ images, hasMore: rows.length > limit });
}

// ============================================================ canteen / yard

async function handleCanteenOrYard(
  source:       "canteen" | "yard",
  merchantSlug: string,
  q:            string,
  fits:         string,
  limit:        number,
  offset:       number
): Promise<NextResponse> {
  // The merchant's own canteen posts carry photo_urls arrays. We
  // unpack them client-side after selecting rows.
  //
  // "yard" filter narrows to counter/showcase kinds that appear on the
  // aggregated Yard feed; "canteen" returns everything the merchant
  // posted to their canteen regardless of kind.
  const kinds = source === "yard" ? ["counter", "showcase"] : ["chat", "question", "showcase", "make-offer", "announcement", "counter"];

  let sel = supabaseAdmin
    .from("hammerex_canteen_posts")
    .select("id, body, photo_urls, kind, created_at")
    .eq("author_slug", merchantSlug)
    .in("kind", kinds)
    .not("photo_urls", "is", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit * 3);   // over-fetch, filter, then trim

  if (q) sel = sel.ilike("body", `%${q}%`);
  const res = await sel;
  if (res.error) {
    console.error("[library/canteen] failed:", res.error.message);
    return NextResponse.json({ images: [], hasMore: false });
  }

  const images: LibraryImage[] = [];
  for (const row of res.data ?? []) {
    const urls = (row.photo_urls as string[] | null) ?? [];
    for (let i = 0; i < urls.length; i++) {
      images.push({
        id:             `${String(row.id)}:${i}`,
        url:            String(urls[i]),
        subject:        String(row.body ?? ""),
        source,
        natural_aspect: null,
        fits_frames:    []
      });
    }
    if (images.length >= limit + 1) break;
  }

  // Probe natural aspect + fits_frames on the fly for the ones we're
  // returning this page. Small N so a per-image lookup is fine.
  await Promise.all(images.slice(0, limit).map(async (img) => {
    const aspect = await probeAspect(img.url);
    img.natural_aspect = aspect;
    img.fits_frames    = aspect ? computeFitsFrames(aspect) : [];
  }));

  // Filter by fits and quality gate.
  const gated = images
    .slice(0, limit + 1)
    .filter((img) => (img.fits_frames?.length ?? 0) > 0)
    .filter((img) => (fits ? img.fits_frames.includes(fits) : true));

  return NextResponse.json({
    images:  gated.slice(0, limit),
    hasMore: gated.length > limit
  });
}

// ============================================================ uploads

async function handleUploads(
  merchantSlug: string,
  q:            string,
  fits:         string,
  limit:        number,
  offset:       number
): Promise<NextResponse> {
  // User uploads are stored in the same overlays table with category
  // 'custom' — we keep it as an interim source until a dedicated
  // hammerex_site_editor_user_images table lands (Phase 8 continuation).
  // For now: read from the overlays table filtered to the merchant's
  // custom-category rows so uploads-tab isn't empty.
  let sel = supabaseAdmin
    .from("hammerex_site_editor_overlays")
    .select("id, label, url, aspect_ratio", { count: "exact" })
    .eq("owner_merchant_slug", merchantSlug)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);

  if (q) sel = sel.ilike("label", `%${q}%`);
  const res = await sel;
  if (res.error) return NextResponse.json({ images: [], hasMore: false });

  const rows = res.data ?? [];
  const images: LibraryImage[] = rows.slice(0, limit).map((r) => {
    const aspect = (r.aspect_ratio as number | null) ?? null;
    return {
      id:             String(r.id),
      url:            String(r.url),
      subject:        String(r.label ?? ""),
      source:         "uploads",
      natural_aspect: aspect,
      fits_frames:    aspect ? computeFitsFrames(aspect) : []
    };
  });

  const gated = fits
    ? images.filter((img) => img.fits_frames.includes(fits))
    : images.filter((img) => img.fits_frames.length > 0);

  return NextResponse.json({ images: gated, hasMore: rows.length > limit });
}

// ============================================================ helpers

const aspectCache = new Map<string, number>();
async function probeAspect(url: string): Promise<number | null> {
  if (aspectCache.has(url)) return aspectCache.get(url)!;
  try {
    // Ask for just the head so we don't download megabytes to read
    // the dimensions. We fall back to a small ranged GET if the
    // server doesn't return Content-Range on HEAD.
    const head = await fetch(url, { method: "HEAD", cache: "no-store" });
    const cl = Number(head.headers.get("content-length") ?? "0");
    // Small files → grab the whole thing and use sharp.
    const bytesToFetch = cl > 0 && cl < 128 * 1024 ? cl : 128 * 1024;
    const rangeRes = await fetch(url, {
      cache: "no-store",
      headers: { Range: `bytes=0-${bytesToFetch - 1}` }
    });
    const buf = Buffer.from(await rangeRes.arrayBuffer());
    // Dynamic import to keep sharp out of the edge-runtime path.
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buf).metadata();
    if (meta.width && meta.height) {
      const aspect = meta.width / meta.height;
      aspectCache.set(url, aspect);
      return aspect;
    }
    return null;
  } catch {
    return null;
  }
}
