// src/lib/nex-transport-acquisition/source-classification.test.ts

import { describe, it, expect } from "vitest";
import { classifyTransportSource } from "./source-classification";

describe("Source classification · public sources accepted", () => {
  it("Google Maps public listing → public_maps_listing", () => {
    const r = classifyTransportSource({ sourceUrl: "https://maps.google.com/?cid=12345" });
    expect(r.status).toBe("ACCEPTED");
    if (r.status === "ACCEPTED") expect(r.sourceKind).toBe("public_maps_listing");
  });

  it("wa.me → public_whatsapp_business_link", () => {
    const r = classifyTransportSource({ sourceUrl: "https://wa.me/6281234567890" });
    expect(r.status).toBe("ACCEPTED");
    if (r.status === "ACCEPTED") expect(r.sourceKind).toBe("public_whatsapp_business_link");
  });

  it("api.whatsapp.com/send → public_whatsapp_business_link", () => {
    const r = classifyTransportSource({ sourceUrl: "https://api.whatsapp.com/send?phone=6281234567890" });
    expect(r.status).toBe("ACCEPTED");
    if (r.status === "ACCEPTED") expect(r.sourceKind).toBe("public_whatsapp_business_link");
  });

  it("facebook.com → public_facebook_business_page", () => {
    const r = classifyTransportSource({ sourceUrl: "https://www.facebook.com/BudiTransportJogja" });
    expect(r.status).toBe("ACCEPTED");
    if (r.status === "ACCEPTED") expect(r.sourceKind).toBe("public_facebook_business_page");
  });

  it("instagram.com → public_instagram_business_profile", () => {
    const r = classifyTransportSource({ sourceUrl: "https://www.instagram.com/rentalmobiljogja" });
    expect(r.status).toBe("ACCEPTED");
    if (r.status === "ACCEPTED") expect(r.sourceKind).toBe("public_instagram_business_profile");
  });

  it("marketplace (OLX) → public_marketplace_listing", () => {
    const r = classifyTransportSource({ sourceUrl: "https://www.olx.co.id/item/rental-mobil-jogja-abc" });
    expect(r.status).toBe("ACCEPTED");
    if (r.status === "ACCEPTED") expect(r.sourceKind).toBe("public_marketplace_listing");
  });

  it("recruitment site (Jobstreet) → public_recruitment_advertisement", () => {
    const r = classifyTransportSource({ sourceUrl: "https://www.jobstreet.co.id/job/driver-jogja-123" });
    expect(r.status).toBe("ACCEPTED");
    if (r.status === "ACCEPTED") expect(r.sourceKind).toBe("public_recruitment_advertisement");
  });

  it("bespoke public business site with operator hint + public evidence note → accepted", () => {
    const r = classifyTransportSource({
      sourceUrl: "https://rentalmobiljogja.example.com",
      operatorHint: "public_business_website",
      publicEvidenceNote: "Public business homepage listing phone + service areas.",
    });
    expect(r.status).toBe("ACCEPTED");
    if (r.status === "ACCEPTED") expect(r.sourceKind).toBe("public_business_website");
  });
});

describe("Source classification · REJECTS disallowed sources", () => {
  it("chat.whatsapp.com group invite → REJECTED / CLOSED_SOCIAL_GROUP", () => {
    const r = classifyTransportSource({ sourceUrl: "https://chat.whatsapp.com/ABC123DEF" });
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("CLOSED_SOCIAL_GROUP");
  });

  it("URL path contains 'leaked' → REJECTED / PRIVATE_OR_LEAKED_DATABASE", () => {
    const r = classifyTransportSource({ sourceUrl: "https://somesite.com/leaked/drivers.csv" });
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("PRIVATE_OR_LEAKED_DATABASE");
  });

  it("pastebin host → REJECTED / PRIVATE_OR_LEAKED_DATABASE", () => {
    const r = classifyTransportSource({ sourceUrl: "https://pastebin.com/abc123" });
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("PRIVATE_OR_LEAKED_DATABASE");
  });

  it("URL path contains 'scrape' → REJECTED", () => {
    const r = classifyTransportSource({ sourceUrl: "https://someaggregator.com/scrape/results.json" });
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("PRIVATE_OR_LEAKED_DATABASE");
  });

  it("intranet host → REJECTED / REQUIRES_LOGIN_OR_PRIVATE", () => {
    const r = classifyTransportSource({ sourceUrl: "https://intranet.example.com/drivers" });
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("REQUIRES_LOGIN_OR_PRIVATE");
  });

  it("empty URL → REJECTED / EMPTY_OR_INVALID_URL", () => {
    const r = classifyTransportSource({ sourceUrl: "" });
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("EMPTY_OR_INVALID_URL");
  });

  it("unrecognised host without operator hint → REJECTED / UNRECOGNISED_SOURCE", () => {
    const r = classifyTransportSource({ sourceUrl: "https://random-forum.example.net/thread/12345" });
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("UNRECOGNISED_SOURCE");
  });

  it("other_public_business_source hint without publicEvidenceNote → REJECTED", () => {
    const r = classifyTransportSource({
      sourceUrl: "https://obscure-blog.example.net/post",
      operatorHint: "other_public_business_source",
    });
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("MISSING_PUBLIC_EVIDENCE_NOTE");
  });

  it("operator hint = unknown_or_disallowed → REJECTED", () => {
    const r = classifyTransportSource({
      sourceUrl: "https://random-forum.example.net/thread/12345",
      operatorHint: "unknown_or_disallowed" as never,
    });
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("OPERATOR_HINT_UNRECOGNISED");
  });
});

describe("Source classification · reject rules trump operator hints", () => {
  it("leaked path still rejected even with public_business_website hint", () => {
    const r = classifyTransportSource({
      sourceUrl: "https://example.com/leaked/list.txt",
      operatorHint: "public_business_website",
      publicEvidenceNote: "operator claims public",
    });
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("PRIVATE_OR_LEAKED_DATABASE");
  });

  it("chat.whatsapp.com group link still rejected with a hint", () => {
    const r = classifyTransportSource({
      sourceUrl: "https://chat.whatsapp.com/ABC",
      operatorHint: "public_whatsapp_business_link",
    });
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("CLOSED_SOCIAL_GROUP");
  });
});
