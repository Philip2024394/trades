// src/components/nex-native/family-safety/MinorSafeChatStatusPanel.test.tsx
//
// CC-3 · Minor SafeChat status panel render tests. SSR-only.

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MinorSafeChatStatusPanel } from "./MinorSafeChatStatusPanel";

describe("MinorSafeChatStatusPanel", () => {
  it("renders the always-on chip + classifier version", () => {
    const html = renderToStaticMarkup(
      <MinorSafeChatStatusPanel
        classifierVersion="v1.1.0"
        enforcedForMinor
        simulated
      />,
    );
    expect(html).toMatch(/nex-family-safety-minor-safechat-chip/);
    expect(html).toMatch(/always on/i);
    expect(html).toMatch(/v1\.1\.0/);
  });

  it("renders the simulated chip when simulated=true", () => {
    const html = renderToStaticMarkup(
      <MinorSafeChatStatusPanel
        classifierVersion="v1.1.0"
        enforcedForMinor
        simulated
      />,
    );
    expect(html).toMatch(/nex-family-safety-minor-safechat-sim-chip/);
  });

  it("omits the simulated chip when simulated=false", () => {
    const html = renderToStaticMarkup(
      <MinorSafeChatStatusPanel
        classifierVersion="v1.1.0"
        enforcedForMinor
        simulated={false}
      />,
    );
    expect(html).not.toMatch(/nex-family-safety-minor-safechat-sim-chip/);
  });

  it("surfaces the parent-cannot-disable explanation in prose", () => {
    const html = renderToStaticMarkup(
      <MinorSafeChatStatusPanel
        classifierVersion="v1.1.0"
        enforcedForMinor
        simulated
      />,
    );
    expect(html).toMatch(/cannot disable/i);
  });

  it("surfaces that no per-message details are shown to guardians", () => {
    const html = renderToStaticMarkup(
      <MinorSafeChatStatusPanel
        classifierVersion="v1.1.0"
        enforcedForMinor
        simulated
      />,
    );
    expect(html).toMatch(/no per-message classification/i);
  });

  it("does NOT render any disable toggle", () => {
    const html = renderToStaticMarkup(
      <MinorSafeChatStatusPanel
        classifierVersion="v1.1.0"
        enforcedForMinor
        simulated
      />,
    );
    expect(html).not.toMatch(/type="checkbox"/i);
    expect(html).not.toMatch(/role="switch"/i);
    expect(html).not.toMatch(/data-nex-safechat-disable/);
  });

  it("does NOT leak any UUID-shaped account id in the DOM", () => {
    const html = renderToStaticMarkup(
      <MinorSafeChatStatusPanel
        classifierVersion="v1.1.0"
        enforcedForMinor
        simulated
      />,
    );
    expect(html).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });

  it("exposes the enforcedForMinor flag via a data attribute", () => {
    const html = renderToStaticMarkup(
      <MinorSafeChatStatusPanel
        classifierVersion="v1.1.0"
        enforcedForMinor
        simulated
      />,
    );
    expect(html).toMatch(/data-nex-family-safety-minor-safechat-enforced="true"/);
  });
});
