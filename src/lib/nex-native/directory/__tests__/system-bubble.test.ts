// src/lib/nex-native/directory/__tests__/system-bubble.test.ts
//
// NEX Directory · Phase C (Agent C) · tests for `buildSystemBubble`.
//
// Scope
//   · The with-city path includes "in <city>" exactly once.
//   · The no-city path omits the location phrase entirely (undefined,
//     null, empty string, and whitespace-only all collapse to "no city").
//   · Length cap · the body is ≤ 240 chars for every call.
//   · Truncation guard · a deliberately long business name does not
//     break the length cap (even though the current copy doesn't weave
//     the name in, the function signature carries it and must remain
//     bounded).
//
// Pure · deterministic · no network, no clock.

import { describe, it, expect } from "vitest";

import {
  buildSystemBubble,
  SYSTEM_BUBBLE_META_KIND,
  SYSTEM_BUBBLE_MAX_CHARS,
} from "../system-bubble";

describe("buildSystemBubble", () => {
  it("includes the city phrase when visitorLocation.city is a non-empty string", () => {
    const body = buildSystemBubble({
      businessName: "Warung Mama",
      visitorLocation: { city: "Jakarta", country: "ID" },
    });
    expect(body).toContain("a customer in Jakarta would like to connect with you");
    expect(body).toContain("claim your free NEX listing");
    expect(body.length).toBeLessThanOrEqual(SYSTEM_BUBBLE_MAX_CHARS);
  });

  it("omits the city phrase when visitorLocation is null, undefined, empty, or whitespace", () => {
    const expected = "a customer would like to connect with you";

    const noArg = buildSystemBubble({ businessName: "Sunset Villas" });
    expect(noArg).toContain(expected);
    expect(noArg).not.toMatch(/\bin\s+\S+\s+would like/);

    const nullArg = buildSystemBubble({
      businessName: "Sunset Villas",
      visitorLocation: null,
    });
    expect(nullArg).toContain(expected);
    expect(nullArg).not.toMatch(/\bin\s+\S+\s+would like/);

    const nullCity = buildSystemBubble({
      businessName: "Sunset Villas",
      visitorLocation: { city: null, country: "ID" },
    });
    expect(nullCity).toContain(expected);
    expect(nullCity).not.toMatch(/\bin\s+\S+\s+would like/);

    const emptyCity = buildSystemBubble({
      businessName: "Sunset Villas",
      visitorLocation: { city: "", country: "ID" },
    });
    expect(emptyCity).toContain(expected);
    expect(emptyCity).not.toMatch(/\bin\s+\S+\s+would like/);

    const whitespaceCity = buildSystemBubble({
      businessName: "Sunset Villas",
      visitorLocation: { city: "   ", country: "ID" },
    });
    expect(whitespaceCity).toContain(expected);
    expect(whitespaceCity).not.toMatch(/\bin\s+\S+\s+would like/);
  });

  it("stays within the 240-char cap for a very long business name", () => {
    const longName = "A".repeat(500);
    const body = buildSystemBubble({
      businessName: longName,
      visitorLocation: { city: "Kuala Lumpur" },
    });
    expect(body.length).toBeLessThanOrEqual(SYSTEM_BUBBLE_MAX_CHARS);
    // The business name is not woven into the body today · verify so a
    // future copy change that DOES weave it in reintroduces the length
    // cap test deliberately rather than silently.
    expect(body).not.toContain(longName);
  });

  it("exposes the sealed meta.kind marker for the actions layer", () => {
    expect(SYSTEM_BUBBLE_META_KIND).toBe("nex_directory_first_contact_v1");
  });
});
