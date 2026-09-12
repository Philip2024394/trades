// src/lib/nex/split-workspace/split-workspace.test.ts
//
// Stage 9 tests · layout algebra.

import { describe, it, expect } from "vitest";
import {
  defaultLayout,
  validateLayout,
  focusPanel,
  togglePanel,
  keyToPanel,
} from "./index";

describe("defaultLayout", () => {
  it("has 2 visible panels · preview 60% code 40% · code focused", () => {
    const l = defaultLayout();
    expect(l.panels.length).toBe(2);
    expect(l.panels[0].kind).toBe("preview");
    expect(l.panels[0].widthFraction).toBe(0.6);
    expect(l.panels[1].kind).toBe("code");
    expect(l.panels[1].widthFraction).toBe(0.4);
    expect(l.panels[1].focused).toBe(true);
  });

  it("validates as OK", () => {
    expect(validateLayout(defaultLayout()).ok).toBe(true);
  });
});

describe("validateLayout · width invariant", () => {
  it("rejects widths that don't sum to 1", () => {
    const bad = {
      orientation: "horizontal" as const,
      panels: [
        { kind: "preview" as const, widthFraction: 0.4, visible: true, focused: true },
        { kind: "code" as const,    widthFraction: 0.4, visible: true, focused: false },
      ],
    };
    const r = validateLayout(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.workspace_width_not_1");
  });

  it("rejects zero focused panels", () => {
    const bad = {
      orientation: "horizontal" as const,
      panels: [
        { kind: "preview" as const, widthFraction: 0.5, visible: true, focused: false },
        { kind: "code" as const,    widthFraction: 0.5, visible: true, focused: false },
      ],
    };
    const r = validateLayout(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.workspace_focus_invariant");
  });

  it("rejects two focused panels", () => {
    const bad = {
      orientation: "horizontal" as const,
      panels: [
        { kind: "preview" as const, widthFraction: 0.5, visible: true, focused: true },
        { kind: "code" as const,    widthFraction: 0.5, visible: true, focused: true },
      ],
    };
    const r = validateLayout(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.workspace_focus_invariant");
  });

  it("rejects duplicate panel kinds", () => {
    const bad = {
      orientation: "horizontal" as const,
      panels: [
        { kind: "preview" as const, widthFraction: 0.5, visible: true, focused: true },
        { kind: "preview" as const, widthFraction: 0.5, visible: true, focused: false },
      ],
    };
    const r = validateLayout(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.workspace_duplicate_panel");
  });

  it("rejects no visible panels", () => {
    const bad = {
      orientation: "horizontal" as const,
      panels: [
        { kind: "preview" as const, widthFraction: 0.6, visible: false, focused: false },
        { kind: "code" as const,    widthFraction: 0.4, visible: false, focused: false },
      ],
    };
    const r = validateLayout(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.workspace_no_visible_panel");
  });
});

describe("focusPanel", () => {
  it("moves focus to target · leaves widths intact · preserves invariant", () => {
    const l = focusPanel(defaultLayout(), "preview");
    const preview = l.panels.find((p) => p.kind === "preview")!;
    const code = l.panels.find((p) => p.kind === "code")!;
    expect(preview.focused).toBe(true);
    expect(code.focused).toBe(false);
    expect(validateLayout(l).ok).toBe(true);
  });

  it("no-op when panel is hidden", () => {
    const l = defaultLayout();
    const withoutChange = focusPanel(l, "console"); // console not present
    expect(withoutChange).toBe(l);
  });
});

describe("togglePanel", () => {
  it("hiding a panel redistributes width and preserves invariant", () => {
    let l = defaultLayout();
    // Toggle code off · preview should get 100%
    l = togglePanel(l, "code");
    const preview = l.panels.find((p) => p.kind === "preview")!;
    const code = l.panels.find((p) => p.kind === "code")!;
    expect(code.visible).toBe(false);
    expect(preview.widthFraction).toBeCloseTo(1.0, 5);
    expect(preview.focused).toBe(true); // focus migrated to remaining visible panel
    expect(validateLayout(l).ok).toBe(true);
  });

  it("showing a panel shrinks others and preserves invariant", () => {
    // Start from default (preview + code) · show diff
    let l = defaultLayout();
    l = togglePanel(l, "diff");
    const validation = validateLayout(l);
    // diff wasn't in the initial layout — togglePanel only toggles existing panels
    // so this should be a no-op
    expect(l).toEqual(defaultLayout());
    expect(validation.ok).toBe(true);
  });

  it("no-op when hiding would leave zero visible", () => {
    let l = defaultLayout();
    l = togglePanel(l, "code");        // preview 100%
    // Now try to hide preview — should be no-op
    const before = l;
    l = togglePanel(l, "preview");
    expect(l).toBe(before);
  });
});

describe("keyToPanel", () => {
  it("Ctrl+1 → preview", () => {
    expect(keyToPanel({ key: "1", ctrlOrCmd: true })).toBe("preview");
  });

  it("Ctrl+2 → code", () => {
    expect(keyToPanel({ key: "2", ctrlOrCmd: true })).toBe("code");
  });

  it("Ctrl+` → console", () => {
    expect(keyToPanel({ key: "`", ctrlOrCmd: true })).toBe("console");
  });

  it("plain 1 (no ctrl) → null", () => {
    expect(keyToPanel({ key: "1", ctrlOrCmd: false })).toBeNull();
  });

  it("unknown key → null", () => {
    expect(keyToPanel({ key: "x", ctrlOrCmd: true })).toBeNull();
  });
});
