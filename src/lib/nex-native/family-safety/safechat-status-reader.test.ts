// src/lib/nex-native/family-safety/safechat-status-reader.test.ts
//
// FS-3 · SafeChat feature-status reader tests. Pure functions · no DB
// mocking required because the reader never queries. The Phase 1
// ceiling is pinned: user-facing is OFF, guardian summaries unavailable,
// classifier version pinned to the sealed default.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  SAFECHAT_CLASSIFIER_VERSION_PHASE_1,
  SAFECHAT_GUARDIAN_SUMMARY_PHASE_1_REASON,
  SAFECHAT_RETENTION_WINDOW_DAYS_PHASE_1,
  readSafeChatFeatureStatus,
  readSafeChatGuardianSummaryForChild,
} from "./safechat-status-reader";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED;
  delete process.env.NEX_SAFECHAT_USER_FACING_ENABLED;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

// ─────────────────────────────────────────────────────────────────────
// §1 · Sealed constants
// ─────────────────────────────────────────────────────────────────────

describe("SafeChat Phase 1 sealed constants", () => {
  it("classifier version is pinned to the audit-sealed default v1.1.0", () => {
    expect(SAFECHAT_CLASSIFIER_VERSION_PHASE_1).toBe("v1.1.0");
  });

  it("retention window is 30 days", () => {
    expect(SAFECHAT_RETENTION_WINDOW_DAYS_PHASE_1).toBe(30);
  });

  it("guardian-summary reason token is scoped to Phase 1", () => {
    expect(SAFECHAT_GUARDIAN_SUMMARY_PHASE_1_REASON).toBe(
      "safechat_guardian_summary_not_in_phase_1",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// §2 · readSafeChatFeatureStatus
// ─────────────────────────────────────────────────────────────────────

describe("readSafeChatFeatureStatus", () => {
  it("returns phase1LoggingEnabled=false when env var is unset", () => {
    const r = readSafeChatFeatureStatus();
    expect(r.phase1LoggingEnabled).toBe(false);
  });

  it("returns phase1LoggingEnabled=true only when env var is literally 'true'", () => {
    process.env.NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED = "true";
    expect(readSafeChatFeatureStatus().phase1LoggingEnabled).toBe(true);
    process.env.NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED = "1";
    expect(readSafeChatFeatureStatus().phase1LoggingEnabled).toBe(false);
    process.env.NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED = "TRUE";
    expect(readSafeChatFeatureStatus().phase1LoggingEnabled).toBe(false);
  });

  it("userFacingEnabled is ALWAYS false (Phase 1 ceiling)", () => {
    process.env.NEX_SAFECHAT_USER_FACING_ENABLED = "true";
    const r = readSafeChatFeatureStatus();
    expect(r.userFacingEnabled).toBe(false);
  });

  it("simulated is ALWAYS true (Phase 1 ceiling)", () => {
    const r = readSafeChatFeatureStatus();
    expect(r.simulated).toBe(true);
  });

  it("guardianSummariesAvailable is ALWAYS false (Phase 1 ceiling)", () => {
    const r = readSafeChatFeatureStatus();
    expect(r.guardianSummariesAvailable).toBe(false);
  });

  it("surfaces an honest reason string that mentions simulation + no guardian summaries", () => {
    const r = readSafeChatFeatureStatus();
    expect(r.honestReason.toLowerCase()).toMatch(/simulated/);
    expect(r.honestReason.toLowerCase()).toMatch(/no summaries|not produced|no guardian/i);
  });

  it("returns ONLY the sealed-shape keys · no account ids, no classification data", () => {
    const r = readSafeChatFeatureStatus();
    const keys = Object.keys(r).sort();
    expect(keys).toEqual(
      [
        "classifierVersion",
        "phase1LoggingEnabled",
        "userFacingEnabled",
        "simulated",
        "retentionWindowDays",
        "guardianSummariesAvailable",
        "honestReason",
      ].sort(),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// §3 · readSafeChatGuardianSummaryForChild
// ─────────────────────────────────────────────────────────────────────

describe("readSafeChatGuardianSummaryForChild", () => {
  it("ALWAYS returns unavailable in Phase 1", () => {
    const r = readSafeChatGuardianSummaryForChild();
    expect(r.available).toBe(false);
    if (!r.available) {
      expect(r.reason).toBe(SAFECHAT_GUARDIAN_SUMMARY_PHASE_1_REASON);
      expect(r.simulated).toBe(true);
    }
  });

  it("even when caller sets flags · still unavailable", () => {
    process.env.NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED = "true";
    process.env.NEX_SAFECHAT_USER_FACING_ENABLED = "true";
    const r = readSafeChatGuardianSummaryForChild();
    expect(r.available).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// §4 · Source · no classifier imports / no classification queries
// ─────────────────────────────────────────────────────────────────────

describe("safechat-status-reader.ts source · privacy invariants", () => {
  function stripComments(s: string): string {
    return s
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "")
      .replace(/[ \t]+\/\/.*$/gm, "");
  }
  const src = stripComments(
    fs.readFileSync(
      path.join(__dirname, "safechat-status-reader.ts"),
      "utf8",
    ),
  );

  it("does NOT import classifier / classification-logger / pattern-detector / aggregator / retention", () => {
    expect(src).not.toMatch(/safechat\/classifier\b/);
    expect(src).not.toMatch(/safechat\/classification-logger/);
    expect(src).not.toMatch(/safechat\/pattern-detector/);
    expect(src).not.toMatch(/safechat\/conversation-signal-aggregator/);
    expect(src).not.toMatch(/safechat\/retention-sweep/);
  });

  it("the ONLY safechat/* import is the feature-flag module", () => {
    const safechatImports =
      src.match(/from\s+["'][^"']*safechat\/[^"']+["']/g) ?? [];
    for (const imp of safechatImports) {
      expect(imp).toMatch(/safechat\/feature-flag/);
    }
  });

  it("does NOT query nex.safechat_classification or related tables", () => {
    expect(src).not.toMatch(/nex\.safechat_classification/i);
    expect(src).not.toMatch(/\brule_matches\b/i);
    expect(src).not.toMatch(/\bsignals\b/i);
    expect(src).not.toMatch(/\bciphertext\b/i);
    expect(src).not.toMatch(/\bplaintext\b/i);
  });

  it("does NOT read from the DB at all · no withClient import", () => {
    expect(src).not.toMatch(/from\s+["']@\/lib\/nex\/db["']/);
  });
});
