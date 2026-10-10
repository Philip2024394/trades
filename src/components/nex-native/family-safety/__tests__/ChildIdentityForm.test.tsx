// src/components/nex-native/family-safety/__tests__/ChildIdentityForm.test.tsx

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChildIdentityForm } from "../ChildIdentityForm";

describe("ChildIdentityForm", () => {
  const noop = async () => {};

  it("renders the sealed input fields with aria-friendly labels", () => {
    const html = renderToStaticMarkup(<ChildIdentityForm onSubmit={noop} />);
    expect(html).toContain('for="nex-fs-child-name"');
    expect(html).toContain('for="nex-fs-child-dob"');
    expect(html).toContain('data-testid="nex-fs-child-name-input"');
    expect(html).toContain('data-testid="nex-fs-child-dob-input"');
    expect(html).toContain('data-testid="nex-fs-child-identity-submit"');
  });

  it("renders the sealed helper copy explaining the under-16 rule", () => {
    const html = renderToStaticMarkup(<ChildIdentityForm onSubmit={noop} />);
    expect(html).toContain("Must be under 16 years old");
    expect(html).toContain("3-60 characters");
  });

  it("exposes a form data-attribute for structural anchors", () => {
    const html = renderToStaticMarkup(<ChildIdentityForm onSubmit={noop} />);
    expect(html).toContain(
      'data-nex-family-safety-child-identity-form="true"',
    );
  });
});
