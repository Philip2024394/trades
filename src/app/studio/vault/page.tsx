// /studio/vault — the Brand Vault (merchant home screen).
// Per V2 Part 5. Six zones: Hero + Quick Actions + My Brand + My
// Assets + Recent Activity + AI Recommendations.
//
// The merchant's digital headquarters. Not a dashboard. Everything
// about their business lives here.

import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { safeParseBrandRecord } from "@/lib/design/brand/schema";
import { BrandVaultHome } from "@/components/studio/vault/BrandVaultHome";

export const dynamic  = "force-dynamic";
export const metadata: Metadata = {
  title: "Brand Vault — Studio",
  robots: { index: false, follow: false }
};

export default async function BrandVaultPage() {
  const session = await loadStudioSession();
  if (!session) redirect("/studio");

  // Read the merchant's Brand Identity (from V1 foundation migration)
  const { data: identityRow } = await supabaseAdmin
    .from("hammerex_brand_identity")
    .select("id, fingerprint, brand_json, version, updated_at")
    .eq("merchant_slug", session.merchant.slug)
    .maybeSingle();

  const brand = identityRow ? safeParseBrandRecord(identityRow.brand_json) : null;

  // Recent van generations (from Van Wrap App output tables)
  const { data: vanSessions } = await supabaseAdmin
    .from("hammerex_van_sessions")
    .select("id, business_name, trade, van_slug, van_colour, status, final_image_urls, started_at")
    .eq("merchant_slug", session.merchant.slug)
    .order("started_at", { ascending: false })
    .limit(6);

  // Recent activity from the platform event bus (V1 Part 4)
  const { data: events } = await supabaseAdmin
    .from("hammerex_events")
    .select("type, created_at, payload_json")
    .eq("merchant_id", session.merchant.slug)
    .order("created_at", { ascending: false })
    .limit(10);

  // Proactive AI recommendations from Mate's signals engine (already
  // shipped in the Mate build).
  const { data: signals } = await supabaseAdmin
    .from("hammerex_mate_signals")
    .select("id, kind, title, body, action_url, action_label, priority")
    .eq("surface", "merchant")
    .eq("user_key", session.merchant.slug)
    .eq("status", "new")
    .order("priority", { ascending: true })
    .limit(5);

  return (
    <BrandVaultHome
      merchant={{
        name:  session.merchant.display_name,
        trade: session.merchant.primary_trade ?? "",
        slug:  session.merchant.slug
      }}
      brand={brand}
      brandVersion={identityRow?.version ?? 0}
      brandUpdatedAt={identityRow?.updated_at ?? null}
      vanSessions={(vanSessions ?? []).map((v) => ({
        id:            v.id as string,
        businessName:  v.business_name as string,
        vanSlug:       v.van_slug as string,
        vanColour:     v.van_colour as string,
        status:        v.status as string,
        thumbnailUrl:  extractThumb(v.final_image_urls),
        startedAt:     v.started_at as string
      }))}
      activity={(events ?? []).map((e) => ({
        type:      e.type as string,
        createdAt: e.created_at as string
      }))}
      signals={(signals ?? []).map((s) => ({
        id:          s.id as string,
        kind:        s.kind as string,
        title:       s.title as string,
        body:        s.body as string,
        actionUrl:   (s.action_url as string | null) ?? null,
        actionLabel: (s.action_label as string | null) ?? null,
        priority:    s.priority as number
      }))}
    />
  );
}

function extractThumb(final: unknown): string | null {
  if (!final || typeof final !== "object") return null;
  const asRec = final as Record<string, unknown>;
  const side = asRec.side;
  if (typeof side === "string") return side;
  return null;
}
