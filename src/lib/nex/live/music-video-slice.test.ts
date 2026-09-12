// src/lib/nex/live/music-video-slice.test.ts
//
// NEX LIVE · MUSIC/VIDEO slice · unit tests (§23)

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  newDeclaration,
  assessedStateForDeclaration,
  mayPublishDeclaredMedia,
  customerFacingRightsLabel,
} from "./rights-declaration";
import {
  canV2Transition,
  assertV2Transition,
  isDiscoverableV2,
  shouldServeMediaBytes,
  permitsMonetization,
  defaultV2State,
} from "./media-lifecycle-v2";
import {
  createReport,
  applyReview,
  listReportsForMedia,
  listReviewsForMedia,
  listOpenReports,
  readMediaVisibility,
} from "./report";
import {
  saveDeclaration,
  readActiveDeclaration,
  readDeclarationHistory,
  listMediaIdsWithDeclaration,
} from "./media-declaration-store";
import {
  classifyMode,
  filterDiscoverable,
  isDiscoverableForMode,
} from "./discovery";

function isolate() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nex-live-slice-"));
  process.env.NEX_LIVE_DATA_ROOT = tmp;
}

const NOW = "2026-09-06T12:00:00.000Z";

// ── rights-declaration (§5 · §6 · §10) ─────────────────────────────

describe("rights-declaration · §10 declaration ≠ verified", () => {
  it("OWNER_DECLARED maps to UNVERIFIED, NOT KNOWN_OWNED", () => {
    expect(assessedStateForDeclaration("OWNER_DECLARED")).toBe("UNVERIFIED");
  });
  it("LICENSED declaration maps to UNVERIFIED, NOT KNOWN_LICENSED", () => {
    expect(assessedStateForDeclaration("LICENSED")).toBe("UNVERIFIED");
  });
  it("PUBLIC_DOMAIN maps to UNVERIFIED", () => {
    expect(assessedStateForDeclaration("PUBLIC_DOMAIN")).toBe("UNVERIFIED");
  });
  it("CREATIVE_COMMONS maps to UNVERIFIED", () => {
    expect(assessedStateForDeclaration("CREATIVE_COMMONS")).toBe("UNVERIFIED");
  });
  it("DISPUTED preserved as DISPUTED", () => {
    expect(assessedStateForDeclaration("DISPUTED")).toBe("DISPUTED");
  });
  it("REMOVED collapses to UNKNOWN (no residual claim)", () => {
    expect(assessedStateForDeclaration("REMOVED")).toBe("UNKNOWN");
  });
});

describe("rights-declaration · publish gate", () => {
  it("OWNER_DECLARED permits publish (visible + not verified)", () => {
    const g = mayPublishDeclaredMedia("OWNER_DECLARED");
    expect(g.allowed).toBe(true);
    expect(g.visible_to_public).toBe(true);
  });
  it("LICENSED permits publish", () => {
    expect(mayPublishDeclaredMedia("LICENSED").allowed).toBe(true);
  });
  it("REMOVED refuses publish", () => {
    expect(mayPublishDeclaredMedia("REMOVED").allowed).toBe(false);
  });
  it("DISPUTED refuses publish (§8 pending resolution)", () => {
    expect(mayPublishDeclaredMedia("DISPUTED").allowed).toBe(false);
  });
});

describe("rights-declaration · customer-facing labels (§10)", () => {
  it("never uses the word 'verified' for a declaration", () => {
    for (const k of ["OWNER_DECLARED", "LICENSED", "PUBLIC_DOMAIN", "CREATIVE_COMMONS"] as const) {
      const label = customerFacingRightsLabel(k);
      expect(label.toLowerCase()).not.toContain("verified");
    }
  });
  it("uses 'Uploader-declared' prefix", () => {
    expect(customerFacingRightsLabel("OWNER_DECLARED")).toContain("Uploader-declared");
    expect(customerFacingRightsLabel("LICENSED")).toContain("Uploader-declared");
  });
});

// ── media-lifecycle-v2 (§8 · §9) ───────────────────────────────────

