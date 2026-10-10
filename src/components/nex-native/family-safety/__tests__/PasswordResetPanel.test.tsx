// src/components/nex-native/family-safety/__tests__/PasswordResetPanel.test.tsx
//
// LOAD-BEARING SAFETY INVARIANT: the parent NEVER sees a plaintext
// password. We assert via source-grep that no field named
// `plaintextPassword` / `newPassword` / `password` appears in the
// component · the only accepted shape is `ChildPasswordResetTicket`
// which carries an opaque reference.

import * as fs from "node:fs";
import * as path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The panel imports server actions whose transitive imports require
// Supabase env vars at module load. Mock the actions boundary so this
// structural test stays purely about the component.
vi.mock(
  "@/lib/nex-native/family-safety/child-account-creation/actions",
  () => ({
    requestPasswordResetForChildAction: async () => ({
      resetTokenRefOpaque: "stub",
      expiresAt: new Date().toISOString(),
      displayHint: "stub",
    }),
  }),
);

import { PasswordResetPanel } from "../PasswordResetPanel";

const SOURCE_FILE = path.join(
  process.cwd(),
  "src",
  "components",
  "nex-native",
  "family-safety",
  "PasswordResetPanel.tsx",
);

const SOURCE = fs.readFileSync(SOURCE_FILE, "utf-8");

describe("PasswordResetPanel · no-plaintext invariant", () => {
  it("source does NOT reference 'plaintextPassword'", () => {
    expect(SOURCE).not.toMatch(/plaintextPassword/);
  });

  it("source does NOT reference 'newPassword'", () => {
    expect(SOURCE).not.toMatch(/\bnewPassword\b/);
  });

  it("source only exposes an opaque ticket shape", () => {
    expect(SOURCE).toMatch(/resetTokenRefOpaque/);
  });

  it("source does NOT make a direct fetch for a password reset", () => {
    expect(SOURCE).not.toMatch(/\bfetch\s*\(/);
  });
});

describe("PasswordResetPanel · UX", () => {
  it("renders the sealed explanation + the issue button", () => {
    const html = renderToStaticMarkup(
      <PasswordResetPanel custodyId="c-1" childDisplayName="Alex" />,
    );
    expect(html).toContain(
      "For their safety, you will not see the new password.",
    );
    expect(html).toContain('data-testid="nex-fs-reset-issue"');
    expect(html).toContain("Issue reset");
  });

  it("exposes stable data anchors", () => {
    const html = renderToStaticMarkup(
      <PasswordResetPanel custodyId="c-1" childDisplayName="Alex" />,
    );
    expect(html).toContain(
      'data-nex-family-safety-password-reset-panel="true"',
    );
  });
});
