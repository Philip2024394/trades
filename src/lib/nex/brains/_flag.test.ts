import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nexBrainRuntimeEnabled } from "./_flag";

const ORIGINAL = process.env.NEX_BRAIN_RUNTIME_ENABLED;

beforeEach(() => { delete process.env.NEX_BRAIN_RUNTIME_ENABLED; });
afterEach(() => {
  if (ORIGINAL == null) delete process.env.NEX_BRAIN_RUNTIME_ENABLED;
  else process.env.NEX_BRAIN_RUNTIME_ENABLED = ORIGINAL;
});

describe("nexBrainRuntimeEnabled", () => {
  it("is OFF when env var is unset", () => {
    expect(nexBrainRuntimeEnabled()).toBe(false);
  });

  it("is OFF for '0'", () => {
    process.env.NEX_BRAIN_RUNTIME_ENABLED = "0";
    expect(nexBrainRuntimeEnabled()).toBe(false);
  });

  it("is ON for '1'", () => {
    process.env.NEX_BRAIN_RUNTIME_ENABLED = "1";
    expect(nexBrainRuntimeEnabled()).toBe(true);
  });

  it("is ON for 'true'", () => {
    process.env.NEX_BRAIN_RUNTIME_ENABLED = "true";
    expect(nexBrainRuntimeEnabled()).toBe(true);
  });

  it("is ON for 'YES'", () => {
    process.env.NEX_BRAIN_RUNTIME_ENABLED = "YES";
    expect(nexBrainRuntimeEnabled()).toBe(true);
  });

  it("is OFF for 'maybe'", () => {
    process.env.NEX_BRAIN_RUNTIME_ENABLED = "maybe";
    expect(nexBrainRuntimeEnabled()).toBe(false);
  });
});
