// src/lib/nex/brain/confirmation-parser.test.ts
//
// Stage 3.37 · Confirmation parser doctrine tests.
//
// Locks the CONFIRM / DECLINE / AMBIGUOUS three-way discipline · never
// widens "okay" or "sure" into authorization.

import { describe, expect, it } from "vitest";
import { parseConfirmation } from "./confirmation-parser";

describe("parseConfirmation · CONFIRM · English", () => {
  it.each([
    "yes",
    "Yes.",
    "yes send it",
    "Yes, send it",
    "yes please",
    "send it",
    "please send",
    "go ahead",
    "do it",
    "confirm",
    "Confirmed.",
    "please do",
    "proceed",
  ])("recognises %j as CONFIRM · en", (msg) => {
    const r = parseConfirmation(msg);
    expect(r.kind).toBe("CONFIRM");
    if (r.kind === "CONFIRM") expect(r.language).toBe("en");
  });
});

describe("parseConfirmation · CONFIRM · Indonesian", () => {
  it.each([
    "iya",
    "Iya.",
    "ya",
    "iya kirim",
    "kirim saja",
    "kirim",
    "silakan",
    "silakan kirim",
    "tolong kirim",
    "lanjut",
    "lanjutkan",
  ])("recognises %j as CONFIRM · id", (msg) => {
    const r = parseConfirmation(msg);
    expect(r.kind).toBe("CONFIRM");
    if (r.kind === "CONFIRM") expect(r.language).toBe("id");
  });
});

describe("parseConfirmation · DECLINE · English", () => {
  it.each([
    "no",
    "No.",
    "don't send",
    "do not send",
    "do not message",
    "cancel",
    "stop",
    "not now",
    "never mind",
    "skip it",
    "abort",
  ])("recognises %j as DECLINE · en", (msg) => {
    const r = parseConfirmation(msg);
    expect(r.kind).toBe("DECLINE");
    if (r.kind === "DECLINE") expect(r.language).toBe("en");
  });
});

describe("parseConfirmation · DECLINE · Indonesian", () => {
  it.each([
    "jangan",
    "batalkan",
    "batal",
    "tidak usah",
    "tidak jadi",
  ])("recognises %j as DECLINE · id", (msg) => {
    const r = parseConfirmation(msg);
    expect(r.kind).toBe("DECLINE");
    if (r.kind === "DECLINE") expect(r.language).toBe("id");
  });
});

describe("parseConfirmation · AMBIGUOUS · never authorizes", () => {
  it.each([
    "okay",
    "OK",
    "ok",
    "okey",
    "k",
    "sure",
    "fine",
    "maybe",
    "hmm",
    "hmmm",
    "oke",
    "",
    "what does that mean?",
    "cool",
    "alright then",
  ])("returns AMBIGUOUS for %j", (msg) => {
    const r = parseConfirmation(msg);
    expect(r.kind).toBe("AMBIGUOUS");
  });
});

describe("parseConfirmation · DECLINE beats CONFIRM · 'no, don't send' does not confirm", () => {
  it("'no, don't send' → DECLINE, never CONFIRM even though it contains 'send'", () => {
    const r = parseConfirmation("no, don't send");
    expect(r.kind).toBe("DECLINE");
  });
  it("'jangan kirim' → DECLINE, not CONFIRM", () => {
    const r = parseConfirmation("jangan kirim");
    expect(r.kind).toBe("DECLINE");
  });
});
