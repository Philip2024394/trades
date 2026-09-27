// src/app/nex-native/settings/theme/page.tsx
//
// Chat theme picker · Bridge 4.
// -----------------------------
// Reads every active theme from nex_chat_theme (migration 048), splits
// them into "Your themes" (gratis · always usable) and "NEX Bisnis"
// (premium · unlocked when the caller has an active bisnis tier).
//
// Doctrine · doctrine_theme_ownership_2026_09_27.md:
//   Your chat_theme is your PUBLIC visual identity. Every friend
//   sees your theme when they open your chat. Free tier gets base
//   themes · Bisnis unlocks premium.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { effectiveTier } from "@/lib/nex-native/account-service";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { updateChatThemeAction } from "../../_actions";
import type { NexAccountRow } from "@/lib/nex-native/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.4)",
  orange: "#FF7800",
  green: "#16D66B",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
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

  const themes = await chatThemeService.listActiveThemes();
  const { standard, premium } = chatThemeService.groupByCategory(themes);

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
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ marginBottom: 16 }}>
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
            Your chat theme
          </h1>
          <p
            style={{
              margin: "0 0 18px",
              fontSize: 13,
              color: NEX.textDim,
              lineHeight: 1.55,
              maxWidth: 520,
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
              style={{
                marginBottom: 16,
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
              role="status"
            >
              {isSuccess
                ? `Theme saved · ${banner.message}`
                : banner.message}
            </div>
          )}

          <ThemeSection
            title="Your themes"
            subtitle="Free forever · yours to keep"
            themes={standard}
            currentThemeId={currentThemeId}
            canUse
          />

          <ThemeSection
            title="NEX Bisnis · premium"
            subtitle={
              canUsePremium
                ? "Included with your Bisnis subscription"
                : "Unlock all premium themes with NEX Bisnis"
            }
            themes={premium}
            currentThemeId={currentThemeId}
            canUse={canUsePremium}
          />
        </div>
      </main>
    </>
  );
}

function ThemeSection({
  title,
  subtitle,
  themes,
  currentThemeId,
  canUse,
}: {
  title: string;
  subtitle: string;
  themes: chatThemeService.NexChatThemeRow[];
  currentThemeId: string;
  canUse: boolean;
}) {
  if (themes.length === 0) return null;
  return (
    <section style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: NEX.textDim,
          fontWeight: 600,
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: 3,
          marginBottom: 10,
          fontSize: 12,
          color: NEX.textMute,
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 10,
        }}
      >
        {themes.map((t) => (
          <ThemeCard
            key={t.id}
            theme={t}
            active={t.id === currentThemeId}
            locked={!canUse}
          />
        ))}
      </div>
    </section>
  );
}

function ThemeCard({
  theme,
  active,
  locked,
}: {
  theme: chatThemeService.NexChatThemeRow;
  active: boolean;
  locked: boolean;
}) {
  if (locked) {
    return (
      <Link
        href="/nex-native/settings/tier"
        style={{
          display: "block",
          padding: "12px 12px 10px",
          borderRadius: 14,
          background: NEX.panel,
          border: `1px solid rgba(255,120,0,0.35)`,
          color: NEX.text,
          textDecoration: "none",
          opacity: 0.85,
        }}
      >
        <ThemeSwatch theme={theme} />
        <div
          style={{
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <LockIcon />
          <span>{theme.name}</span>
        </div>
        {theme.tagline && (
          <div
            style={{
              marginTop: 2,
              fontSize: 10,
              color: NEX.textDim,
              lineHeight: 1.4,
            }}
          >
            {theme.tagline}
          </div>
        )}
        <div
          style={{
            marginTop: 8,
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: NEX.orange,
            fontWeight: 700,
          }}
        >
          Upgrade to unlock →
        </div>
      </Link>
    );
  }
  return (
    <form action={updateChatThemeAction}>
      <input type="hidden" name="chat_theme" value={theme.id} />
      <button
        type="submit"
        disabled={active}
        aria-pressed={active}
        style={{
          display: "block",
          width: "100%",
          padding: "12px 12px 10px",
          borderRadius: 14,
          background: NEX.panel,
          border: active
            ? `1px solid ${theme.accent_hex}`
            : `1px solid ${NEX.cyanSoft}`,
          color: NEX.text,
          textAlign: "left",
          cursor: active ? "default" : "pointer",
          boxShadow: active
            ? `0 0 18px ${theme.accent_hex}33`
            : "none",
        }}
      >
        <ThemeSwatch theme={theme} />
        <div
          style={{
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>{theme.name}</span>
          {active && (
            <span
              style={{
                fontSize: 9,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 999,
                background: `${theme.accent_hex}33`,
                color: theme.accent_hex,
              }}
            >
              Active
            </span>
          )}
        </div>
        {theme.tagline && (
          <div
            style={{
              marginTop: 2,
              fontSize: 10,
              color: NEX.textDim,
              lineHeight: 1.4,
            }}
          >
            {theme.tagline}
          </div>
        )}
      </button>
    </form>
  );
}

function ThemeSwatch({
  theme,
}: {
  theme: chatThemeService.NexChatThemeRow;
}) {
  return (
    <div
      style={{
        height: 72,
        borderRadius: 10,
        background: NEX.bg,
        border: "1px solid rgba(255,255,255,0.06)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 12,
          left: 10,
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: theme.accent_hex,
          boxShadow: `0 0 18px ${theme.accent_hex}66`,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 14,
          right: 10,
          left: 54,
          height: 20,
          borderRadius: 10,
          background: "rgba(8,20,36,0.55)",
          border: `1px solid ${theme.accent_hex}80`,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: 12,
          left: 30,
          right: 10,
          height: 18,
          borderRadius: 9,
          background: "rgba(12,32,58,0.62)",
          border: `1px solid ${theme.accent_hex}D9`,
        }}
      />
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 118 0v4" />
    </svg>
  );
}
