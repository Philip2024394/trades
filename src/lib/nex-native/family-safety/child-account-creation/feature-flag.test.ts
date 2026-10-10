// src/lib/nex-native/family-safety/child-account-creation/feature-flag.test.ts
//
// Unit tests for the Child Account Creation feature flags.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isChildCreateUIEnabled,
  isChildCreateLiveModeEnabled,
  isIdVerifierManualOverrideEnabled,
} from "./feature-flag";

const UI_FLAG = "NEX_FAMILY_SAFETY_CHILD_CREATE_UI_ENABLED";
const LIVE_FLAG = "NEX_FAMILY_SAFETY_CHILD_CREATE_LIVE_MODE";
const OVERRIDE_FLAG = "NEX_FAMILY_SAFETY_ID_VERIFIER_MANUAL_OVERRIDE";

let originalUi: string | undefined;
let originalLive: string | undefined;
let originalOverride: string | undefined;

beforeEach(() => {
  originalUi = process.env[UI_FLAG];
  originalLive = process.env[LIVE_FLAG];
  originalOverride = process.env[OVERRIDE_FLAG];
  delete process.env[UI_FLAG];
  delete process.env[LIVE_FLAG];
  delete process.env[OVERRIDE_FLAG];
});

afterEach(() => {
  if (originalUi === undefined) delete process.env[UI_FLAG];
  else process.env[UI_FLAG] = originalUi;
  if (originalLive === undefined) delete process.env[LIVE_FLAG];
  else process.env[LIVE_FLAG] = originalLive;
  if (originalOverride === undefined) delete process.env[OVERRIDE_FLAG];
  else process.env[OVERRIDE_FLAG] = originalOverride;
});

describe("isChildCreateUIEnabled", () => {
  it("defaults TRUE when env var is unset", () => {
    expect(isChildCreateUIEnabled()).toBe(true);
  });

  it("returns FALSE when env var is literal 'false'", () => {
    process.env[UI_FLAG] = "false";
    expect(isChildCreateUIEnabled()).toBe(false);
  });

  it("returns FALSE when env var is literal 'FALSE' (case-insensitive)", () => {
    process.env[UI_FLAG] = "FALSE";
    expect(isChildCreateUIEnabled()).toBe(false);
  });

  it("returns TRUE for empty string", () => {
    process.env[UI_FLAG] = "";
    expect(isChildCreateUIEnabled()).toBe(true);
  });

  it("returns TRUE for any non-false value", () => {
    process.env[UI_FLAG] = "no";
    expect(isChildCreateUIEnabled()).toBe(true);
  });
});

describe("isChildCreateLiveModeEnabled", () => {
  it("defaults FALSE when env var is unset", () => {
    expect(isChildCreateLiveModeEnabled()).toBe(false);
  });

  it("returns TRUE only for literal 'true'", () => {
    process.env[LIVE_FLAG] = "true";
    expect(isChildCreateLiveModeEnabled()).toBe(true);
  });

  it("returns TRUE for 'TRUE' case-insensitively", () => {
    process.env[LIVE_FLAG] = "TRUE";
    expect(isChildCreateLiveModeEnabled()).toBe(true);
  });

  it("returns FALSE for 'yes' / '1' / empty / other truthy-ish strings", () => {
    for (const v of ["yes", "1", "", " ", "on", "0", "false"]) {
      process.env[LIVE_FLAG] = v;
      expect(isChildCreateLiveModeEnabled()).toBe(false);
    }
  });

  it("trims whitespace before comparison (compat with .env.local quirks)", () => {
    process.env[LIVE_FLAG] = "  true  ";
    expect(isChildCreateLiveModeEnabled()).toBe(true);
  });
});

describe("isIdVerifierManualOverrideEnabled", () => {
  it("defaults FALSE when env var is unset", () => {
    expect(isIdVerifierManualOverrideEnabled()).toBe(false);
  });

  it("returns TRUE only for literal 'true'", () => {
    process.env[OVERRIDE_FLAG] = "true";
    expect(isIdVerifierManualOverrideEnabled()).toBe(true);
  });

  it("returns FALSE for every non-true value", () => {
    for (const v of ["yes", "1", "", "false"]) {
      process.env[OVERRIDE_FLAG] = v;
      expect(isIdVerifierManualOverrideEnabled()).toBe(false);
    }
  });

  it("flags are independent of one another", () => {
    process.env[UI_FLAG] = "false";
    process.env[LIVE_FLAG] = "true";
    process.env[OVERRIDE_FLAG] = "true";
    expect(isChildCreateUIEnabled()).toBe(false);
    expect(isChildCreateLiveModeEnabled()).toBe(true);
    expect(isIdVerifierManualOverrideEnabled()).toBe(true);
  });
});