describe("media-lifecycle-v2 · transitions", () => {
  it("ACTIVE → REPORTED allowed", () => expect(canV2Transition("ACTIVE", "REPORTED")).toBe(true));
  it("ACTIVE → REMOVED allowed (moderator kill switch)", () => expect(canV2Transition("ACTIVE", "REMOVED")).toBe(true));
  it("REPORTED → UNDER_REVIEW allowed", () => expect(canV2Transition("REPORTED", "UNDER_REVIEW")).toBe(true));
  it("REPORTED → ACTIVE allowed (auto-clear bogus)", () => expect(canV2Transition("REPORTED", "ACTIVE")).toBe(true));
  it("UNDER_REVIEW → REMOVED allowed", () => expect(canV2Transition("UNDER_REVIEW", "REMOVED")).toBe(true));
  it("UNDER_REVIEW → RESTRICTED allowed", () => expect(canV2Transition("UNDER_REVIEW", "RESTRICTED")).toBe(true));
  it("REMOVED → RESTORED allowed (§8 audit history survives · restoration possible)", () => expect(canV2Transition("REMOVED", "RESTORED")).toBe(true));
  it("REMOVED → ACTIVE REJECTED (must go through RESTORED)", () => expect(canV2Transition("REMOVED", "ACTIVE")).toBe(false));
  it("assertV2Transition throws on illegal", () => {
    expect(() => assertV2Transition("REMOVED", "ACTIVE")).toThrow(/invalid_visibility_transition:REMOVED->ACTIVE/);
  });
});

describe("media-lifecycle-v2 · discovery & serve predicates (§9)", () => {
  it("ACTIVE discoverable", () => expect(isDiscoverableV2("ACTIVE")).toBe(true));
  it("REPORTED discoverable (report alone does not hide)", () => expect(isDiscoverableV2("REPORTED")).toBe(true));
  it("RESTRICTED NOT discoverable", () => expect(isDiscoverableV2("RESTRICTED")).toBe(false));
  it("REMOVED NOT discoverable", () => expect(isDiscoverableV2("REMOVED")).toBe(false));
  it("shouldServeMediaBytes: REMOVED must not serve", () => expect(shouldServeMediaBytes("REMOVED")).toBe(false));
  it("shouldServeMediaBytes: RESTRICTED still serves (surface hides but bytes may play from direct link)", () => expect(shouldServeMediaBytes("RESTRICTED")).toBe(true));
  it("permitsMonetization: ACTIVE ok · REPORTED suspends", () => {
    expect(permitsMonetization("ACTIVE")).toBe(true);
    expect(permitsMonetization("REPORTED")).toBe(false);
  });
  it("default state on fresh publish is ACTIVE", () => expect(defaultV2State()).toBe("ACTIVE"));
});

// ── declaration store ─────────────────────────────────────────────

describe("media-declaration-store · single-active + history", () => {
  beforeEach(() => isolate());
  it("saveDeclaration + readActiveDeclaration round-trip", () => {
    const d = newDeclaration({
      declaration_id: "d1", media_id: "m1", uploader_user_id: "u1",
      declared_kind: "OWNER_DECLARED", declared_statement: "I own it.",
      now_iso: NOW,
    });
    saveDeclaration(d);
    const back = readActiveDeclaration("m1");
    expect(back?.declaration_id).toBe("d1");
    expect(back?.is_active).toBe(true);
  });
  it("subsequent save deactivates prior declaration", () => {
    saveDeclaration(newDeclaration({
      declaration_id: "d1", media_id: "m1", uploader_user_id: "u1",
      declared_kind: "OWNER_DECLARED", declared_statement: "v1",
    }));
    saveDeclaration(newDeclaration({
      declaration_id: "d2", media_id: "m1", uploader_user_id: "u1",
      declared_kind: "LICENSED", declared_statement: "v2",
    }));
    const active = readActiveDeclaration("m1");
    expect(active?.declaration_id).toBe("d2");
    const history = readDeclarationHistory("m1");
    expect(history.length).toBe(2);
    expect(history[0].is_active).toBe(false);
    expect(history[1].is_active).toBe(true);
  });
  it("readActiveDeclaration returns null for unknown media_id", () => {
    expect(readActiveDeclaration("m-missing")).toBeNull();
  });
  it("listMediaIdsWithDeclaration enumerates all active-declared media", () => {
    saveDeclaration(newDeclaration({
      declaration_id: "d1", media_id: "m1", uploader_user_id: "u1",
      declared_kind: "OWNER_DECLARED", declared_statement: "x",
    }));
    saveDeclaration(newDeclaration({
      declaration_id: "d2", media_id: "m2", uploader_user_id: "u2",
      declared_kind: "LICENSED", declared_statement: "y",
    }));
    const ids = new Set(listMediaIdsWithDeclaration());
    expect(ids.has("m1")).toBe(true);
    expect(ids.has("m2")).toBe(true);
  });
});

// ── report + review workflow (§7 · §8) ──────────────────────────────

