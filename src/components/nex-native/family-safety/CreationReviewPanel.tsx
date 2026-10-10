// src/components/nex-native/family-safety/CreationReviewPanel.tsx
//
// NEX Family Safety · wizard step 3 · review + submit panel.
// Authored by CC-2 2026-10-10.
// -----------------------------------------------------------
// Server-safe presentation of the request so far. The action buttons
// are a thin "use client" island that calls server actions. The panel
// renders ONLY opaque metadata · no file bytes, no plaintext ID
// numbers.
//
// Load-bearing anti-patterns:
//   · Do NOT render the uploaded document inline here · we show the
//     filename only.
//   · Do NOT echo the child's name in the "Submit" button label.

import * as React from "react";
import { FAMILY_SAFETY_PALETTE } from "./_palette";
import { CreationReviewActions } from "./CreationReviewActions";
import type { ChildCreationRequestRowUi as ChildCreationRequestRow } from "@/lib/nex-native/family-safety/child-account-creation/ui-tokens";

export interface CreationReviewPanelProps {
  readonly request: ChildCreationRequestRow;
  readonly ageYears: number;
}

const DOCUMENT_TYPE_LABELS: Readonly<Record<string, string>> = {
  kk: "KK (Kartu Keluarga)",
  birth_certificate: "Birth certificate",
  akta: "Akta Kelahiran",
  passport: "Passport",
  other: "Other government ID",
};

export function CreationReviewPanel({
  request,
  ageYears,
}: CreationReviewPanelProps): React.JSX.Element {
  const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 12px",
    background: FAMILY_SAFETY_PALETTE.surface,
    border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
    borderRadius: 10,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: FAMILY_SAFETY_PALETTE.textDim,
  };
  const valueStyle: React.CSSProperties = {
    fontSize: 14,
    color: FAMILY_SAFETY_PALETTE.textPrimary,
    fontWeight: 600,
    textAlign: "right",
  };

  return (
    <div
      data-nex-family-safety-creation-review="true"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        background: FAMILY_SAFETY_PALETTE.surfaceMuted,
        border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
        borderRadius: 14,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: FAMILY_SAFETY_PALETTE.textPrimary,
        }}
      >
        Review your submission
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={rowStyle}>
          <span style={labelStyle}>Child's name</span>
          <span style={valueStyle} data-testid="nex-fs-review-name">
            {request.childDisplayName}
          </span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Date of birth</span>
          <span style={valueStyle} data-testid="nex-fs-review-dob">
            {request.childDeclaredDateOfBirth}
          </span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Calculated age</span>
          <span style={valueStyle} data-testid="nex-fs-review-age">
            {ageYears} years
          </span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Document</span>
          <span style={valueStyle} data-testid="nex-fs-review-doc">
            {request.documentType
              ? DOCUMENT_TYPE_LABELS[request.documentType] ?? request.documentType
              : "—"}
          </span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>File</span>
          <span style={valueStyle} data-testid="nex-fs-review-file">
            {request.documentFilename ?? "—"}
          </span>
        </div>
      </div>

      <p
        style={{
          fontSize: 12,
          color: FAMILY_SAFETY_PALETTE.textSecondary,
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        Submitting sends your request for ID verification. Verification is
        performed by a NEX reviewer · usually within 1-3 business days once a
        verifier is online. You can cancel until the review completes.
      </p>

      <CreationReviewActions requestId={request.requestId} />
    </div>
  );
}
