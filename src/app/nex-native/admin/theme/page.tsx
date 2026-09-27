// src/app/nex-native/admin/theme/page.tsx
//
// Bridge 4 · admin theme catalogue.
// ---------------------------------
// Lists every theme in nex_chat_theme and links to the builder for
// creating new ones. Dev-admin-only · gated by NEX_ALLOW_DEV_ADMIN=1
// AND caller session must be dev-admin@nex-native.local.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountService from "@/lib/nex-native/account-service";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.4)",
  orange: "#FF7200",
  green: "#16D66B",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
};

async function requireDevAdmin(): Promise<boolean> {
  if (process.env.NEX_ALLOW_DEV_ADMIN !== "1") return false;
  const session = await resolveNexAppSessionFromContext();
  if (!session) return false;
  const auth = await accountService.getAccountBySupabaseUserId(
    session.account.supabase_user_id!,
  );
  if (!auth?.supabase_user_id) return false;
  const authRow = await nexSupabaseAdmin.auth.admin.getUserById(
    auth.supabase_user_id,
  );
  if (authRow.error || !authRow.data.user) return false;
  return (
    (authRow.data.user.email ?? "").toLowerCase() ===
    "dev-admin@nex-native.local"
  );
}

export default async function AdminThemePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; m?: string }>;
}) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const isAdmin = await requireDevAdmin();
  if (!isAdmin) {
    return <ForbiddenScreen />;
  }

  const themes = await chatThemeService.listActiveThemes();
  const { standard, premium } = chatThemeService.groupByCategory(themes);
  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;

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
          padding: "24px 16px 40px",
        }}
      >
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <div style={{ marginBottom: 24 }}>
            <Link
              href="/nex-native"
              style={{
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: NEX.textDim,
                textDecoration: "none",
              }}
            >
              ← NEX
            </Link>
          </div>

          <h1
            style={{
              margin: "0 0 8px",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            Chat theme catalogue
          </h1>
          <p
            style={{
              margin: "0 0 24px",
              fontSize: 13,
              color: NEX.textDim,
              lineHeight: 1.55,
              maxWidth: 560,
            }}
          >
            Every theme users can pick from lives here.{" "}
            <strong style={{ color: NEX.text }}>Standard</strong> themes are
            free forever.{" "}
            <strong style={{ color: NEX.orange }}>Premium</strong> themes
            require an active NEX Bisnis subscription. Sealed doctrine ·{" "}
            <code
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 12,
                background: "rgba(255,255,255,0.06)",
                padding: "1px 4px",
                borderRadius: 3,
              }}
            >
              doctrine_theme_ownership_2026_09_27
            </code>
            .
          </p>

          {banner && <Banner banner={banner} />}

          <div style={{ marginBottom: 22 }}>
            <Link
              href="/nex-native/admin/theme/new"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 16px",
                borderRadius: 10,
                background: NEX.orange,
                color: "#0B0F1A",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.02em",
              }}
            >
              + Create new theme
            </Link>
          </div>

          <ThemeSection title="Standard · Gratis" themes={standard} />
          <ThemeSection title="Premium · NEX Bisnis" themes={premium} />
        </div>
      </main>
    </>
  );
}

function Banner({ banner }: { banner: { code: string; message: string } }) {
  const isSuccess =
    banner.code === "theme_created" || banner.code === "theme_updated";
  return (
    <div
      style={{
        marginBottom: 18,
        padding: "10px 14px",
        borderRadius: 10,
        background: isSuccess ? "rgba(22,214,107,0.14)" : "rgba(255,120,0,0.14)",
        border: `1px solid ${
          isSuccess ? "rgba(22,214,107,0.5)" : "rgba(255,120,0,0.5)"
        }`,
        color: NEX.text,
        fontSize: 12,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        aria-hidden
        style={{
          fontSize: 14,
          color: isSuccess ? NEX.green : NEX.orange,
          fontWeight: 700,
        }}
      >
        {isSuccess ? "✓" : "!"}
      </span>
      <span>{banner.message}</span>
    </div>
  );
}

function ThemeSection({
  title,
  themes,
}: {
  title: string;
  themes: chatThemeService.NexChatThemeRow[];
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
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        {themes.map((t) => (
          <ThemeCard key={t.id} theme={t} />
        ))}
      </div>
    </section>
  );
}

function ThemeCard({ theme }: { theme: chatThemeService.NexChatThemeRow }) {
  return (
    <div
      data-nex-admin-theme-card
      style={{
        padding: "14px 14px 12px",
        borderRadius: 14,
        background: NEX.panel,
        border: `1px solid ${NEX.cyanSoft}`,
        boxShadow: `0 0 0 1px ${theme.accent_hex}22 inset`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span
          aria-hidden
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: theme.accent_hex,
            boxShadow: `0 0 12px ${theme.accent_hex}66`,
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{theme.name}</div>
          <div style={{ fontSize: 11, color: NEX.textMute, fontFamily: "ui-monospace, monospace" }}>
            {theme.id} · {theme.accent_hex}
          </div>
        </div>
        <span
          style={{
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: 999,
            background:
              theme.tier === "bisnis"
                ? "rgba(255,120,0,0.18)"
                : "rgba(22,214,107,0.18)",
            color: theme.tier === "bisnis" ? NEX.orange : NEX.green,
          }}
        >
          {theme.tier}
        </span>
      </div>
      {theme.tagline && (
        <div
          style={{
            fontSize: 12,
            color: NEX.textDim,
            lineHeight: 1.45,
          }}
        >
          {theme.tagline}
        </div>
      )}
    </div>
  );
}

function ForbiddenScreen() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        display: "grid",
        placeItems: "center",
        padding: 32,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ maxWidth: 400, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          Dev-admin only
        </h1>
        <p style={{ marginTop: 8, fontSize: 13, color: NEX.textDim }}>
          Set{" "}
          <code
            style={{
              fontFamily: "ui-monospace, monospace",
              background: "rgba(255,255,255,0.06)",
              padding: "1px 4px",
              borderRadius: 3,
            }}
          >
            NEX_ALLOW_DEV_ADMIN=1
          </code>{" "}
          and sign in as dev-admin@nex-native.local.
        </p>
        <Link
          href="/nex-native"
          style={{
            display: "inline-block",
            marginTop: 18,
            padding: "10px 18px",
            borderRadius: 999,
            background: "rgba(0,175,255,0.15)",
            border: `1px solid ${NEX.cyan}`,
            color: NEX.text,
            textDecoration: "none",
            fontSize: 13,
          }}
        >
          ← Back to NEX
        </Link>
      </div>
    </main>
  );
}
