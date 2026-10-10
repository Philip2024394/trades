// src/components/nex-native/family-safety/__tests__/FamilySafeChatEntryCard.test.tsx
//
// Structural tests for the Settings entry card. react-testing-library
// is not installed · tests use `renderToStaticMarkup`.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FamilySafeChatEntryCard } from "../FamilySafeChatEntryCard";

describe("FamilySafeChatEntryCard · entry card structure", () => {
  it("renders a link to /nex-native/family-safety by default", () => {
    const html = renderToStaticMarkup(<FamilySafeChatEntryCard />);
    expect(html).toContain('href="/nex-native/family-safety"');
  });

  it("honours a custom href", () => {
    const html = renderToStaticMarkup(
      <FamilySafeChatEntryCard href="/other" />,
    );
    expect(html).toContain('href="/other"');
  });

  it("uses the reserved tile at the sealed path", () => {
    const html = renderToStaticMarkup(<FamilySafeChatEntryCard />);
    expect(html).toContain(
      'src="/nex-family-safety/family-safe-chat-entry-icon.png"',
    );
  });

  it("sets the hero to 96×96 (above the 72×72 reservation floor)", () => {
    const html = renderToStaticMarkup(<FamilySafeChatEntryCard />);
    expect(html).toMatch(/width="96"/);
    expect(html).toMatch(/height="96"/);
  });

  it("exposes an accessible name via aria-label (no visible text title)", () => {
    const html = renderToStaticMarkup(<FamilySafeChatEntryCard />);
    expect(html).toContain('aria-label="NEX Family SafeChat"');
    // There must NOT be a redundant text title because the tile has
    // the "FAMILY SAFE / CHAT" wordmark baked in.
    expect(html).not.toContain(">NEX Family SafeChat<");
    expect(html).not.toContain(">Family SafeChat<");
  });

  it("mounts the SIMULATED · PILOT badge", () => {
    const html = renderToStaticMarkup(<FamilySafeChatEntryCard />);
    expect(html).toContain("SIMULATED · PILOT");
  });

  it("renders a stable test-id anchor for Playwright + the hero inner test-id", () => {
    const html = renderToStaticMarkup(<FamilySafeChatEntryCard />);
    expect(html).toContain('data-testid="nex-family-safe-chat-entry"');
    expect(html).toContain('data-testid="nex-family-safe-chat-entry-hero"');
  });

  it("includes an alt='' on the image (decorative · aria-label on anchor is the label)", () => {
    const html = renderToStaticMarkup(<FamilySafeChatEntryCard />);
    expect(html).toContain('alt=""');
  });
});
