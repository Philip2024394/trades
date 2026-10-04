// src/app/nex-native/vault/settings/page.tsx
//
// Vault settings · Stage 2 scope: ONLY controls that are genuinely wired.
// No fake security, recovery, device-management or encryption settings
// (founder decision D4 · 2026-10-03).

import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { resolveVaultDoorwaySlug } from "../home/_resolve-theme";
import { NEX, GLASS, GLASS_CHIP } from "../home/_palette";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SettingsRow {
  key: string;
  title: string;
  description: string;
  href: string;
  external?: boolean;
}

const ROWS: SettingsRow[] = [
  {
    key: "door-theme",
    title: "Change your door theme",
    description:
      "The visual world you see when you unlock Vault. The inside of the Vault stays consistent across all themes.",
    href: "/nex-native/chat-themes-library",
  },
  {
    key: "lock-vault",
    title: "Lock Vault",
    description:
      "Return to the PIN entry doorway. Your rooms close until you unlock again.",
    href: "/nex-native/vault",
  },
  {
    key: "back-to-nex",
    title: "Return to NEX",
    description: "Leave Vault and go back to your main NEX surfaces.",
    href: "/nex-native/home",
  },
  {
    key: "terms",
    title: "About Vault",
    description: "What Vault does, what it does not do, and the honest limits.",
    href: "/nex-native/about/terms",
  },
];

export default async function VaultSettingsPage() {
  const themeSlug = await resolveVaultDoorwaySlug();
  if (!themeSlug) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/settings");
  }
  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        [data-nex-vault-settings] * { box-sizing: border-box; }
        [data-nex-vault-settings] a { text-decoration: none; color: inherit; }
      `}</style>
      <div
        data-nex-vault-settings
        data-nex-vault-theme-source={themeSlug}
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily: NEX.sans,
          position: "relative",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            background: NEX.bgGradient,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <SettingsHeader />
        <main
          id="main"
          style={{
            position: "relative",
            padding: "16px 16px 32px",
            maxWidth: 480,
            margin: "0 auto",
            zIndex: 1,
          }}
        >
          <section
            data-nex-vault-settings-list
            style={{
              marginTop: 8,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {ROWS.map((r) => (
              <Link
                key={r.key}
                href={r.href}
                data-nex-vault-settings-row={r.key}
                style={{
                  ...GLASS_CHIP,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "14px 16px",
                  borderRadius: 18,
                  minHeight: 64,
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 14.5,
                      fontWeight: 600,
                      color: NEX.textPrimary,
                    }}
                  >
                    {r.title}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      color: NEX.textSecondary,
                      marginTop: 4,
                      lineHeight: 1.4,
                    }}
                  >
                    {r.description}
                  </span>
                </span>
                <ChevronRight size={18} strokeWidth={1.8} color={NEX.textMuted} aria-hidden style={{ marginTop: 2 }} />
              </Link>
            ))}
          </section>

          <section
            data-nex-vault-honesty-footer
            aria-label="Honest limits"
            style={{
              ...GLASS,
              marginTop: 28,
              padding: "16px 18px",
              borderRadius: 16,
              fontSize: 11.5,
              color: NEX.textMuted,
              lineHeight: 1.55,
            }}
          >
            <p style={{ margin: 0, color: NEX.textSecondary, fontWeight: 600 }}>
              What this Vault is today
            </p>
            <p style={{ margin: "6px 0 0" }}>
              Vault uses your normal NEX account authentication. The six-digit
              PIN entry you unlocked with is currently a prototype — real PIN
              verification arrives with a later security stage. Rooms, chats
              and future files are treated as account-authenticated data, not
              yet protected by the PIN or end-to-end encryption.
            </p>
            <p style={{ margin: "10px 0 0" }}>
              Recovery, device management, and encryption controls will appear
              here when the real security architecture ships. Nothing fake
              lives on this screen.
            </p>
          </section>
        </main>
      </div>
    </>
  );
}

function SettingsHeader() {
  return (
    <header
      data-nex-vault-settings-header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        padding: "14px 16px 12px",
        background: "rgba(6, 4, 10, 0.72)",
        backdropFilter: NEX.backdropBlur,
        WebkitBackdropFilter: NEX.backdropBlur,
        borderBottom: `1px solid ${NEX.glassBorder}`,
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Link
          href="/nex-native/vault/home"
          aria-label="Back"
          data-nex-vault-settings-back
          style={{
            ...GLASS_CHIP,
            width: 38,
            height: 38,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: NEX.textPrimary,
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={18} strokeWidth={1.8} aria-hidden />
        </Link>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <h1
            data-nex-vault-settings-title
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "0.005em",
              color: NEX.textPrimary,
            }}
          >
            Vault settings
          </h1>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 11.5,
              color: NEX.textSecondary,
              letterSpacing: "0.005em",
            }}
          >
            Only genuinely implemented controls.
          </p>
        </div>
      </div>
    </header>
  );
}
