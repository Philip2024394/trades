// §36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit · §36-2D-a UX addendum 2026-09-15
// NEX bounded infrastructure · preview URL resolution tests · 2026-09-14
//
// Verifies that the BoundedAppTarget resolver correctly produces same-origin
// relative URLs by default and absolute URLs when preview_origin is set.
// Ports the resolver as a standalone testable helper (mirror of the client's
// resolvePreviewUrl function).

import { describe, expect, it } from "vitest";

interface BoundedAppTarget {
  readonly slug: string;
  readonly label: string;
  readonly route: string;
  readonly preview_origin: string | null;
  readonly kind: "nex1-authored-contract-viewer" | "site-root";
}

// Mirror of resolvePreviewUrl in WorkstationLiveClient · kept in sync deliberately.
function resolvePreviewUrl(target: BoundedAppTarget): string {
  if (target.preview_origin && target.preview_origin.length > 0) {
    const origin = target.preview_origin.replace(/\/$/, "");
    return `${origin}${target.route}`;
  }
  return target.route;
}

describe("preview URL resolution · §36-2D-a UX", () => {
  it("R-1 · same-origin (preview_origin null) → returns route only", () => {
    const t: BoundedAppTarget = { slug: "a", label: "a", route: "/nex-generated/tiny-calculator", preview_origin: null, kind: "nex1-authored-contract-viewer" };
    expect(resolvePreviewUrl(t)).toBe("/nex-generated/tiny-calculator");
  });
  it("R-2 · cross-origin preview_origin → absolute URL", () => {
    const t: BoundedAppTarget = { slug: "a", label: "a", route: "/nex-generated/tiny-calculator", preview_origin: "http://localhost:3008", kind: "nex1-authored-contract-viewer" };
    expect(resolvePreviewUrl(t)).toBe("http://localhost:3008/nex-generated/tiny-calculator");
  });
  it("R-3 · trailing slash on preview_origin is normalised", () => {
    const t: BoundedAppTarget = { slug: "a", label: "a", route: "/x", preview_origin: "http://localhost:3008/", kind: "site-root" };
    expect(resolvePreviewUrl(t)).toBe("http://localhost:3008/x");
  });
  it("R-4 · empty preview_origin string treated as same-origin", () => {
    const t: BoundedAppTarget = { slug: "a", label: "a", route: "/", preview_origin: "", kind: "site-root" };
    expect(resolvePreviewUrl(t)).toBe("/");
  });
});