describe("report → review workflow", () => {
  beforeEach(() => isolate());
  it("createReport requires reporter_user_id", () => {
    expect(() => createReport({
      media_id: "m1", reporter_user_id: "", reason: "copyright",
      reporter_statement: "abc",
    })).toThrow(/reporter_user_id_required/);
  });
  it("createReport transitions ACTIVE → REPORTED", () => {
    expect(readMediaVisibility("m1")).toBe("ACTIVE");
    createReport({
      media_id: "m1", reporter_user_id: "u1", reason: "copyright",
      reporter_statement: "This appears to reuse my track without licence.",
    });
    expect(readMediaVisibility("m1")).toBe("REPORTED");
  });
  it("second createReport on REPORTED stays REPORTED (no state escalation)", () => {
    createReport({ media_id: "m1", reporter_user_id: "u1", reason: "copyright", reporter_statement: "one" });
    createReport({ media_id: "m1", reporter_user_id: "u2", reason: "copyright", reporter_statement: "two" });
    expect(readMediaVisibility("m1")).toBe("REPORTED");
    expect(listReportsForMedia("m1").length).toBe(2);
  });
  it("applyReview KEEP transitions REPORTED → ACTIVE", () => {
    createReport({ media_id: "m1", reporter_user_id: "u1", reason: "copyright", reporter_statement: "test" });
    applyReview({
      media_id: "m1", reviewer_user_id: "mod1", reviewer_role: "moderator",
      decision: "KEEP", reason: "Not a valid copyright complaint after review.",
    });
    expect(readMediaVisibility("m1")).toBe("ACTIVE");
    expect(listReviewsForMedia("m1").length).toBe(1);
  });
  it("applyReview REMOVE transitions REPORTED → REMOVED (via UNDER_REVIEW virtual hop)", () => {
    createReport({ media_id: "m1", reporter_user_id: "u1", reason: "copyright", reporter_statement: "test" });
    applyReview({
      media_id: "m1", reviewer_user_id: "founder1", reviewer_role: "founder",
      decision: "REMOVE", reason: "Verified unauthorized copyrighted material.",
    });
    expect(readMediaVisibility("m1")).toBe("REMOVED");
    expect(isDiscoverableV2(readMediaVisibility("m1"))).toBe(false);
  });
  it("applyReview RESTRICT transitions REPORTED → RESTRICTED", () => {
    createReport({ media_id: "m1", reporter_user_id: "u1", reason: "unsafe", reporter_statement: "test" });
    applyReview({
      media_id: "m1", reviewer_user_id: "mod1", reviewer_role: "moderator",
      decision: "RESTRICT", reason: "Age-appropriate warnings needed.",
    });
    expect(readMediaVisibility("m1")).toBe("RESTRICTED");
  });
  it("applyReview DISPUTE_ACCEPTED restores from REMOVED", () => {
    // Set up: report + remove + then dispute successful
    createReport({ media_id: "m1", reporter_user_id: "u1", reason: "copyright", reporter_statement: "x" });
    applyReview({ media_id: "m1", reviewer_user_id: "f", reviewer_role: "founder", decision: "REMOVE", reason: "initial" });
    expect(readMediaVisibility("m1")).toBe("REMOVED");
    applyReview({ media_id: "m1", reviewer_user_id: "f", reviewer_role: "founder", decision: "DISPUTE_ACCEPTED", reason: "Uploader proved licence." });
    expect(readMediaVisibility("m1")).toBe("RESTORED");
  });
  it("addressed_report_ids close the specific reports", () => {
    const r = createReport({ media_id: "m1", reporter_user_id: "u1", reason: "copyright", reporter_statement: "x" });
    applyReview({
      media_id: "m1", reviewer_user_id: "mod", reviewer_role: "moderator",
      decision: "KEEP", reason: "spurious", addressed_report_ids: [r.report_id],
    });
    const reports = listReportsForMedia("m1");
    expect(reports[0].status).toBe("RESOLVED");
    expect(reports[0].resolution_review_id).not.toBeNull();
  });
  it("§8 audit history preserved · removed media still has reports + reviews", () => {
    createReport({ media_id: "m1", reporter_user_id: "u1", reason: "copyright", reporter_statement: "x" });
    applyReview({ media_id: "m1", reviewer_user_id: "f", reviewer_role: "founder", decision: "REMOVE", reason: "verified" });
    expect(listReportsForMedia("m1").length).toBe(1);
    expect(listReviewsForMedia("m1").length).toBe(1);
    // History survives even though visibility is REMOVED.
  });
  it("listOpenReports surfaces unresolved reports", () => {
    createReport({ media_id: "m1", reporter_user_id: "u1", reason: "copyright", reporter_statement: "x" });
    createReport({ media_id: "m2", reporter_user_id: "u2", reason: "harassment", reporter_statement: "y" });
    expect(listOpenReports().length).toBe(2);
  });
});

// ── mode classification (§1 · §2) ─────────────────────────────────

