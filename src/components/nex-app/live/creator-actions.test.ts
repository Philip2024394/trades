// src/components/nex-app/live/creator-actions.test.ts
//
// NEX LIVE · Phase B · creator-actions contract tests

import { describe, it, expect } from "vitest";
import {
  listCreatorActions,
  isTappable,
  statusText,
  partitionByPriority,
} from "./creator-actions";

describe("creator-actions · roster", () => {
  it("has exactly 5 actions (RECORD/UPLOAD/GO_LIVE/EDIT/MY_LIVE)", () => {
    const actions = listCreatorActions();
    expect(actions.length).toBe(5);
    const ids = actions.map((a) => a.id).sort();
    expect(ids).toEqual(["EDIT", "GO_LIVE", "MY_LIVE", "RECORD", "UPLOAD"]);
  });

  it("preserves presentational order: RECORD, UPLOAD, GO_LIVE, EDIT, MY_LIVE", () => {
    const actions = listCreatorActions();
    expect(actions.map((a) => a.id)).toEqual(["RECORD", "UPLOAD", "GO_LIVE", "EDIT", "MY_LIVE"]);
  });

  it("every action has a non-empty label + short_hint + reason", () => {
    for (const a of listCreatorActions()) {
      expect(a.label.length).toBeGreaterThan(0);
      expect(a.short_hint.length).toBeGreaterThan(0);
      expect(a.reason.length).toBeGreaterThan(0);
    }
  });
});

describe("creator-actions · availability honesty (§7 · §14 · §17)", () => {
  it("RECORD is AVAILABLE (existing camera recorder verified in audit)", () => {
    const a = listCreatorActions().find((x) => x.id === "RECORD")!;
    expect(a.availability).toBe("AVAILABLE");
    expect(a.href).toBe("/nex-video/create");
  });

  it("UPLOAD is AVAILABLE (Phase 2 dedicated uploader shipped at /nex-live/upload)", () => {
    const a = listCreatorActions().find((x) => x.id === "UPLOAD")!;
    expect(a.availability).toBe("AVAILABLE");
    expect(a.href).toBe("/nex-live/upload");
  });

  it("GO_LIVE is NOT_YET_AVAILABLE (no Live streaming infra)", () => {
    const a = listCreatorActions().find((x) => x.id === "GO_LIVE")!;
    expect(a.availability).toBe("NOT_YET_AVAILABLE");
    expect(a.href).toBeNull();
  });

  it("EDIT is NOT_YET_AVAILABLE (no NEX video editor exists)", () => {
    const a = listCreatorActions().find((x) => x.id === "EDIT")!;
    expect(a.availability).toBe("NOT_YET_AVAILABLE");
    expect(a.href).toBeNull();
  });

  it("MY_LIVE is AVAILABLE (surface shipped in Phase B)", () => {
    const a = listCreatorActions().find((x) => x.id === "MY_LIVE")!;
    expect(a.availability).toBe("AVAILABLE");
    expect(a.href).toBe("/nex-live/my");
  });
});

describe("creator-actions · isTappable predicate", () => {
  it("AVAILABLE + href → tappable", () => {
    const record = listCreatorActions().find((x) => x.id === "RECORD")!;
    expect(isTappable(record)).toBe(true);
  });
  it("UPLOAD now AVAILABLE + href → tappable (Phase 2 upload flow)", () => {
    const upload = listCreatorActions().find((x) => x.id === "UPLOAD")!;
    expect(isTappable(upload)).toBe(true);
  });
  it("NOT_YET_AVAILABLE → NOT tappable (§7 no fake activation)", () => {
    const goLive = listCreatorActions().find((x) => x.id === "GO_LIVE")!;
    expect(isTappable(goLive)).toBe(false);
    const edit = listCreatorActions().find((x) => x.id === "EDIT")!;
    expect(isTappable(edit)).toBe(false);
  });
});

describe("creator-actions · statusText (honesty layer)", () => {
  it("AVAILABLE actions have null status (no need to explain)", () => {
    const record = listCreatorActions().find((x) => x.id === "RECORD")!;
    expect(statusText(record)).toBeNull();
    const myLive = listCreatorActions().find((x) => x.id === "MY_LIVE")!;
    expect(statusText(myLive)).toBeNull();
  });
  it("AVAILABLE actions (RECORD/UPLOAD/MY_LIVE) have null status text", () => {
    const upload = listCreatorActions().find((x) => x.id === "UPLOAD")!;
    expect(statusText(upload)).toBeNull();
  });
  it("NOT_YET_AVAILABLE status text is 'Not available yet' (never pretends)", () => {
    const goLive = listCreatorActions().find((x) => x.id === "GO_LIVE")!;
    expect(statusText(goLive)).toBe("Not available yet");
    const edit = listCreatorActions().find((x) => x.id === "EDIT")!;
    expect(statusText(edit)).toBe("Not available yet");
  });
  it("no status text contains 'coming soon' (banned filler)", () => {
    for (const a of listCreatorActions()) {
      const s = statusText(a);
      if (s) expect(s.toLowerCase()).not.toContain("coming soon");
    }
  });
  it("no status text contains 'verified' (§10 discipline propagated)", () => {
    for (const a of listCreatorActions()) {
      const s = statusText(a);
      if (s) expect(s.toLowerCase()).not.toContain("verified");
    }
  });
});

describe("creator-actions · partitionByPriority (§11 hierarchy)", () => {
  it("primary = RECORD, UPLOAD, GO_LIVE", () => {
    const { primary } = partitionByPriority();
    expect(primary.map((a) => a.id)).toEqual(["RECORD", "UPLOAD", "GO_LIVE"]);
  });
  it("secondary = EDIT, MY_LIVE", () => {
    const { secondary } = partitionByPriority();
    expect(secondary.map((a) => a.id)).toEqual(["EDIT", "MY_LIVE"]);
  });
  it("primary + secondary union is the full list", () => {
    const { primary, secondary } = partitionByPriority();
    expect(primary.length + secondary.length).toBe(listCreatorActions().length);
  });
});

describe("creator-actions · §14 forbidden-implementations disclosure", () => {
  it("no action claims monetization/royalty/streaming/analytics capability", () => {
    for (const a of listCreatorActions()) {
      expect(a.label.toLowerCase()).not.toContain("monetize");
      expect(a.label.toLowerCase()).not.toContain("earn");
      expect(a.label.toLowerCase()).not.toContain("analytics");
      expect(a.short_hint.toLowerCase()).not.toContain("earn");
    }
  });
});
