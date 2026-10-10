// src/lib/nex-native/family-safety/feature-flag.test.ts
//
// Unit tests for the Family Safety feature flags.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isFamilySafetyEnabled,
  isFamilySafetyProductionAuthorised,
} from "./feature-flag";

const ENABLED = "NEX_FAMILY_SAFETY_ENABLED";
const AUTHORISED = "NEX_FAMILY_SAFETY_PRODUCTION_AUTHORISED";

let origEnabled: string | undefined;
let origAuthorised: string | undefined;

beforeEach(() => {
  origEnabled = process.env[ENABLED];
  origAuthorised = process.env[AUTHORISED];
  delete process.env[ENABLED];
  delete process.env[AUTHORISED];
});

afterEach(() => {
  if (origEnabled === undefined) delete process.env[ENABLED];
  else process.env[ENABLED] = origEnabled;
  if (origAuthorised === undefined) delete process.env[AUTHORISED];
  else process.env[AUTHORISED] = origAuthorised;
});

describe("isFamilySafetyEnabled · defaults TRUE", () => {
  it("returns TRUE when the env var is unset", () => {
    expect(isFamilySafetyEnabled()).toBe(true);
  });

  it("returns TRUE when the env var is empty", () => {
    process.env[ENABLED] = "";
    expect(isFamilySafetyEnabled()).toBe(true);
  });

  it("returns TRUE for 'true'", () => {
    process.env[ENABLED] = "true";
    expect(isFamilySafetyEnabled()).toBe(true);
  });

  it("returns FALSE only for the literal 'false' (any case)", () => {
    process.env[ENABLED] = "false";
    expect(isFamilySafetyEnabled()).toBe(false);
    process.env[ENABLED] = "FALSE";
    expect(isFamilySafetyEnabled()).toBe(false);
    process.env[ENABLED] = "False";
    expect(isFamilySafetyEnabled()).toBe(false);
  });

  it("returns TRUE for ambiguous values ('0', 'off', 'no')", () => {
    for (const v of ["0", "off", "no", "disabled", "nope"]) {
      process.env[ENABLED] = v;
      expect(isFamilySafetyEnabled(), `v=${v}`).toBe(true);
    }
  });

  it("trims surrounding whitespace", () => {
    process.env[ENABLED] = "  false  ";
    expect(isFamilySafetyEnabled()).toBe(false);
  });
});

describe("isFamilySafetyProductionAuthorised · defaults FALSE", () => {
  it("returns FALSE when the env var is unset", () => {
    expect(isFamilySafetyProductionAuthorised()).toBe(false);
  });

  it("returns FALSE when the env var is empty", () => {
    process.env[AUTHORISED] = "";
    expect(isFamilySafetyProductionAuthorised()).toBe(false);
  });

  it("returns TRUE only for the literal 'true' (any case)", () => {
    process.env[AUTHORISED] = "true";
    expect(isFamilySafetyProductionAuthorised()).toBe(true);
    process.env[AUTHORISED] = "TRUE";
    expect(isFamilySafetyProductionAuthorised()).toBe(true);
    process.env[AUTHORISED] = "True";
    expect(isFamilySafetyProductionAuthorised()).toBe(true);
  });

  it("returns FALSE for ambiguous positive values ('1', 'yes', 'on')", () => {
    for (const v of ["1", "yes", "on", "enabled", "yep"]) {
      process.env[AUTHORISED] = v;
      expect(isFamilySafetyProductionAuthorised(), `v=${v}`).toBe(false);
    }
  });

  it("trims surrounding whitespace", () => {
    process.env[AUTHORISED] = "  true  ";
    expect(isFamilySafetyProductionAuthorised()).toBe(true);
  });
});

describe("flag independence", () => {
  it("enabled=true + authorised=false is the DEFAULT shape", () => {
    expect(isFamilySafetyEnabled()).toBe(true);
    expect(isFamilySafetyProductionAuthorised()).toBe(false);
  });

  it("enabled=false + authorised=true is a legal (if unusual) combination", () => {
    process.env[ENABLED] = "false";
    process.env[AUTHORISED] = "true";
    expect(isFamilySafetyEnabled()).toBe(false);
    expect(isFamilySafetyProductionAuthorised()).toBe(true);
  });
});
