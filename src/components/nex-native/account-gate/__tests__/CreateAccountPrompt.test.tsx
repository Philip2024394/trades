// src/components/nex-native/account-gate/__tests__/CreateAccountPrompt.test.tsx
//
// Structural tests for the create-account prompt modal.
// react-testing-library is NOT installed · tests use
// `renderToStaticMarkup` and assert on the HTML string.
//
// Behavioural flows (dismiss / primary CTA / Esc / backdrop / focus
// trap) are covered by Playwright at
// `tests/e2e/nex-settings-account-gate.spec.ts`.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
    prefetch: () => {},
  }),
}));

import { CreateAccountPrompt } from "../CreateAccountPrompt";

function renderAnon(open = true): string {
  return renderToStaticMarkup(
    React.createElement(CreateAccountPrompt, {
      open,
      variant: "anonymous",
      onClose: () => {},
    }),
  );
}

function renderSignedIn(): string {
  return renderToStaticMarkup(
    React.createElement(CreateAccountPrompt, {
      open: true,
      variant: "signed_in_no_account",
      onClose: () => {},
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CreateAccountPrompt · closed state", () => {
  it("renders nothing when open=false", () => {
    const html = renderAnon(false);
    expect(html).toBe("");
  });
});

describe("CreateAccountPrompt · anonymous variant", () => {
  it("renders a dialog with aria-modal and the sealed testid", () => {
    const html = renderAnon();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('data-testid="nex-create-account-prompt"');
    expect(html).toContain('data-nex-prompt-variant="anonymous"');
  });

  it("primary CTA reads 'Create account' for anonymous visitors", () => {
    const html = renderAnon();
    expect(html).toContain(">Create account</button>");
    expect(html).toContain('data-testid="nex-create-account-prompt-primary"');
  });

  it("heading matches 'Create your NEX account'", () => {
    const html = renderAnon();
    expect(html).toMatch(/<h2[^>]*>Create your NEX account<\/h2>/);
  });

  it("mentions Vault / Emergency / Chats / Directory in the body copy", () => {
    const html = renderAnon();
    expect(html).toContain("Vault");
    expect(html).toContain("Emergency");
    expect(html).toContain("Chats");
    expect(html).toContain("Directory");
  });

  it("renders a 'Not now' dismiss button", () => {
    const html = renderAnon();
    expect(html).toContain(">Not now</button>");
    expect(html).toContain('data-testid="nex-create-account-prompt-dismiss"');
  });

  it("renders a backdrop marker for click-outside", () => {
    const html = renderAnon();
    expect(html).toContain("data-nex-account-gate-backdrop");
  });
});

describe("CreateAccountPrompt · signed_in_no_account variant", () => {
  it("exposes the signed_in_no_account variant marker", () => {
    const html = renderSignedIn();
    expect(html).toContain('data-nex-prompt-variant="signed_in_no_account"');
  });

  it("heading mentions 'Finish creating'", () => {
    const html = renderSignedIn();
    expect(html).toContain("Finish creating your NEX account");
  });

  it("primary CTA reads 'Finish setup' not 'Create account'", () => {
    const html = renderSignedIn();
    expect(html).toContain(">Finish setup</button>");
    expect(html).not.toContain(">Create account</button>");
  });

  it("body copy references the ready sign-in state", () => {
    const html = renderSignedIn();
    expect(html).toMatch(/sign-in is ready/i);
  });
});
