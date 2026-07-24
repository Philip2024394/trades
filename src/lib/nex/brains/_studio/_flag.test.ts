import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nexAuthorStudioEnabled } from "./_flag";

const ORIGINAL = process.env.NEX_AUTHOR_STUDIO_ENABLED;

beforeEach(() => { delete process.env.NEX_AUTHOR_STUDIO_ENABLED; });
afterEach(() => {
  if (ORIGINAL == null) delete process.env.NEX_AUTHOR_STUDIO_ENABLED;
  else process.env.NEX_AUTHOR_STUDIO_ENABLED = ORIGINAL;
});

describe("nexAuthorStudioEnabled", () => {
  it("is OFF when env unset", () => {
    expect(nexAuthorStudioEnabled()).toBe(false);
  });
  it("is ON for '1'", () => {
    process.env.NEX_AUTHOR_STUDIO_ENABLED = "1";
    expect(nexAuthorStudioEnabled()).toBe(true);
  });
  it("is ON for 'true'", () => {
    process.env.NEX_AUTHOR_STUDIO_ENABLED = "true";
    expect(nexAuthorStudioEnabled()).toBe(true);
  });
  it("is OFF for 'no'", () => {
    process.env.NEX_AUTHOR_STUDIO_ENABLED = "no";
    expect(nexAuthorStudioEnabled()).toBe(false);
  });
});
