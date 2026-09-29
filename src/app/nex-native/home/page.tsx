// src/app/nex-native/home/page.tsx
//
// NEX signed-in home · three-doorway hub (Philip 2026-09-26).
// -------------------------------------------------------------------------
// Softens the earlier "Chat is the product" landing. A signed-in visitor
// now sees three landscape doorways:
//
//   1 · Chat with friends           → /nex-native/conversations
//   2 · My shop / work / journey    → /nex-native/manage · /onboarding
//   3 · Account health & stats      → /nex-native/settings/profile
//
// Tile 2 and Tile 3 labels adapt to the account kind captured at signup
// (`nex_account_profile.kind`). Business owners see "My shop"; a
// professional sees "My work"; a student / seeking-work sees
// "My journey". Everyone sees Chat as the first doorway.
//
// Signed-out visitors are bounced to /nex-native/sign-in so this surface
// never accidentally leaks a signed-in shape.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountProfileService from "@/lib/nex-native/account-profile-service";
import * as businessService from "@/lib/nex-native/business-service";
import type { NexAccountKind } from "@/lib/nex-native/types";
import { NEX_COMMERCE_ENABLED } from "@/lib/nex-native/launch-flags";
import { NexPageHeader } from "../_page-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
};

interface TileCopy {
  href: string;
  emoji: string;
  title: string;
  subtitle: string;
}

/** Doorway 2 (shop / work / journey / themes) copy per account kind.
 *  Bridge 58 · Phase 1 launch · when commerce is off, tile 2 always
 *  points at the theme picker so first-run users go straight to the
 *  actual paid product (themes). Commerce-on falls back to the
 *  original merchant/professional/journey routing. */
function shopTile(kind: NexAccountKind | null, hasBusiness: boolean): TileCopy {
  if (!NEX_COMMERCE_ENABLED) {
    return {
      href: "/nex-native/settings/theme",
      emoji: "🎨",
      title: "Your look",
      subtitle: "Pick a chat theme · mascots · effects · try premium free for 7 days",
    };
  }
  if (kind === "professional") {
    return {
      href: "/nex-native/settings/profile",
      emoji: "🧰",
      title: "My work",
      subtitle: "Skills · services · portfolio",
    };
  }
  if (kind === "student" || kind === "seeking_work" || kind === "exploring") {
    return {
      href: "/nex-native/settings/profile",
      emoji: "🌱",
      title: "My journey",
      subtitle: "Skills · availability · what you&rsquo;re looking for",
    };
  }
  if (kind === "reseller") {
    return {
      href: hasBusiness ? "/nex-native/manage" : "/nex-native/onboarding",
      emoji: "🛒",
      title: "My reselling",
      subtitle: hasBusiness
        ? "List products · update stock · manage orders"
        : "Set up your reselling shop · start with your first product",
    };
  }
  // business_owner · other · null → shop path
  return {
    href: hasBusiness ? "/nex-native/manage" : "/nex-native/onboarding",
    emoji: "🛍",
    title: "My shop",
    subtitle: hasBusiness
      ? "Add products · update"
      : "Create your NEX shop · sell your first product",
  };
}

function healthTile(kind: NexAccountKind | null): TileCopy {
  // Bridge 58 · Phase 1 · when commerce is off, replace commerce-
  // flavoured "orders · products · sales" subtitles with a clean
  // profile-only line so no shop language leaks on the home hub.
  if (!NEX_COMMERCE_ENABLED) {
    return {
      href: "/nex-native/settings/profile",
      emoji: "👤",
      title: "Your profile",
      subtitle: "Photo · occupation · privacy · account",
    };
  }
  const subtitle =
    kind === "business_owner"
      ? "Orders · products · profile completeness"
      : kind === "reseller"
        ? "Sales · commissions · profile completeness"
        : kind === "professional"
          ? "Enquiries · profile completeness · endorsements"
          : "Profile completeness · connections · activity";
  return {
    href: "/nex-native/settings/profile",
    emoji: "📊",
    title: "Account health & stats",
    subtitle,
  };
}

export default async function HomePage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const [profile, ownedBusinesses] = await Promise.all([
    accountProfileService.getProfileByAccountId(session.account.id).catch(() => null),
    businessService.listBusinessesByOwner(session.account.id).catch(() => []),
  ]);
  const kind = (profile?.kind ?? null) as NexAccountKind | null;
  const hasBusiness = ownedBusinesses.length > 0;

  const tiles: TileCopy[] = [
    {
      href: "/nex-native/chat",
      emoji: "💬",
      title: "Chat with friends",
      subtitle: "Friends · business · groups",
    },
    shopTile(kind, hasBusiness),
    healthTile(kind),
  ];

  const displayName = session.account.display_name || "there";
  const handle = session.account.nex_handle ?? null;

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        [data-nex-home-root] * { box-sizing: border-box; }
        [data-nex-home-tile]:hover {
          border-color: ${NEX.cyan};
          box-shadow: 0 0 24px rgba(0, 175, 255, 0.15);
        }
      `}</style>
      <main
        data-nex-home-root
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "16px 20px 32px",
          position: "relative",
          overflow: "hidden",
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

        <div style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>
          {/* Shared header · magnifier (search) · NEX wordmark · gear (settings) */}
          <NexPageHeader dataScope="home" />

          {/* Welcome line beneath the shared header */}
          <p
            style={{
              marginTop: 18,
              textAlign: "center",
              fontSize: 13,
              color: NEX.textSecondary,
            }}
          >
            Welcome back, <span style={{ color: NEX.textPrimary }}>{displayName}</span>
            {handle && (
              <>
                {" "}·{" "}
                <code style={{ fontFamily: "ui-monospace, monospace", color: NEX.cyan }}>
                  {handle}
                </code>
              </>
            )}
            .
          </p>

          {/* Three landscape doorways */}
          <div style={{ marginTop: 28, display: "grid", gap: 14 }}>
            {tiles.map((t, i) => (
              <Link
                key={i}
                href={t.href}
                data-nex-home-tile
                data-nex-home-tile-index={i + 1}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "18px 20px",
                  background: NEX.panel,
                  border: `1px solid ${NEX.cyanSoft}`,
                  borderRadius: 14,
                  textDecoration: "none",
                  color: NEX.textPrimary,
                  minHeight: 96,
                  transition: "border-color 200ms ease, box-shadow 200ms ease",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: NEX.cyanFaint,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 28,
                    lineHeight: 1,
                  }}
                >
                  {t.emoji}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 500,
                      letterSpacing: "0.005em",
                    }}
                  >
                    {t.title}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      color: NEX.textSecondary,
                      lineHeight: 1.4,
                    }}
                    dangerouslySetInnerHTML={{ __html: t.subtitle }}
                  />
                </div>
                <div
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    color: NEX.cyan,
                    fontSize: 20,
                    lineHeight: 1,
                  }}
                >
                  →
                </div>
              </Link>
            ))}
          </div>

          {/* Footer hint · reachable-elsewhere reassurance */}
          <p
            style={{
              marginTop: 22,
              textAlign: "center",
              fontSize: 11,
              color: NEX.textSecondary,
              lineHeight: 1.5,
            }}
          >
            Every doorway leads back here. Tap the NEX mark at the top of any
            page to come home.
          </p>
        </div>
      </main>
    </>
  );
}
