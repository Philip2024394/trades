// src/app/nex-native/vault/home/_room-shell.tsx
//
// Shared Vault room layout · glass-styled header + empty-state.
// Interior palette fixed per §10.0.2 (one-interior rule). Reads
// session.account.chat_theme as a data attribute so future hooks can
// read it without changing the shell contract. Current build does NOT
// re-skin per theme — the glass dark interior is the one interior.

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { NEX, GLASS, GLASS_CHIP } from "./_palette";

interface RoomShellProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  themeSlug?: string | null;
  children: React.ReactNode;
}

export function RoomShell({
  title,
  subtitle,
  backHref = "/nex-native/vault/home",
  themeSlug,
  children,
}: RoomShellProps) {
  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        [data-nex-vault-room] * { box-sizing: border-box; }
        [data-nex-vault-room] a { text-decoration: none; color: inherit; }
      `}</style>
      <div
        data-nex-vault-room
        data-nex-vault-theme-source={themeSlug ?? "none"}
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
        <RoomHeader title={title} subtitle={subtitle} backHref={backHref} />
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
          {children}
        </main>
      </div>
    </>
  );
}

function RoomHeader({
  title,
  subtitle,
  backHref,
}: {
  title: string;
  subtitle?: string;
  backHref: string;
}) {
  return (
    <header
      data-nex-vault-room-header
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
          href={backHref}
          aria-label="Back"
          data-nex-vault-room-back
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
            data-nex-vault-room-title
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "0.005em",
              color: NEX.textPrimary,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              data-nex-vault-room-subtitle
              style={{
                margin: "2px 0 0",
                fontSize: 11.5,
                color: NEX.textSecondary,
                letterSpacing: "0.005em",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------
// Empty-state primitive · glass card with modern icon.
// ---------------------------------------------------------------------

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message: string;
  footnote?: string;
}

export function EmptyState({ icon, title, message, footnote }: EmptyStateProps) {
  return (
    <div
      data-nex-vault-empty-state
      style={{
        marginTop: 32,
        padding: "28px 20px 24px",
        borderRadius: 20,
        textAlign: "center",
        ...GLASS,
      }}
    >
      <div
        aria-hidden
        style={{
          margin: "0 auto 20px",
          width: 72,
          height: 72,
          borderRadius: 999,
          background: NEX.accentSoft,
          color: NEX.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${NEX.accentStrong}`,
        }}
      >
        {icon}
      </div>
      <h2
        style={{
          margin: 0,
          fontSize: 17,
          fontWeight: 600,
          color: NEX.textPrimary,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: "10px auto 0",
          fontSize: 13.5,
          color: NEX.textSecondary,
          lineHeight: 1.45,
          maxWidth: 320,
        }}
      >
        {message}
      </p>
      {footnote && (
        <p
          data-nex-vault-empty-footnote
          style={{
            margin: "16px auto 0",
            fontSize: 11.5,
            color: NEX.textMuted,
            lineHeight: 1.45,
            maxWidth: 320,
            fontStyle: "italic",
          }}
        >
          {footnote}
        </p>
      )}
    </div>
  );
}
