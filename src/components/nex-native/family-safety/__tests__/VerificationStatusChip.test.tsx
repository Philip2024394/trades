// src/components/nex-native/family-safety/__tests__/VerificationStatusChip.test.tsx

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { VerificationStatusChip } from "../VerificationStatusChip";

describe("VerificationStatusChip · state → tone/label map", () => {
  it("maps 'id_pending_verification' to 'pending' tone", () => {
    const html = renderToStaticMarkup(
      <VerificationStatusChip state="id_pending_verification" />,
    );
    expect(html).toContain('data-nex-family-safety-status-chip-tone="pending"');
    expect(html).toContain("Verifying ID");
  });

  it("maps 'awaiting_legal_clearance' to 'pending' tone", () => {
    const html = renderToStaticMarkup(
      <VerificationStatusChip state="awaiting_legal_clearance" />,
    );
    expect(html).toContain('data-nex-family-safety-status-chip-tone="pending"');
    expect(html).toContain("Awaiting legal clearance");
  });

  it("maps 'id_verified' to 'info' tone", () => {
    const html = renderToStaticMarkup(
      <VerificationStatusChip state="id_verified" />,
    );
    expect(html).toContain('data-nex-family-safety-status-chip-tone="info"');
  });

  it("maps 'account_created' to 'active' tone", () => {
    const html = renderToStaticMarkup(
      <VerificationStatusChip state="account_created" />,
    );
    expect(html).toContain('data-nex-family-safety-status-chip-tone="active"');
  });

  it("maps 'id_rejected' to 'revoked' tone", () => {
    const html = renderToStaticMarkup(
      <VerificationStatusChip state="id_rejected" />,
    );
    expect(html).toContain('data-nex-family-safety-status-chip-tone="revoked"');
  });

  it("maps 'cancelled' / 'expired' to 'expired' tone", () => {
    for (const s of ["cancelled", "expired"] as const) {
      const html = renderToStaticMarkup(<VerificationStatusChip state={s} />);
      expect(html).toContain(
        'data-nex-family-safety-status-chip-tone="expired"',
      );
    }
  });
});
