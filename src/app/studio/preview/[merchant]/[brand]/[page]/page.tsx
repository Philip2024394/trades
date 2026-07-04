// Studio preview route — the URL the editor iframes.
//
// Server-fetches merchant + brand + layout, then hands off to the
// client shell which renders sections and manages postMessage state.
// Same-origin with /studio/* so the parent can read postMessages
// without cross-origin gymnastics.
//
// Not indexable, only reachable with a valid edit_token — this URL is
// merchant-private.

import type { Metadata } from "next";
import { StudioPageClient } from "@/components/studio/StudioPageClient";
import { validateEntryToken } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { decodeDraftParam, loadLayoutForPage } from "@/lib/studio/layoutLoader";
import { loadBrandTokens } from "@/lib/studio/tokensLoader";
import { whatsappDigits } from "@/lib/tradeOff";
import { adminWhatsapp } from "@/lib/whatsapp";
import type {
  MerchantData,
  SectionRenderMode
} from "@/lib/studio/sectionTypes";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false }
};

type SearchParams = {
  token?: string;
  edit?: string;
  _draft?: string;
  selected?: string;
};

export default async function StudioPreviewPage({
  params,
  searchParams
}: {
  params: Promise<{ merchant: string; brand: string; page: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { merchant: merchantSlug, brand: brandSlug, page: pageId } =
    await params;
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const editMode = sp.edit === "1";
  const selected =
    typeof sp.selected === "string" && sp.selected ? sp.selected : null;

  // Auth via token — same as /studio entry route. Cookie auth would
  // fail here because the iframe origin may block third-party cookies.
  const merchant = await validateEntryToken(token);
  if (!merchant || merchant.slug !== merchantSlug) {
    return <PreviewError msg="Bad token or merchant slug mismatch" />;
  }

  const brandRes = await supabaseAdmin
    .from("studio_brands")
    .select("id, name, slug")
    .eq("merchant_id", merchant.id)
    .eq("slug", brandSlug)
    .maybeSingle();
  if (!brandRes.data) return <PreviewError msg="Brand not found" />;
  const brand = brandRes.data;

  // Draft URL param wins over stored layout — that's how the editor
  // shows hot un-saved changes.
  const draftFromUrl = decodeDraftParam(sp._draft);
  const initialLayout =
    draftFromUrl ??
    (await loadLayoutForPage({
      merchantId: merchant.id,
      brandId: brand.id,
      pageId
    }));

  // Brand tokens flat map: "kind.key" → value. Merges code DEFAULT_TOKENS
  // with the merchant's studio_brand_tokens overrides — every renderer
  // reads via tokens["color.accent"] and friends, with per-registration
  // fallbacks for the rare miss.
  const tokens = await loadBrandTokens(brand.id);

  const waDigits =
    whatsappDigits(merchant.slug ? "" : "") ||
    // Placeholder — the real whatsapp column will hydrate here once the
    // preview server reads the full listing.
    adminWhatsapp();
  const waHref = waDigits ? `https://wa.me/${waDigits}` : null;

  const data: MerchantData = {
    merchantId: merchant.id,
    slug: merchant.slug,
    merchantName: merchant.display_name,
    city: merchant.city,
    whatsappHref: waHref,
    brandName: brand.name,
    brandId: brand.id,
    domain: {}
  };

  const mode: SectionRenderMode = editMode ? "edit" : "preview";

  return (
    <div style={{ background: "#F5F5F5", minHeight: "100vh" }}>
      <StudioPageClient
        initialLayout={initialLayout}
        initialSelected={selected}
        initialMode={mode}
        tokens={tokens}
        data={data}
        brandId={brand.id}
        pageId={pageId}
      />
    </div>
  );
}

function PreviewError({ msg }: { msg: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-neutral-100 p-6 text-center text-neutral-900">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-red-500">
          Preview error
        </p>
        <p className="mt-1 text-[13px] font-bold">{msg}</p>
      </div>
    </main>
  );
}
