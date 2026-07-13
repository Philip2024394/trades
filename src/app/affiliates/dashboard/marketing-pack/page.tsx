// Affiliate dashboard — Marketing pack (Phase 2).
//
// Two surfaces:
//   1. QR code generator — uses the affiliate's referral URL to mint a
//      personalised PNG. THIS is the "stamp": the QR is unique per
//      affiliate because the data it encodes IS their referral URL.
//
//   2. Pre-uploaded creative grid — banners, stories, videos, PDFs, etc.
//      Filter chips at top; cards link through to the per-asset
//      download endpoint which logs the download and 302s to the
//      Supabase Storage URL. The affiliate posts these assets WITH
//      their referral URL in the caption — we deliberately do NOT
//      watermark images programmatically (brittle, never quite
//      readable on every background).
import Link from "next/link";
import { readAffiliateSessionServer } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { MarketingFilter } from "./MarketingFilter";
import {
  LEVEL_META,
  LEVEL_ORDER,
  type AffiliateLevel
} from "@/lib/affiliateLevel";
import { PageExplainer } from "@/components/xrated/affiliate/PageExplainer";

export const dynamic = "force-dynamic";

type Asset = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  file_url: string;
  thumbnail_url: string | null;
  width_px: number | null;
  height_px: number | null;
  duration_seconds: number | null;
  featured: boolean;
  required_level: AffiliateLevel;
};

const FILTERS: { id: string; label: string; kinds: string[] }[] = [
  { id: "all", label: "All", kinds: [] },
  { id: "banners", label: "Banners", kinds: ["banner"] },
  { id: "stories", label: "Stories", kinds: ["story", "social_post"] },
  { id: "logos", label: "Logos", kinds: ["logo"] },
  { id: "videos", label: "Videos", kinds: ["video"] },
  { id: "pdfs", label: "PDFs", kinds: ["pdf"] }
];

type SearchParams = Promise<{ filter?: string }>;

