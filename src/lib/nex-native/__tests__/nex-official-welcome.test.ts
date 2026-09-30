// src/lib/nex-native/__tests__/nex-official-welcome.test.ts
//
// Regression pin for the shared NEX1 welcome-body helper.
// Guarantees the extraction produces byte-identical output to Bridge 62's
// original inline body.

import { describe, it, expect } from "vitest";
import { renderNex1WelcomeBody } from "../nex-official-welcome";

// Bridge 62's ORIGINAL inline body construction · verbatim from
// src/app/nex-native/_actions.ts:175-179 pre-Stage-10:
//
//   const firstName = fullName.split(/\s+/)[0] || "there";
//   const body =
//     `🎉 Welcome to NEX, ${firstName}!\n\n` +
//     `I'm NEX · your support account. ... reply to this message any time you have a question.\n\n` +
//     `Enjoy your first look 💜`;
function originalBridge62Body(fullName: string): string {
  const firstName = fullName.split(/\s+/)[0] || "there";
  return (
    `🎉 Welcome to NEX, ${firstName}!\n\n` +
    `I'm NEX · your support account. Everything about your NEX chat lives here — tap /settings/theme to try any premium theme free for 7 days, or reply to this message any time you have a question.\n\n` +
    `Enjoy your first look 💜`
  );
}

describe("renderNex1WelcomeBody · regression parity with Bridge 62 inline", () => {
  const cases: Array<{ label: string; input: string }> = [
    { label: "empty string", input: "" },
    { label: "single word", input: "Maria" },
    { label: "two words · first-name interpolation", input: "Maria Chen" },
    { label: "three words · first-name only", input: "Maria Isabella Chen" },
    { label: "leading whitespace", input: "  Maria" },
    { label: "trailing whitespace", input: "Maria   " },
    { label: "email-like input", input: "maria@example.com" },
    { label: "only whitespace", input: "     " },
  ];
  for (const { label, input } of cases) {
    it(`byte-identical to Bridge 62 inline · ${label}`, () => {
      const helper = renderNex1WelcomeBody({ first_name: input });
      const original = originalBridge62Body(input);
      expect(helper).toBe(original);
    });
  }

  it("null/undefined first_name → 'there'", () => {
    expect(renderNex1WelcomeBody({ first_name: null }).startsWith("🎉 Welcome to NEX, there!")).toBe(true);
    expect(renderNex1WelcomeBody({ first_name: undefined }).startsWith("🎉 Welcome to NEX, there!")).toBe(true);
    expect(renderNex1WelcomeBody({}).startsWith("🎉 Welcome to NEX, there!")).toBe(true);
    expect(renderNex1WelcomeBody().startsWith("🎉 Welcome to NEX, there!")).toBe(true);
  });

  it("output contains the sealed premium-theme trial CTA", () => {
    expect(renderNex1WelcomeBody({ first_name: "x" })).toContain("/settings/theme");
    expect(renderNex1WelcomeBody({ first_name: "x" })).toContain("7 days");
  });
});
