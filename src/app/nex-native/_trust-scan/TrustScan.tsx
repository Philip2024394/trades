"use client";

// src/app/nex-native/_trust-scan/TrustScan.tsx
//
// NEX Trust Scan · Phase 1 orchestrator · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// Theme-neutral entry point for the scan feature. Owns the sequence
// (cinematic reveal → four-block report → dismiss) and consumes the
// typed TrustScanData returned by the provider. ALL skinning passes
// through the `skin` prop — this file contains zero Joker-specific copy
// or styling.
//
// Lifecycle:
//   1. mount           · provider.fetch() starts, cinematic reveal runs
//   2. reveal complete · fetched? → render report. not fetched? → wait.
//   3. user hits Dismiss · onDismiss() fires, host unmounts the overlay.
//
// Doctrine disclaimer footer is required · see
// nex_trust_scan_doctrine_2026_10_01.md.

import * as React from "react";
import { TrustScanReveal } from "./TrustScanReveal";
import { TrustScanIdentity } from "./TrustScanIdentity";
import { TrustScanHistory } from "./TrustScanHistory";
import { TrustScanTrading } from "./TrustScanTrading";
import { TrustScanRelationship } from "./TrustScanRelationship";
import { TrustScanSignals } from "./TrustScanSignals";
import type {
  TrustScanData,
  TrustScanProvider,
  TrustScanSkin,
} from "./trust-scan-types";

export interface TrustScanProps {
  scannedAccountId: string;
  viewerAccountId: string | null;
  skin: TrustScanSkin;
  provider: TrustScanProvider;
  onDismiss: () => void;
}

type Stage = "cinematic" | "report";

