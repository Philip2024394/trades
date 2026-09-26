// src/app/nex-native/_page-header.tsx
//
// Shared NEX-native page header · applied to EVERY dark-navy surface.
// -------------------------------------------------------------------------
//   · Left  · NEX wordmark → /nex-native (session-aware router: signed-in
//              lands on /home, signed-out lands on /create-account)
//   · Right · magnifying glass → /nex-native/search (Directory)
//            gear             → /nex-native/settings
//
// Server Component · no hooks · uses inline styles keyed to the NEX
// dark-navy palette. Signed-out pages that render the header link the
// icons at auth-gated destinations · following them just bounces the
// visitor to /sign-in, which is the correct behaviour.

import Link from "next/link";

const NEX = {
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
};

interface NexPageHeaderProps {
  /** Optional data-attr for tests / analytics. */
  dataScope?: string;
}

export function NexPageHeader({ dataScope }: NexPageHeaderProps) {
  return (
    <header
      data-nex-page-header
      data-nex-page-header-scope={dataScope}
      style={{
        paddingTop: "max(env(safe-area-inset-top, 0px), 8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <Link
        href="/nex-native"
        aria-label="NEX home"
        data-nex-page-header-brand
        style={{
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "baseline",
          gap: 2,
          fontSize: 22,
          lineHeight: 1,
          letterSpacing: "0.08em",
          fontWeight: 600,
        }}
      >
        <span style={{ color: NEX.textPrimary }}>NE</span>
        <span style={{ color: NEX.orange }}>X</span>
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link
          href="/nex-native/search"
          aria-label="NEX Directory search"
          data-nex-page-header-search
          style={iconLinkStyle}
        >
          <SearchIcon />
        </Link>
        <Link
          href="/nex-native/settings"
          aria-label="Settings"
          data-nex-page-header-settings
          style={iconLinkStyle}
        >
          <GearIcon />
        </Link>
      </div>
    </header>
  );
}

const iconLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 40,
  height: 40,
  borderRadius: "50%",
  border: `1px solid ${NEX.cyanSoft}`,
  background: "transparent",
  color: NEX.cyan,
  textDecoration: "none",
};

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      width="18"
      height="18"
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
