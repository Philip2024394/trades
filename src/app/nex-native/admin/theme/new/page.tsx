// src/app/nex-native/admin/theme/new/page.tsx
//
// Bridge 4 · new theme builder.
// -----------------------------
// Dev-admin form for creating a new nex_chat_theme row. Live preview
// panel on the right shows how the accent will paint an outgoing +
// incoming bubble pair.
//
// Fields:
//   · slug (id)          · lowercase alphanumeric+_-, must be unique
//   · display name       · shown in the picker
//   · tagline            · short marketing line
//   · accent (hex)       · drives bubble rims, composer, ripple
//   · tier               · gratis (free) | bisnis (premium)
//   · category           · standard | premium
//   · hero image URL     · optional (for future portrait / background
//                          variants; upload pipeline lands later)
//   · sort order         · lower = shows first in picker

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountService from "@/lib/nex-native/account-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { adminCreateChatThemeAction } from "../../../_actions";
import { ThemePreviewClient } from "./_theme-preview-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  fieldBg: "rgba(4,20,36,0.85)",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.4)",
  orange: "#FF7200",
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

export default async function NewThemePage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const isAdmin = await requireDevAdmin();
  if (!isAdmin) redirect("/nex-native/admin/theme");

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
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ marginBottom: 20 }}>
            <Link
              href="/nex-native/admin/theme"
              style={{
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: NEX.cyan,
                textDecoration: "none",
              }}
            >
              ← Theme catalogue
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
            Create a chat theme
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
            Themes here become available for every NEX account to pick from
            in <code style={monoStyle}>/settings/theme</code>. Premium
            themes require an active NEX Bisnis subscription. All fields
            except image URL are required.
          </p>

          <ThemePreviewClient action={adminCreateChatThemeAction} />
        </div>
      </main>
    </>
  );
}

const monoStyle: React.CSSProperties = {
  fontFamily: "ui-monospace, monospace",
  fontSize: 12,
  background: "rgba(255,255,255,0.06)",
  padding: "1px 4px",
  borderRadius: 3,
};