export function TrustScan({
  scannedAccountId,
  viewerAccountId,
  skin,
  provider,
  onDismiss,
}: TrustScanProps): React.JSX.Element {
  const [stage, setStage] = React.useState<Stage>("cinematic");
  const [data, setData] = React.useState<TrustScanData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Kick off the fetch as soon as the scan mounts · runs in parallel
  // with the ~4.5s cinematic so by the time the ring finishes the data
  // is usually already in state.
  React.useEffect(() => {
    let cancelled = false;
    provider
      .fetch({ scannedAccountId, viewerAccountId })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Scan failed.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [provider, scannedAccountId, viewerAccountId]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="NEX Trust Scan"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10001,
        overflow: "hidden",
        background: skin.colors.background,
        color: skin.colors.textPrimary,
        fontFamily: skin.fontMono,
        display: "flex",
        flexDirection: "column",
        animation: "trust-scan-stage-in 320ms cubic-bezier(.2,.7,.2,1) both",
      }}
    >
      <style>{`
        @keyframes trust-scan-stage-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {/* Persistent soft rim · frames the whole scan surface in the
          skin's accent, independent of which stage is active. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 55%, ${skin.colors.accent}22 100%)`,
          pointerEvents: "none",
        }}
      />

      {stage === "cinematic" && (
        <TrustScanReveal
          skin={skin}
          data={data}
          onDone={() => setStage("report")}
        />
      )}

      {stage === "report" && (
        <ReportView
          data={data}
          error={error}
          skin={skin}
          onDismiss={onDismiss}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report view · four blocks + signals + disclaimer + dismiss
// ---------------------------------------------------------------------------
function ReportView({
  data,
  error,
  skin,
  onDismiss,
}: {
  data: TrustScanData | null;
  error: string | null;
  skin: TrustScanSkin;
  onDismiss: () => void;
}): React.JSX.Element {
  // If the fetch rejected, show the error line in the report shell.
  if (error) {
    return (
      <div
        style={{
          position: "relative",
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            textAlign: "center",
            color: skin.colors.danger,
            fontSize: 13,
            maxWidth: 320,
            lineHeight: 1.4,
          }}
        >
          Scan could not complete: {error}
        </div>
        <DismissButton onDismiss={onDismiss} skin={skin} />
      </div>
    );
  }

  // Still loading after the cinematic finished · rare, but gracefully
  // handled with a quiet "finalising" state.
  if (!data) {
    return (
      <div
        style={{
          position: "relative",
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            color: skin.colors.textMuted,
            fontSize: 11,
            letterSpacing: "0.22em",
            fontFamily: skin.fontMono,
          }}
        >
          FINALISING SCAN…
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "22px 18px 18px",
        overflowY: "auto",
        animation: "trust-scan-stage-in 420ms cubic-bezier(.2,.7,.2,1) both",
      }}
    >
      {/* HEADER · skin-controlled eyebrow + sealed sub-title */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div style={{ flexShrink: 0 }}>{skin.headerGlyph}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: skin.colors.accent,
              fontSize: 9,
              letterSpacing: "0.3em",
              fontWeight: 700,
              textShadow: `0 0 10px ${skin.colors.accent}99`,
            }}
          >
            {skin.headerEyebrow}
          </div>
          <div
            style={{
              marginTop: 3,
              color: skin.colors.textPrimary,
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.2,
              fontFamily: skin.fontDisplay,
              letterSpacing: "0.01em",
            }}
          >
            What should I know before interacting with this account?
          </div>
          <div
            style={{
              marginTop: 4,
              color: skin.colors.textMuted,
              fontSize: 11,
              letterSpacing: "0.02em",
            }}
          >
            Scanning <strong style={{ color: skin.colors.textPrimary }}>{data.displayName}</strong>
          </div>
        </div>
      </header>

      {/* BLOCKS · stacked · each is a self-contained section */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <TrustScanIdentity data={data.identity} skin={skin} />
        <TrustScanHistory data={data.history} skin={skin} />
        <TrustScanTrading data={data.trading} skin={skin} />
        <TrustScanRelationship data={data.relationship} skin={skin} />
        <TrustScanSignals signals={data.signals} skin={skin} />
      </div>

      {/* IN-PRODUCT SHORT NOTICE · founder-sealed 2026-10-01. Full
          language lives in Terms of Use § 13 at /nex-native/about/terms.
          If a future change strips the "not a guarantee" line, reject
          it · the acceptance gate requires it on every scan surface. */}
      <div
        style={{
          marginTop: 18,
          padding: "12px 14px",
          borderRadius: 12,
          background: "rgba(0,0,0,0.32)",
          border: `1px dashed ${skin.colors.rim}`,
          color: skin.colors.textMuted,
          fontSize: 11,
          lineHeight: 1.5,
          letterSpacing: "0.015em",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            color: skin.colors.textPrimary,
            fontSize: 12,
            letterSpacing: "0.02em",
            marginBottom: 6,
            fontFamily: skin.fontDisplay,
          }}
        >
          Your safety matters
        </div>
        <p style={{ margin: "0 0 6px" }}>
          NEX Trust Scan shows relevant account, trading, verification,
          and community-safety signals to help you make informed
          decisions when communicating or trading with another user.
        </p>
        <p style={{ margin: "0 0 6px" }}>
          NEX uses these signals for safety, fraud prevention, dispute
          handling, and related trust functions. A Trust Scan is not a
          guarantee that an interaction or transaction is safe.
        </p>
        <p style={{ margin: "0 0 6px" }}>
          You decide what the information means for your interaction.
        </p>
        <a
          href="/nex-native/about/terms#section-13"
          target="_blank"
          rel="noopener"
          style={{
            display: "inline-block",
            marginTop: 4,
            color: skin.colors.accent,
            textDecoration: "none",
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          Read NEX Safe Community & Trust →
        </a>
      </div>

      <DismissButton onDismiss={onDismiss} skin={skin} />
    </div>
  );
}

function DismissButton({
  onDismiss,
  skin,
}: {
  onDismiss: () => void;
  skin: TrustScanSkin;
}): React.JSX.Element {
  return (
    <div
      style={{
        marginTop: 18,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <button
        type="button"
        onClick={onDismiss}
        style={{
          background: `linear-gradient(180deg, ${skin.colors.accent}33 0%, ${skin.colors.accent}1c 100%)`,
          border: `1px solid ${skin.colors.accent}aa`,
          color: skin.colors.textPrimary,
          padding: "10px 24px",
          borderRadius: 999,
          fontSize: 10,
          letterSpacing: "0.26em",
          textTransform: "uppercase",
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: `0 0 22px ${skin.colors.accent}4a`,
          fontFamily: skin.fontMono,
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
