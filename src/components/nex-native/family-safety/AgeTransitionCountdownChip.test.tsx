// src/components/nex-native/family-safety/AgeTransitionCountdownChip.test.tsx
//
// CC-3 · Age-transition countdown chip rendering tests. SSR via
// renderToStaticMarkup to match the sealed Family Safety component
// test pattern · no jsdom, no DOM interaction. Pure structural
// assertions.

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AgeTransitionCountdownChip } from "./AgeTransitionCountdownChip";

describe("AgeTransitionCountdownChip", () => {
  it("renders neutral tone when more than 30 days remain", () => {
    const html = renderToStaticMarkup(
      <AgeTransitionCountdownChip
        autoTransferAt="2027-04-01T00:00:00.000Z"
        nowIso="2026-10-10T00:00:00.000Z"
        transferredAt={null}
      />,
    );
    expect(html).toMatch(
      /data-nex-family-safety-status-chip-tone="neutral"/,
    );
    expect(html).toMatch(/days to 16/);
  });

  it("renders info tone within the 30-day notification window", () => {
    const html = renderToStaticMarkup(
      <AgeTransitionCountdownChip
        autoTransferAt="2027-04-30T00:00:00.000Z"
        nowIso="2027-04-10T00:00:00.000Z"
        transferredAt={null}
      />,
    );
    expect(html).toMatch(/data-nex-family-safety-status-chip-tone="info"/);
    expect(html).toMatch(/to handover/);
  });

  it("renders pending tone when the handover is due today", () => {
    const html = renderToStaticMarkup(
      <AgeTransitionCountdownChip
        autoTransferAt="2027-04-01T00:00:00.000Z"
        nowIso="2027-04-01T00:00:00.000Z"
        transferredAt={null}
      />,
    );
    expect(html).toMatch(/data-nex-family-safety-status-chip-tone="pending"/);
    expect(html).toMatch(/due today/i);
  });

  it("renders pending tone with overdue copy when the deadline has passed", () => {
    const html = renderToStaticMarkup(
      <AgeTransitionCountdownChip
        autoTransferAt="2027-04-01T00:00:00.000Z"
        nowIso="2027-04-05T00:00:00.000Z"
        transferredAt={null}
      />,
    );
    expect(html).toMatch(/data-nex-family-safety-status-chip-tone="pending"/);
    expect(html).toMatch(/Overdue/i);
  });

  it("renders active tone when handover is already complete", () => {
    const html = renderToStaticMarkup(
      <AgeTransitionCountdownChip
        autoTransferAt="2027-04-01T00:00:00.000Z"
        nowIso="2027-04-05T00:00:00.000Z"
        transferredAt="2027-04-02T00:00:00.000Z"
      />,
    );
    expect(html).toMatch(/data-nex-family-safety-status-chip-tone="active"/);
    expect(html).toMatch(/complete/i);
    expect(html).toMatch(/nex-family-safety-age-transition-completed/);
  });

  it("never leaks ISO timestamps or raw account content", () => {
    const html = renderToStaticMarkup(
      <AgeTransitionCountdownChip
        autoTransferAt="2027-04-01T00:00:00.000Z"
        nowIso="2026-10-10T00:00:00.000Z"
        transferredAt={null}
      />,
    );
    expect(html).not.toContain("2027-04-01T00:00:00");
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });
});
