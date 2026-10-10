// src/components/nex-native/family-safety/__tests__/CreationReviewPanel.test.tsx

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The panel pulls in a client island that imports a server-action
// module (which transitively hits `server-only`). We mock the island
// so this structural test stays pure.
vi.mock("../CreationReviewActions", () => ({
  CreationReviewActions: ({ requestId }: { readonly requestId: string }) =>
    React.createElement(
      "div",
      { "data-mock-review-actions": true, "data-request-id": requestId },
      "actions",
    ),
}));

import { CreationReviewPanel } from "../CreationReviewPanel";

describe("CreationReviewPanel", () => {
  const base = {
    requestId: "r-1",
    parentAccountId: "p-1",
    childDisplayName: "Alex",
    childDeclaredDateOfBirth: "2015-01-10",
    state: "draft" as const,
    createdAt: "2026-10-10T00:00:00.000Z",
    updatedAt: "2026-10-10T00:00:00.000Z",
    submissionId: "s-1",
    documentFilename: "kk.jpg",
    documentType: "kk" as const,
    rejectionReason: null,
    custodyId: null,
    heldForLegalClearance: false,
  };

  it("renders the child's name + DOB + age + document rows", () => {
    const html = renderToStaticMarkup(
      <CreationReviewPanel request={base} ageYears={11} />,
    );
    expect(html).toContain("Alex");
    expect(html).toContain("2015-01-10");
    expect(html).toContain("11 years");
    expect(html).toContain("KK (Kartu Keluarga)");
    expect(html).toContain("kk.jpg");
  });

  it("exposes the sealed data anchor + test ids", () => {
    const html = renderToStaticMarkup(
      <CreationReviewPanel request={base} ageYears={11} />,
    );
    expect(html).toContain('data-nex-family-safety-creation-review="true"');
    expect(html).toContain('data-testid="nex-fs-review-name"');
    expect(html).toContain('data-testid="nex-fs-review-dob"');
    expect(html).toContain('data-testid="nex-fs-review-doc"');
  });
});
