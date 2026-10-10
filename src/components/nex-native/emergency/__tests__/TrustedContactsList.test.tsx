// src/components/nex-native/emergency/__tests__/TrustedContactsList.test.tsx
//
// Structural tests for the TrustedContactsList add form + list.
// react-testing-library is NOT installed in this repo · tests follow
// the sealed convention of `renderToStaticMarkup` + testid/attribute
// assertions on the initial paint. Interactive flows (adding +
// removing) are covered via the submit-button disabled state only.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TrustedContactsList } from "../TrustedContactsList";
import type { TrustedContactRow } from "../types";

function noopServices() {
  return {
    add: async () => {
      throw new Error("not expected to be called from markup test");
    },
    remove: async () => ({ ok: true as const }),
  };
}

function render(initial: readonly TrustedContactRow[] = []): string {
  return renderToStaticMarkup(
    React.createElement(TrustedContactsList, {
      initial,
      services: noopServices(),
    }),
  );
}

describe("TrustedContactsList · empty state (post-L3 extension)", () => {
  const html = render([]);

  it("renders the section testid", () => {
    expect(html).toContain('data-testid="nex-emergency-trusted-contacts"');
  });

  it("exposes the email input with the sealed testid", () => {
    expect(html).toContain('data-testid="nex-emergency-contact-email"');
  });

  it("exposes the phone input with the sealed testid", () => {
    expect(html).toContain('data-testid="nex-emergency-contact-phone"');
  });

  it("exposes the account-id input (back-compat)", () => {
    expect(html).toContain('data-testid="nex-emergency-contact-account-id"');
  });

  it("renders the submit button DISABLED when no identifier typed", () => {
    // Attribute order in renderToStaticMarkup is not guaranteed; just
    // confirm both the testid and `disabled` live on the same <button>.
    const m = /<button[^>]*>/g;
    const buttons = html.match(m) ?? [];
    const submit = buttons.find((b) =>
      b.includes('data-testid="nex-emergency-contact-submit"'),
    );
    expect(submit).toBeDefined();
    expect(submit).toMatch(/disabled/);
  });

  it("copy explains the three-identifier contract", () => {
    expect(html).toMatch(/NEX account id|email|phone/i);
    expect(html).toMatch(/at least one/i);
  });

  it("field inputs are typed semantically (type=email · type=tel)", () => {
    expect(html).toMatch(/type="email"/);
    expect(html).toMatch(/type="tel"/);
  });
});

describe("TrustedContactsList · populated state (multi-channel row)", () => {
  const row: TrustedContactRow = {
    trustedContactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ownerAccountId: "owner",
    contactAccountId: null,
    contactEmail: "mum@example.com",
    contactPhone: null,
    addedAt: "2026-10-10T10:00:00Z",
    contactLabel: "Mum",
  };
  const html = render([row]);

  it("renders the label as primary identifier when present", () => {
    expect(html).toMatch(/>Mum</);
  });

  it("renders the email as secondary identifier", () => {
    expect(html).toContain("mum@example.com");
  });

  it("remove button is keyed off a stable identifier", () => {
    // either the trusted_contact_id OR a channel identifier works
    expect(html).toMatch(/data-testid="nex-emergency-contact-remove-[^"]+"/);
  });

  it("records both trusted_contact_id data attribute for the row", () => {
    expect(html).toContain(
      'data-nex-emergency-contact-trusted-id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"',
    );
  });
});

describe("TrustedContactsList · phone-only row (edge case)", () => {
  const row: TrustedContactRow = {
    trustedContactId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ownerAccountId: "owner",
    contactAccountId: null,
    contactEmail: null,
    contactPhone: "+6281234567",
    addedAt: "2026-10-10T10:00:00Z",
    contactLabel: null,
  };
  const html = render([row]);

  it("falls back to phone as primary when no label/account/email", () => {
    expect(html).toContain("+6281234567");
  });
});
