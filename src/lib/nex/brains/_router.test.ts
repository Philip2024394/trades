import { beforeEach, describe, expect, it } from "vitest";
import { brainRegistry, loadBrain } from "./_loader";
import { DomainSeparationError, retrieveFromBrain, retrieveFromBrains } from "./_router";
import { fixtureBrainPack } from "./__tests__/_fixture_only";

function seed(slug: string, status = "published") {
  brainRegistry.register(loadBrain(fixtureBrainPack({ slug, status })));
}

beforeEach(() => brainRegistry.clear());

describe("retrieveFromBrains — ADR-0021 enforcement", () => {
  it("refuses an empty brain_slugs array", () => {
    expect(() => retrieveFromBrains({ brain_slugs: [], query: "test1" }))
      .toThrow(DomainSeparationError);
  });

  it("refuses a wildcard slug", () => {
    expect(() => retrieveFromBrains({ brain_slugs: ["*"], query: "test1" }))
      .toThrow(DomainSeparationError);
  });

  it("refuses a non-array brain_slugs", () => {
    expect(() => retrieveFromBrains({ brain_slugs: "fixture_a" as unknown as string[], query: "test1" }))
      .toThrow(DomainSeparationError);
  });

  it("refuses an unregistered brain", () => {
    expect(() => retrieveFromBrains({ brain_slugs: ["missing_brain"], query: "test1" }))
      .toThrow(DomainSeparationError);
  });

  it("refuses a non-published brain", () => {
    seed("fixture_draft", "draft");
    expect(() => retrieveFromBrains({ brain_slugs: ["fixture_draft"], query: "test1" }))
      .toThrow(DomainSeparationError);
  });

  it("refuses a malformed slug", () => {
    expect(() => retrieveFromBrains({ brain_slugs: ["Invalid Slug"], query: "test1" }))
      .toThrow(DomainSeparationError);
  });

  it("returns hits from a published brain", () => {
    seed("fixture_ok");
    const result = retrieveFromBrains({ brain_slugs: ["fixture_ok"], query: "test1" });
    expect(result.status).toBe("ok");
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.provenance.context_domains).toContain("brain:fixture_ok");
  });

  it("returns not_found when query matches nothing", () => {
    seed("fixture_ok");
    const result = retrieveFromBrains({ brain_slugs: ["fixture_ok"], query: "totally-unrelated-query" });
    expect(result.status).toBe("not_found");
    expect(result.data).toEqual([]);
  });

  it("logs one context_domain per brain queried", () => {
    seed("fixture_a");
    seed("fixture_b");
    const result = retrieveFromBrains({ brain_slugs: ["fixture_a", "fixture_b"], query: "test1" });
    expect(result.provenance.context_domains.sort()).toEqual(["brain:fixture_a", "brain:fixture_b"]);
  });

  it("caps limit at MAX_LIMIT", () => {
    seed("fixture_ok");
    const result = retrieveFromBrains({ brain_slugs: ["fixture_ok"], query: "test1", limit: 1000 });
    expect(result.data.length).toBeLessThanOrEqual(25);
  });
});

describe("retrieveFromBrain — single-Brain wrapper", () => {
  it("delegates to retrieveFromBrains", () => {
    seed("fixture_ok");
    const result = retrieveFromBrain({ brain_slug: "fixture_ok", query: "test1" });
    expect(result.status).toBe("ok");
  });
});
