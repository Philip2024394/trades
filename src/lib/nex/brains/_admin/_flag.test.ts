import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nexBrainAdminEnabled } from "./_flag";

const ORIGINAL = process.env.NEX_BRAIN_ADMIN_ENABLED;

beforeEach(() => { delete process.env.NEX_BRAIN_ADMIN_ENABLED; });
afterEach(() => {
  if (ORIGINAL == null) delete process.env.NEX_BRAIN_ADMIN_ENABLED;
  else process.env.NEX_BRAIN_ADMIN_ENABLED = ORIGINAL;
});

describe("nexBrainAdminEnabled", () => {
  it("is OFF when unset", () => {
    expect(nexBrainAdminEnabled()).toBe(false);
  });
  it("is ON for '1'", () => {
    process.env.NEX_BRAIN_ADMIN_ENABLED = "1";
    expect(nexBrainAdminEnabled()).toBe(true);
  });
  it("is OFF for '0'", () => {
    process.env.NEX_BRAIN_ADMIN_ENABLED = "0";
    expect(nexBrainAdminEnabled()).toBe(false);
  });
});
