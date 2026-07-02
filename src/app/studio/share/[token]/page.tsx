// Public reviewer route — /studio/share/<token>
//
// Resolves the token to a preview link, loads the merchant + brand +
// layout, and renders StudioPageClient in read-only preview mode.
//
// No auth required — the token itself is the credential. Expired /
// revoked / unknown tokens fall through to a small friendly error
// screen so reviewers know it wasn't a bug.

import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadLayoutForPage } from "@/lib/studio/layoutLoader";
import { loadBrandTokens } from "@/lib/studio/tokensLoader";
import { StudioPageClient } from "@/components/studio/StudioPageClient";
import { adminWhatsapp } from "@/lib/whatsapp";
import type { MerchantData, SectionRenderMode } from "@/lib/studio/sectionTypes";
import type { StudioLayoutJson } from "@/lib/studio/schema";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false }
};

type PreviewLinkRow = {
  id: string;
  brand_id: string;
  page_id: string;
  source_kind: "draft" | "live" | "version";
  source_version_id: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

type BrandRow = {
  id: string;
  name: string;
  slug: string;
  merchant_id: string;
};

type MerchantRow = {
  id: string;
  slug: string;
  display_name: string | null;
  city: string | null;
};

async function loadPreviewLink(token: string): Promise<PreviewLinkRow | null> {
  const res = await supabaseAdmin
    .from("studio_preview_links")
    .select("id, brand_id, page_id, source_kind, source_version_id, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (res.error) return null;
  const row = (res.data ?? null) as PreviewLinkRow | null;
  if (!row) return null;
  if (row.revoked_at) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
}

async function loadLayoutForLink(
  link: PreviewLinkRow,
  merchantId: string
): Promise<StudioLayoutJson | null> {
  if (link.source_kind === "version" && link.source_version_id) {
    const res = await supabaseAdmin
      .from("studio_layouts")
      .select("layout_json")
      .eq("id", link.source_version_id)
      .eq("brand_id", link.brand_id)
      .maybeSingle();
    if (res.error || !res.data) return null;
    return (res.data.layout_json ?? null) as StudioLayoutJson | null;
  }
  return loadLayoutForPage({
    merchantId,
    brandId: link.brand_id,
    pageId: link.page_id,
    preferStatus: link.source_kind === "draft" ? "draft" : "published"
  });
}

export default async function StudioSharePage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await loadPreviewLink(token);
  if (!link) return <ShareError msg="This share link has expired or been revoked." />;

  const brandRes = await supabaseAdmin
    .from("studio_brands")
    .select("id, name, slug, merchant_id")
    .eq("id", link.brand_id)
    .maybeSingle();
  const brand = (brandRes.data ?? null) as BrandRow | null;
  if (!brand) return <ShareError msg="Brand not found." />;

  const merchantRes = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name, city")
    .eq("id", brand.merchant_id)
    .maybeSingle();
  const merchant = (merchantRes.data ?? null) as MerchantRow | null;
  if (!merchant) return <ShareError msg="Merchant not found." />;

  const [layout, tokens] = await Promise.all([
    loadLayoutForLink(link, merchant.id),
    loadBrandTokens(brand.id)
  ]);
  if (!layout) return <ShareError msg="Preview content not found." />;

  const data: MerchantData = {
    merchantId: merchant.id,
    slug: merchant.slug,
    merchantName: merchant.display_name ?? merchant.slug,
    city: merchant.city ?? "",
    whatsappHref: adminWhatsapp() ? `https://wa.me/${adminWhatsapp()}` : null,
    brandName: brand.name,
    domain: {}
  };

  const mode: SectionRenderMode = "preview";

  // Fire-and-forget view stamp — never blocks the render on a slow DB.
  // view_count is left for a Module 21+ SQL function to increment
  // atomically; last_viewed_at is enough for "was this ever opened?".
  void supabaseAdmin
    .from("studio_preview_links")
    .update({ last_viewed_at: new Date().toISOString() })
    .eq("id", link.id)
    .then(() => null, () => null);

  return (
    <div style={{ background: "#F5F5F5", minHeight: "100vh" }}>
      <ShareRibbon
        brandName={brand.name}
        pageId={link.page_id}
        sourceKind={link.source_kind}
      />
      <StudioPageClient
        initialLayout={layout}
        initialSelected={null}
        initialMode={mode}
        tokens={tokens}
        data={data}
        brandId={brand.id}
        pageId={link.page_id}
      />
    </div>
  );
}

function ShareError({ msg }: { msg: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-neutral-100 p-6 text-center text-neutral-900">
      <div className="max-w-md">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-red-500">
          Preview unavailable
        </p>
        <p className="mt-1 text-[13px] font-bold">{msg}</p>
        <p className="mt-3 text-[12px] text-neutral-500">
          Ask the merchant to send a new preview link.
        </p>
      </div>
    </main>
  );
}

function ShareRibbon({
  brandName,
  pageId,
  sourceKind
}: {
  brandName: string;
  pageId: string;
  sourceKind: "draft" | "live" | "version";
}) {
  const label =
    sourceKind === "draft"
      ? "Draft preview"
      : sourceKind === "live"
        ? "Live preview"
        : "Historical version";
  return (
    <div
      className="sticky top-0 z-40 flex items-center gap-3 border-b border-neutral-200 px-4 py-2"
      style={{ background: "#0A0A0A", color: "#FFFFFF" }}
    >
      <span
        className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest"
        style={{ background: "#FFB300", color: "#0A0A0A" }}
      >
        Read-only
      </span>
      <p className="text-[11px] font-bold">
        {label} · {brandName} · <span className="font-mono">/{pageId}</span>
      </p>
    </div>
  );
}
