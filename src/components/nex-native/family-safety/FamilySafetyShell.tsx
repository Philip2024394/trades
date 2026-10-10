// src/components/nex-native/family-safety/FamilySafetyShell.tsx
//
// NEX Family Safety · shared shell layout · authored 2026-10-10.
// --------------------------------------------------------------
// Wraps every Family Safety page with a consistent chrome:
//   · NexPageHeader (sealed shared header · home · search · gear)
//   · Breadcrumb-style back-to-settings link
//   · Section header with the "Family Safety" title and the sealed
//     SIMULATED · PILOT badge
//   · FamilySafetyNav (nav chips)
//   · Child content
//
// Shared by FS-1 home + FS-2 setup/invite/accept + FS-3 dashboard/
// safechat + FS-4 subscription surfaces. Each page passes its
// `activeNav` so the chip strip stays in sync.
//
// Load-bearing anti-patterns:
//   · Do NOT bypass this shell on any Family Safety route · the
//     Settings back-link + pilot badge + nav chips are user-safety
//     anchors.
//   · Do NOT re-style the shell per sub-surface. If a sub-surface
//     needs more vertical space, it owns its inner content region.

import * as React from "react";
import Link from "next/link";
import { NexPageHeader } from "@/app/nex-native/_page-header";
import { FAMILY_SAFETY_FONT, FAMILY_SAFETY_PALETTE } from "./_palette";
import { FamilySafetyNav } from "./FamilySafetyNav";
import { SimulatedPilotBadge } from "./SimulatedPilotBadge";
import type { FamilySafetyShellProps } from "./types";

export function FamilySafetyShell({
  children,
  activeNav,
  subtitle,
}: FamilySafetyShellProps): React.JSX.Element {
  return (
    <>
      <style>{`html, body { background: ${FAMILY_SAFETY_PALETTE.bg} !important; }`}</style>
      <main
        data-nex-family-safety-shell="true"
        data-nex-family-safety-shell-active={activeNav ?? "none"}
        style={{
          minHeight: "100dvh",
          background: FAMILY_SAFETY_PALETTE.bg,
          color: FAMILY_SAFETY_PALETTE.textPrimary,
          fontFamily: FAMILY_SAFETY_FONT,
          padding: "16px 20px 40px",
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
              "radial-gradient(60% 40% at 50% 0%, rgba(34,197,94,0.06), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "relative",
            maxWidth: 760,
            margin: "0 auto",
          }}
        >
          <NexPageHeader dataScope="family-safety" />

          <div style={{ marginTop: 14, marginBottom: 10 }}>
            <Link
              href="/nex-native/settings"
              prefetch={false}
              data-nex-family-safety-back="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: FAMILY_SAFETY_PALETTE.textDim,
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              ← Settings
            </Link>
          </div>

          <header
            data-nex-family-safety-header="true"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              padding: "6px 0 10px",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "0.005em",
                color: FAMILY_SAFETY_PALETTE.textPrimary,
              }}
            >
              Family Safety
            </h1>
            <SimulatedPilotBadge size="sm" />
          </header>
          {subtitle ? (
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 13,
                color: FAMILY_SAFETY_PALETTE.textSecondary,
                lineHeight: 1.5,
              }}
            >
              {subtitle}
            </p>
          ) : null}

          <FamilySafetyNav active={activeNav} />

          <div data-nex-family-safety-content="true">{children}</div>
        </div>
      </main>
    </>
  );
}
