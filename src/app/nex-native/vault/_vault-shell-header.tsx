// src/app/nex-native/vault/_vault-shell-header.tsx
//
// Shared Vault chrome header · brand chip + 3 cyan-outlined icons.
// Replicated across:
//   /nex-native/vault              (locked doorway)
//   /nex-native/vault/settings     (settings list)
//   /nex-native/vault/settings/*   (devices / recovery / rotate)
//
// Mirrors the setup-step header's visual language so every Vault
// surface reads as the same product.
//
// Server-safe · uses next/link for navigation · zero client state.
// Setup still uses its own client-side version so the Home icon
// can run the lock-and-leave overlay before router.push.

import Link from "next/link";
import type { I18nKey } from "@/lib/nex/i18n/keys";
import { NEX } from "./home/_palette";

interface VaultShellHeaderProps {
  t: (k: I18nKey) => string;
  homeHref?: string;
  settingsHref?: string;
}

export function VaultShellHeader({
  t,
  homeHref = "/nex-native/vault/home",
  settingsHref = "/nex-native/vault/settings",
}: VaultShellHeaderProps) {
  return (
    <header
      data-nex-vault-shell-header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 20px",
        background:
          "linear-gradient(180deg, rgba(2,9,20,0.72) 0%, rgba(2,9,20,0) 100%)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <span
        data-nex-vault-shell-brand
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 6,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: NEX.textPrimary,
        }}
      >
        <span style={{ color: NEX.accent }}>NEX</span>
        <span>VAULT</span>
      </span>
      <nav
        aria-label={t("vault.setup.header.settingsLabel")}
        style={{ display: "flex", alignItems: "center", gap: 10 }}
      >
        <IconLink
          href={homeHref}
          label={t("vault.setup.header.homeLabel")}
          data-nex-vault-shell-home
        >
          <HomeGlyph />
        </IconLink>
        <IconStatic
          label={t("vault.setup.header.lockIndicator")}
          data-nex-vault-shell-lock-indicator
        >
          <LockGlyph />
        </IconStatic>
        <IconLink
          href={settingsHref}
          label={t("vault.setup.header.settingsLabel")}
          data-nex-vault-shell-settings
        >
          <GearGlyph />
        </IconLink>
      </nav>
    </header>
  );
}

const ICON_STYLE: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 999,
  border: `1px solid ${NEX.secureStrong}`,
  background: "transparent",
  color: NEX.secure,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  textDecoration: "none",
  fontFamily: "inherit",
};

function IconLink({
  href,
  label,
  children,
  ...rest
}: {
  href: string;
  label: string;
  children: React.ReactNode;
} & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      style={{ ...ICON_STYLE, cursor: "pointer" }}
      {...rest}
    >
      {children}
    </Link>
  );
}

function IconStatic({
  label,
  children,
  ...rest
}: {
  label: string;
  children: React.ReactNode;
} & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <div
      aria-label={label}
      title={label}
      style={ICON_STYLE}
      {...rest}
    >
      {children}
    </div>
  );
}

function HomeGlyph() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function GearGlyph() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
