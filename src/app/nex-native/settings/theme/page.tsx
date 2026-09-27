// src/app/nex-native/settings/theme/page.tsx
//
// User-facing chat theme browser · Bridge 4.
// ------------------------------------------
// Server component · fetches every active theme + resolves the caller's
// effective tier + current active theme id, then hands over to the
// client browser (search / filter / grid / enlarge preview).
//
// Doctrine · doctrine_theme_ownership_2026_09_27.md.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { effectiveTier } from "@/lib/nex-native/account-service";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { updateChatThemeAction } from "../../_actions";
import type { NexAccountRow } from "@/lib/nex-native/types";
import { ThemeBrowserClient, type BrowserThemeRow } from "./_theme-browser-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  cyan: "#00AFFF",
  orange: "#FF7800",
  green: "#16D66B",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
};

const SUCCESS_CODES = new Set(["theme_updated"]);

export default async function ThemePickerPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; m?: string }>;
}) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  // Read tier + current theme from the latest DB row (session may be stale).
  const row = await nexSupabaseAdmin
    .from("nex_account")
    .select("tier, bisnis_expires_at, chat_theme")
    .eq("id", session.account.id)
    .maybeSingle();
  const account = (row.data ?? {}) as Pick<
    NexAccountRow,
    "tier" | "bisnis_expires_at" | "chat_theme"
  >;
  const currentTier = effectiveTier(account);
  const currentThemeId = account.chat_theme ?? "default";
  const canUsePremium = currentTier === "bisnis" || currentTier === "pro";

  // Viewer's own profile photo · used by themes that don't ship
  // their own hero_image_url (Rose · Origin · etc.) to preview the
  // Portrait Bloom mechanic with the viewer's actual face.
  const viewerAvatarUrl = await (async () => {
    try {
      const svc = await import("@/lib/nex-native/account-profile-service");
      const profile = await svc.getProfileByAccountId(session.account.id);
      return profile?.avatar_url ?? null;
    } catch {
      return null;
    }
  })();

  const themes = await chatThemeService.listActiveThemes();
  const browserThemes: BrowserThemeRow[] = themes.map((t) => ({
    id: t.id,
    name: t.name,
    tagline: t.tagline,
    accent_hex: t.accent_hex,
    tier: t.tier,
    category: t.category,
    hero_image_url: t.hero_image_url,
    sort_order: t.sort_order,
  }));

  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const isSuccess = banner ? SUCCESS_CODES.has(banner.code) : false;

  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "20px 16px 40px",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ marginBottom: 14 }}>
            <Link
              href="/nex-native/settings"
              style={{
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: NEX.cyan,
                textDecoration: "none",
              }}
            >
              ← Settings
            </Link>
          </div>

          <h1
            style={{
              margin: "0 0 6px",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            NEX Themes
          </h1>
          <p
            style={{
              margin: "0 0 18px",
              fontSize: 13,
              color: NEX.textDim,
              lineHeight: 1.55,
            }}
          >
            Every friend sees YOUR theme when they open your chat. Free
            themes are yours forever. Premium themes unlock with{" "}
            <Link
              href="/nex-native/settings/tier"
              style={{ color: NEX.orange, textDecoration: "underline" }}
            >
              NEX Bisnis
            </Link>
            .
          </p>

          {banner && (
            <div
              role="status"
              style={{
                marginBottom: 14,
                padding: "10px 14px",
                borderRadius: 10,
                background: isSuccess
                  ? "rgba(22,214,107,0.14)"
                  : "rgba(255,120,0,0.14)",
                border: `1px solid ${
                  isSuccess ? "rgba(22,214,107,0.5)" : "rgba(255,120,0,0.5)"
                }`,
                color: NEX.text,
                fontSize: 12,
              }}
            >
              {isSuccess
                ? `Theme saved · ${banner.message}`
                : banner.message}
            </div>
          )}

          <ThemeBrowserClient
            themes={browserThemes}
            currentThemeId={currentThemeId}
            canUsePremium={canUsePremium}
            activateAction={updateChatThemeAction}
            viewerAvatarUrl={viewerAvatarUrl}
          />
        </div>
      </main>
    </>
  );
}
