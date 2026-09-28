// src/app/nex-native/manage/ladder/page.tsx
//
// Bridge 49c · Seller editor for NEX Direct Price · loyalty ladder +
// share bonuses + compare channel + compare markup. Server component
// loads the caller's businesses + current ladder rows (or defaults
// where none exists yet) and mounts the client editor.
//
// Dark chat-card palette matches /nex-native/chat + /manage/shop for
// visual continuity. Founder direction 2026-09-29 · sealed doctrine
// lives in memory/nex_direct_price_swiss_sealed_2026_09_29.md.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as ladderService from "@/lib/nex-native/ladder-service";
import { NexPageHeader } from "../../_page-header";
import { NexDirectPriceEditor } from "./_editor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string; business?: string }>;
}

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  fieldBg: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
  green: "#10B981",
  red: "#EF4444",
};

const SUCCESS_CODES = new Set(["ladder_ok"]);

export default async function LadderEditorPage({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const isSuccess = banner ? SUCCESS_CODES.has(banner.code) : false;

  const businesses = await businessService
    .listBusinessesByOwner(session.account.id)
    .catch(() => []);

  const selectedBusiness = sp.business
    ? businesses.find((b) => b.id === sp.business) ?? businesses[0]
    : businesses[0];

  const ladder = selectedBusiness
    ? await ladderService.getLadderForBusiness(selectedBusiness.id).catch(() => null)
    : null;

  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        data-nex-ladder-root
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "16px 12px 60px",
          position: "relative",
          overflowX: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(60% 40% at 50% 0%, rgba(0,175,255,0.09), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", maxWidth: 520, margin: "0 auto" }}>
          <NexPageHeader dataScope="manage-ladder" />

          <section style={{ marginTop: 22 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.20em",
                textTransform: "uppercase",
                color: NEX.orange,
                fontWeight: 800,
              }}
            >
              NEX Direct Price
            </div>
            <h1
              style={{
                margin: "4px 0 6px",
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              Loyalty ladder + share rewards
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.55,
                color: NEX.textSecondary,
                maxWidth: 440,
              }}
            >
              The more your buyers order, the bigger their discount.
              Sharing with a NEX friend or group rewards both sides.
              You keep control · max discount stack is your call ·
              15% still beats typical delivery-app commissions.
            </p>
          </section>

          {banner && (
            <div
              role="status"
              data-nex-ladder-banner={banner.code}
              style={{
                marginTop: 16,
                padding: "10px 14px",
                borderRadius: 10,
                border: `1px solid ${isSuccess ? NEX.green : NEX.red}55`,
                background: isSuccess
                  ? "rgba(16,185,129,0.10)"
                  : "rgba(239,68,68,0.10)",
                color: isSuccess ? NEX.green : NEX.red,
                fontSize: 12,
              }}
            >
              {banner.message}
            </div>
          )}

          {businesses.length === 0 ? (
            <div
              style={{
                marginTop: 22,
                padding: 20,
                background: NEX.panel,
                border: `1px solid ${NEX.cyanSoft}`,
                borderRadius: 14,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 34, marginBottom: 8 }} aria-hidden>
                🛍
              </div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                No shop yet
              </h2>
              <p
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: NEX.textSecondary,
                  lineHeight: 1.5,
                }}
              >
                Create a shop first to configure your Direct Price
                ladder. Ladder applies to every product / menu item in
                the shop automatically.
              </p>
              <Link
                href="/nex-native/manage/shop"
                style={{
                  display: "inline-flex",
                  marginTop: 14,
                  padding: "10px 18px",
                  background: NEX.orange,
                  color: "#0B0F1A",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                }}
              >
                Set up shop →
              </Link>
            </div>
          ) : (
            <>
              {/* Business selector · appears only when the owner has
                  more than one business (Bisnis up to 5). */}
              {businesses.length > 1 && (
                <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {businesses.map((b) => {
                    const isActive = selectedBusiness && b.id === selectedBusiness.id;
                    return (
                      <Link
                        key={b.id}
                        href={`/nex-native/manage/ladder?business=${b.id}`}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 999,
                          background: isActive ? NEX.cyan : "transparent",
                          color: isActive ? "#0B0F1A" : NEX.textPrimary,
                          border: `1px solid ${isActive ? NEX.cyan : NEX.cyanFaint}`,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          textDecoration: "none",
                        }}
                      >
                        {b.display_name}
                      </Link>
                    );
                  })}
                </div>
              )}

              {selectedBusiness && (
                <NexDirectPriceEditor
                  businessId={selectedBusiness.id}
                  businessName={selectedBusiness.display_name}
                  businessSlug={selectedBusiness.slug}
                  compareMarkupPct={selectedBusiness.compare_markup_pct ?? 22}
                  initialLadder={
                    ladder
                      ? {
                          tiers: ladder.tiers,
                          maxCapPct: ladder.max_cap_pct,
                          shareFriendBonusPct: ladder.share_friend_bonus_pct,
                          shareGroupBonusPct: ladder.share_group_bonus_pct,
                          shareExpiryHours: ladder.share_expiry_hours,
                          compareChannel: ladder.compare_channel,
                          active: ladder.active,
                        }
                      : {
                          tiers: [...ladderService.NEX_DEFAULT_LADDER_TIERS],
                          maxCapPct: ladderService.NEX_LADDER_DEFAULTS.max_cap_pct,
                          shareFriendBonusPct:
                            ladderService.NEX_LADDER_DEFAULTS.share_friend_bonus_pct,
                          shareGroupBonusPct:
                            ladderService.NEX_LADDER_DEFAULTS.share_group_bonus_pct,
                          shareExpiryHours:
                            ladderService.NEX_LADDER_DEFAULTS.share_expiry_hours,
                          compareChannel:
                            ladderService.NEX_LADDER_DEFAULTS.compare_channel,
                          active: true,
                        }
                  }
                />
              )}
            </>
          )}

          <p
            style={{
              marginTop: 22,
              fontSize: 11,
              color: NEX.textSecondary,
              opacity: 0.7,
              lineHeight: 1.5,
              maxWidth: 440,
            }}
          >
            The compare price on every product is {selectedBusiness?.compare_markup_pct ?? 22}%
            above your listed NEX price · buyers see the delta as
            "you save Rp X vs typical delivery app". NEX never names
            competitor apps in the copy.
          </p>
        </div>
      </main>
    </>
  );
}
