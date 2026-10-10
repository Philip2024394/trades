// src/components/nex-native/family-safety/__tests__/CustodyActionLog.test.tsx

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CustodyActionLog } from "../CustodyActionLog";

describe("CustodyActionLog", () => {
  it("renders the empty state when no entries", () => {
    const html = renderToStaticMarkup(<CustodyActionLog entries={[]} />);
    expect(html).toContain('data-testid="nex-family-safety-audit-empty"');
    expect(html).toContain("No audit entries yet");
    expect(html).toContain(
      "Audit entries never contain passwords or secret tokens.",
    );
  });

  it("renders one row per entry · each with the opaque chip", () => {
    const html = renderToStaticMarkup(
      <CustodyActionLog
        entries={[
          {
            auditEntryId: "a-1",
            custodyId: "c-1",
            action: "password_reset_issued",
            actorAccountId: "p-1",
            occurredAt: "2026-10-10T00:00:00.000Z",
            summary:
              "Parent issued a password reset. Opaque details redacted.",
          },
          {
            auditEntryId: "a-2",
            custodyId: "c-1",
            action: "custody_revoked",
            actorAccountId: "p-1",
            occurredAt: "2026-10-10T00:01:00.000Z",
            summary: "Parent revoked custody. Opaque details redacted.",
          },
        ]}
      />,
    );
    expect(html).toContain(
      'data-nex-family-safety-audit-entry="password_reset_issued"',
    );
    expect(html).toContain(
      'data-nex-family-safety-audit-entry="custody_revoked"',
    );
    expect(html).toContain("Password reset issued");
    expect(html).toContain("Custody revoked");
    // The opaque-redacted chip appears for every row.
    expect(
      html.match(/Audit · opaque details redacted/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(2);
  });
});
