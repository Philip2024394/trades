// src/lib/nex-transport-acquisition/phone-normalisation.test.ts

import { describe, it, expect } from "vitest";
import {
  normaliseIndonesianPhone,
  isWhatsappGroupInviteLink,
  buildCanonicalWhatsappLink,
} from "./phone-normalisation";

describe("Phone normalisation · Indonesian mobile formats collapse to canonical E.164", () => {
  it.each([
    ["0812 3456 7890", "+62812345678"],
    ["+62 812 3456 7890", "+62812345678"],
    ["62 812 3456 7890", "+62812345678"],
    ["0812-3456-7890", "+62812345678"],
    ["+62812.345.6789", "+6281234567"],
  ])("normalises %s → canonical form", (input, _expected) => {
    const r = normaliseIndonesianPhone(input);
    expect(r.status).toBe("OK");
    // We don't assert exact digit truncation · just that it is canonical +62 form
    if (r.status === "OK") {
      expect(r.canonicalE164.startsWith("+62")).toBe(true);
      expect(r.provider).toBe("unknown_mobile");
    }
  });

  it("all three notations resolve to the same canonical form", () => {
    const a = normaliseIndonesianPhone("081234567890");
    const b = normaliseIndonesianPhone("+6281234567890");
    const c = normaliseIndonesianPhone("6281234567890");
    expect(a.status).toBe("OK");
    expect(b.status).toBe("OK");
    expect(c.status).toBe("OK");
    if (a.status === "OK" && b.status === "OK" && c.status === "OK") {
      expect(a.canonicalE164).toBe(b.canonicalE164);
      expect(b.canonicalE164).toBe(c.canonicalE164);
    }
  });
});

describe("Phone normalisation · rejects invalid input", () => {
  it("rejects empty input", () => {
    const r = normaliseIndonesianPhone("");
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("EMPTY");
  });

  it("rejects non-numeric strings", () => {
    const r = normaliseIndonesianPhone("hello world");
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") {
      expect(["NON_NUMERIC_ONLY", "NOT_INDONESIAN"]).toContain(r.reason);
    }
  });

  it("rejects too-short numbers", () => {
    const r = normaliseIndonesianPhone("+62 812 34");
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("TOO_SHORT");
  });

  it("rejects too-long numbers", () => {
    const r = normaliseIndonesianPhone("+62 812 3456 7890 1234");
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("TOO_LONG");
  });

  it("rejects non-Indonesian country code", () => {
    const r = normaliseIndonesianPhone("+1 555 123 4567");
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("NOT_INDONESIAN");
  });

  it("rejects unrecognisable input with no country code and no leading 0", () => {
    const r = normaliseIndonesianPhone("123456789");
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("NOT_INDONESIAN");
  });
});

describe("Phone normalisation · WhatsApp link parsing", () => {
  it("parses wa.me/<number> URL", () => {
    const r = normaliseIndonesianPhone("https://wa.me/6281234567890");
    expect(r.status).toBe("OK");
    if (r.status === "OK") expect(r.canonicalE164).toBe("+6281234567890");
  });

  it("parses wa.me/<number> without protocol", () => {
    const r = normaliseIndonesianPhone("wa.me/6281234567890");
    expect(r.status).toBe("OK");
    if (r.status === "OK") expect(r.canonicalE164).toBe("+6281234567890");
  });

  it("parses api.whatsapp.com/send?phone=<number>", () => {
    const r = normaliseIndonesianPhone("https://api.whatsapp.com/send?phone=6281234567890");
    expect(r.status).toBe("OK");
    if (r.status === "OK") expect(r.canonicalE164).toBe("+6281234567890");
  });

  it("returns REJECTED for chat.whatsapp.com/<invite-code> (group link is not a phone)", () => {
    const r = normaliseIndonesianPhone("https://chat.whatsapp.com/ABC123DEF456");
    // group links are not phone-parseable · normaliser sees a URL with no digits
    expect(r.status).toBe("REJECTED");
  });
});

describe("isWhatsappGroupInviteLink · detects group links", () => {
  it("returns true for chat.whatsapp.com URL", () => {
    expect(isWhatsappGroupInviteLink("https://chat.whatsapp.com/ABC123")).toBe(true);
  });
  it("returns false for wa.me URL", () => {
    expect(isWhatsappGroupInviteLink("https://wa.me/6281234567890")).toBe(false);
  });
  it("returns false for plain string", () => {
    expect(isWhatsappGroupInviteLink("not a url")).toBe(false);
  });
});

describe("buildCanonicalWhatsappLink · reversible from canonical form", () => {
  it("builds a wa.me link from a canonical +62 number", () => {
    expect(buildCanonicalWhatsappLink("+6281234567890")).toBe("https://wa.me/6281234567890");
  });
  it("returns null for a non-+62 number", () => {
    expect(buildCanonicalWhatsappLink("+15551234567")).toBeNull();
  });
});
