// /site/editor — the Konva-canvas photo composer for social posts.
//
// SSR resolves viewer identity + a starting image (optional
// ?image_id=... deep link from the wall). Everything else is the
// client component EditorClient — Konva is client-only.

import { Suspense } from "react";
import { getMerchantSlug } from "@/lib/merchantSession";
import { readSiteBuyerEmailCookie } from "@/lib/siteBuyerCookie";
import { hasActiveSiteSubscription, hasBundlingTier } from "@/lib/siteAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { GlobalHeader } from "@/components/shell/GlobalHeader";
import { UserMenuDropdownMount } from "@/components/UserMenuDropdownMount";
import { isAdminAuthed } from "@/lib/adminAuth";
import { EditorClient } from "./EditorClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Site Editor — Thenetworkers",
  description: "Compose a post for Instagram, Facebook, TikTok or Snapchat from any Site image."
};

async function paidForCaller(merchantSlug: string | null, email: string | null): Promise<boolean> {
  if (merchantSlug) {
    if (await hasActiveSiteSubscription(merchantSlug)) return true;
    if (await hasBundlingTier(merchantSlug))            return true;
  }
  if (email) {
    const res = await supabaseAdmin
      .from("hammerex_site_subscriptions")
      .select("id")
      .eq("buyer_email", email)
      .in("status", ["active", "trialing"])
      .gt("current_period_end", new Date().toISOString())
      .maybeSingle();
    if (res.data) return true;
  }
  return false;
}

async function loadLatestDraft(merchantSlug: string | null, email: string | null): Promise<{ id: string; state: unknown } | null> {
  // Load the caller's most-recent draft so returning users pick up
  // exactly where they left off. Anonymous callers (no merchant, no
  // email cookie) can't own drafts — skip the query.
  if (!merchantSlug && !email) return null;
  const q = supabaseAdmin
    .from("hammerex_site_editor_drafts")
    .select("id, state")
    .order("updated_at", { ascending: false })
    .limit(1);
  const res = merchantSlug
    ? await q.eq("owner_merchant_slug", merchantSlug).maybeSingle()
    : await q.eq("owner_email", email as string).maybeSingle();
  if (res.error || !res.data) return null;
  return { id: res.data.id as string, state: res.data.state as unknown };
}

export default async function SiteEditorPage({
  searchParams
}: {
  searchParams: Promise<{ image_id?: string; admin_template?: string }>;
}) {
  const { image_id: imageIdIn, admin_template: adminTemplateIn } = await searchParams;
  const merchantSlug = await getMerchantSlug();
  const email        = await readSiteBuyerEmailCookie();
  const paid         = await paidForCaller(merchantSlug, email);
  const isAdmin      = await isAdminAuthed();

  let sourceImage: { id: string; url: string; alt: string } | null = null;
  if (imageIdIn) {
    const img = await supabaseAdmin
      .from("hammerex_feed_tile_library")
      .select("slug, url, alt")
      .eq("slug", imageIdIn)
      .maybeSingle();
    if (img.data) {
      sourceImage = {
        id:  img.data.slug as string,
        // Route through the download endpoint so entitled callers get
        // the clean file; unpaid callers get a 402 and the canvas
        // falls back to the watermarked thumb.
        url: paid
          ? `/api/site/download/${encodeURIComponent(img.data.slug as string)}`
          : `/api/site/thumb/${encodeURIComponent(img.data.slug as string)}?w=1600`,
        alt: (img.data.alt ?? "") as string
      };
    }
  }

  // If we're deep-linking a specific ?image_id=... skip the draft
  // restore — the user has explicitly asked to start from that image.
  // Otherwise hydrate the latest draft so returning sessions resume.
  const initialDraft = (imageIdIn || adminTemplateIn) ? null : await loadLatestDraft(merchantSlug, email);

  // Admin authoring mode — load the requested template's state so
  // the editor opens with the template pre-populated. "new" is a
  // special sentinel that opens a fresh canvas in author mode.
  let adminTemplateSeed: { slug: string; state: unknown; frame_slug: string; label: string; category: string; sibling_group_slug: string | null } | null = null;
  const adminAuthoring = isAdmin && !!adminTemplateIn;
  if (adminAuthoring && adminTemplateIn !== "new") {
    const tpl = await supabaseAdmin
      .from("hammerex_site_editor_templates")
      .select("slug, state_json, frame_slug, label, category, sibling_group_slug")
      .eq("slug", adminTemplateIn)
      .maybeSingle();
    if (tpl.data) {
      adminTemplateSeed = {
        slug:               tpl.data.slug as string,
        state:              tpl.data.state_json as unknown,
        frame_slug:         tpl.data.frame_slug as string,
        label:              tpl.data.label as string,
        category:           tpl.data.category as string,
        sibling_group_slug: (tpl.data.sibling_group_slug ?? null) as string | null
      };
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F0E4" }}>
      {/* Header — brand yellow dot + page title beside it +
          user avatar dropdown on the right. Burger auto-hides when
          rightSlot is present (see GlobalHeader). */}
      <GlobalHeader
        rightSlot={<UserMenuDropdownMount/>}
        pageTitle="The Site Editor"
      />

      <Suspense fallback={<div className="p-8 text-center text-sm text-neutral-500">Loading editor…</div>}>
        <EditorClient
          paid={paid}
          initialImage={sourceImage}
          initialDraft={initialDraft}
          merchantSlug={merchantSlug}
          adminAuthoring={adminAuthoring}
          adminTemplateSeed={adminTemplateSeed}
        />
      </Suspense>
    </div>
  );
}