describe("classifyMode", () => {
  it("audio object_type → MUSIC", () => {
    expect(classifyMode({ object_type: "audio", mime_type: "audio/mp3" })).toBe("MUSIC");
  });
  it("audio mime with video object_type → MUSIC (mime wins for audio)", () => {
    expect(classifyMode({ object_type: "video", mime_type: "audio/wav" })).toBe("MUSIC");
  });
  it("video default → VIDEO", () => {
    expect(classifyMode({ object_type: "video", mime_type: "video/mp4" })).toBe("VIDEO");
  });
  it("extras.nex_live_mode overrides", () => {
    expect(classifyMode({ object_type: "video", extras: { nex_live_mode: "MUSIC" } })).toBe("MUSIC");
    expect(classifyMode({ object_type: "audio", extras: { nex_live_mode: "VIDEO" } })).toBe("VIDEO");
  });
  it("bogus extras value ignored", () => {
    expect(classifyMode({ object_type: "video", extras: { nex_live_mode: "OTHER" } })).toBe("VIDEO");
  });
});

// ── filterDiscoverable (§5 · §9) ──────────────────────────────────

describe("filterDiscoverable · end-to-end mode + rights + visibility", () => {
  beforeEach(() => isolate());
  it("excludes rows with no declaration (§5)", () => {
    const rows = [{ media_id: "m1", object_type: "video", mime_type: "video/mp4", extras: {} }];
    expect(filterDiscoverable({ mode: "VIDEO", rows }).length).toBe(0);
  });
  it("includes row when declaration is active + mode matches + visibility active", () => {
    saveDeclaration(newDeclaration({
      declaration_id: "d1", media_id: "m1", uploader_user_id: "u1",
      declared_kind: "OWNER_DECLARED", declared_statement: "own",
    }));
    const rows = [{ media_id: "m1", object_type: "video", mime_type: "video/mp4", extras: { nex_live_mode: "VIDEO" as const } }];
    expect(filterDiscoverable({ mode: "VIDEO", rows }).length).toBe(1);
  });
  it("excludes when mode does not match", () => {
    saveDeclaration(newDeclaration({
      declaration_id: "d1", media_id: "m1", uploader_user_id: "u1",
      declared_kind: "OWNER_DECLARED", declared_statement: "own",
    }));
    const rows = [{ media_id: "m1", object_type: "video", mime_type: "video/mp4", extras: { nex_live_mode: "VIDEO" as const } }];
    expect(filterDiscoverable({ mode: "MUSIC", rows }).length).toBe(0);
  });
  it("excludes when visibility is REMOVED (§9)", () => {
    saveDeclaration(newDeclaration({
      declaration_id: "d1", media_id: "m1", uploader_user_id: "u1",
      declared_kind: "OWNER_DECLARED", declared_statement: "own",
    }));
    createReport({ media_id: "m1", reporter_user_id: "u2", reason: "copyright", reporter_statement: "x" });
    applyReview({ media_id: "m1", reviewer_user_id: "f", reviewer_role: "founder", decision: "REMOVE", reason: "verified" });
    const rows = [{ media_id: "m1", object_type: "video", mime_type: "video/mp4", extras: { nex_live_mode: "VIDEO" as const } }];
    expect(filterDiscoverable({ mode: "VIDEO", rows }).length).toBe(0);
  });
  it("isDiscoverableForMode convenience matches filterDiscoverable", () => {
    saveDeclaration(newDeclaration({
      declaration_id: "d1", media_id: "m1", uploader_user_id: "u1",
      declared_kind: "OWNER_DECLARED", declared_statement: "own",
    }));
    const row = { media_id: "m1", object_type: "video", mime_type: "video/mp4", extras: { nex_live_mode: "VIDEO" as const } };
    expect(isDiscoverableForMode({ mode: "VIDEO", row })).toBe(true);
    expect(isDiscoverableForMode({ mode: "MUSIC", row })).toBe(false);
  });
});

// ── §10 truthfulness suite ────────────────────────────────────────

describe("§10 truthfulness · NEX never converts declaration → verified fact", () => {
  it("no declared kind maps to KNOWN_OWNED", () => {
    const kinds = ["OWNER_DECLARED", "LICENSED", "PUBLIC_DOMAIN", "CREATIVE_COMMONS"] as const;
    for (const k of kinds) {
      expect(assessedStateForDeclaration(k)).not.toBe("KNOWN_OWNED");
      expect(assessedStateForDeclaration(k)).not.toBe("KNOWN_LICENSED");
    }
  });
  it("customer-facing label never uses 'verified'", () => {
    for (const k of ["OWNER_DECLARED", "LICENSED", "PUBLIC_DOMAIN", "CREATIVE_COMMONS", "PENDING_REVIEW", "DISPUTED", "REMOVED"] as const) {
      const label = customerFacingRightsLabel(k);
      expect(label.toLowerCase()).not.toContain("verified");
    }
  });
});