export default async function MarketingPackPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const session = await readAffiliateSessionServer();
  if (!session) return null;
  const id = session.affiliate_id;

  const sp = await searchParams;
  const activeFilter =
    FILTERS.find((f) => f.id === sp.filter) ?? FILTERS[0];

  const { data: aff } = await supabaseAdmin
    .from("hammerex_affiliates")
    .select("level")
    .eq("affiliate_id", id)
    .maybeSingle();
  const affiliateLevel: AffiliateLevel = (aff?.level ?? "bronze") as AffiliateLevel;
  const affiliateLevelIdx = LEVEL_ORDER.indexOf(affiliateLevel);

  let q = supabaseAdmin
    .from("hammerex_affiliate_marketing_assets")
    .select("*")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  if (activeFilter.kinds.length > 0) {
    q = q.in("kind", activeFilter.kinds);
  }
  const { data } = await q;
  const assets = (data ?? []) as Asset[];

  const referralUrl = `https://thenetworkers.app/?ref=${id}`;
  const qrUrl = (size: number) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=4&data=${encodeURIComponent(referralUrl)}`;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Marketing pack</h1>
        <p className="mt-1 text-[13px] text-brand-muted">
          Ready-to-post graphics, stories, banners and short videos. Include
          your referral link in the caption when you share — that&apos;s how
          we attribute the signup back to you.
        </p>
      </header>

      <PageExplainer
        title="Ready-made graphics, videos and your personal QR code"
        description="Download any of these and post them on social media. Include your referral link in the caption — that's how people find thenetworkers.app through you. Your QR code is the easiest — print it on a sticker, your van, your business card."
        steps={[
          "Download a banner or video",
          "Post it on Instagram / Facebook / TikTok",
          "Put your referral link in the caption",
          "Track where you posted in the Social Tracker"
        ]}
      />

      <section className="rounded-xl border border-brand-line bg-brand-surface p-5">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
          Your personalised QR code
        </h2>
        <p className="mt-1 text-[13px] text-brand-muted">
          Each QR encodes your unique referral link
          (<code className="text-brand-text">{referralUrl}</code>). Anyone
          who scans gets the 30-day cookie.
        </p>
        <p className="mt-2 text-[12px] text-neutral-500">
          Pick the size that fits where you&apos;re putting it: 200px for
          digital, 400px for flyers, 800px for posters or van wraps.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[200, 400, 800].map((size) => (
            <div
              key={size}
              className="flex flex-col items-center rounded-lg border border-brand-line bg-brand-bg p-4"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl(Math.min(size, 400))}
                width={Math.min(size, 200)}
                height={Math.min(size, 200)}
                alt={`QR code ${size}px`}
                className="rounded bg-white p-2"
              />
              <a
                href={qrUrl(size)}
                download={`thenetworkers-affiliate-${id}-${size}px.png`}
                className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-brand-accent px-4 text-[13px] font-bold text-black hover:opacity-90"
              >
                Download {size}px
              </a>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
            Creative library
          </h2>
        </div>
        <p className="mt-1 text-[13px] text-brand-muted">
          These graphics are ready to post — include your referral link in
          the caption.
        </p>
        <p className="mt-1 text-[12px] text-neutral-500">
          Some assets are locked until you reach the next affiliate level —
          your level shows on the Overview page.
        </p>
        <div className="mt-3">
          <MarketingFilter filters={FILTERS} active={activeFilter.id} />
        </div>

        {assets.length === 0 ? (
          <div className="mt-4 rounded-xl border border-brand-line bg-brand-surface p-6 text-center text-[13px] text-brand-muted">
            No assets in this category yet. Check back soon.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((a) => {
              const requiredIdx = LEVEL_ORDER.indexOf(a.required_level ?? "bronze");
              const locked = requiredIdx > affiliateLevelIdx;
              const lockedMeta = LEVEL_META[a.required_level ?? "bronze"];
              return (
              <article
                key={a.id}
                className={`relative flex flex-col overflow-hidden rounded-xl border border-brand-line bg-brand-surface ${
                  locked ? "opacity-80" : ""
                }`}
              >
                {locked && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 p-4 text-center">
                    <p
                      className="rounded px-2 py-0.5 text-[13px] font-extrabold uppercase tracking-wider"
                      style={{
                        backgroundColor: `${lockedMeta.accent}22`,
                        color: lockedMeta.accent
                      }}
                    >
                      {lockedMeta.label} only
                    </p>
                    <p className="mt-2 text-[13px] font-bold text-brand-text">
                      Reach {lockedMeta.label} to unlock
                    </p>
                  </div>
                )}
                <div className="aspect-video w-full bg-black">
                  {a.kind === "video" ? (
                    <video
                      src={a.file_url}
                      controls
                      preload="metadata"
                      className="h-full w-full object-contain"
                    />
                  ) : a.kind === "pdf" ? (
                    <div className="flex h-full w-full items-center justify-center">
                      {a.thumbnail_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={a.thumbnail_url}
                          alt={a.title}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-2xl font-extrabold text-brand-accent">
                          PDF
                        </span>
                      )}
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={a.file_url}
                      alt={a.title}
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <p className="text-[13px] font-bold text-brand-text">
                    {a.title}
                  </p>
                  {a.description && (
                    <p className="text-[13px] leading-snug text-brand-muted">
                      {a.description}
                    </p>
                  )}
                  <p className="text-[13px] text-brand-muted">
                    {a.kind.toUpperCase()}
                    {a.width_px && a.height_px ? (
                      <>
                        {" "}
                        &middot; {a.width_px}&times;{a.height_px}px
                      </>
                    ) : null}
                  </p>
                  <div className="mt-auto pt-2">
                    {locked ? (
                      <span className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-brand-line bg-brand-bg px-4 text-[13px] font-bold text-brand-muted">
                        Locked
                      </span>
                    ) : (
                      <Link
                        href={`/api/affiliates/marketing-download?asset_id=${a.id}`}
                        className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand-accent px-4 text-[13px] font-bold text-black hover:opacity-90"
                        prefetch={false}
                      >
                        Download
                      </Link>
                    )}
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
