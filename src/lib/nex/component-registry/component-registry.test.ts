// src/lib/nex/component-registry/component-registry.test.ts

import { describe, it, expect } from "vitest";
import { InMemoryComponentRegistry, validateComponent } from "./index";
import type { ComponentRecord } from "./index";

const mk = (overrides: Partial<ComponentRecord> = {}): ComponentRecord => ({
  name: "Button",
  version: "v1.0.0",
  capabilityId: "CAP-091",
  path: "src/components/nex/Button.tsx",
  nexDnaVerdict: "PASS",
  doctrineTags: ["adr-0316d-rule-5"],
  deprecatedBy: null,
  registeredAt: new Date().toISOString(),
  ...overrides,
});

describe("validateComponent", () => {
  it("accepts well-formed", () => {
    const r = validateComponent({
      name: "Button",
      version: "v1.0.0",
      capabilityId: "CAP-091",
      path: "src/components/nex/Button.tsx",
    });
    expect(r.ok).toBe(true);
  });

  it("rejects non-PascalCase name", () => {
    const r = validateComponent({
      name: "button",
      version: "v1.0.0",
      capabilityId: "CAP-091",
      path: "x",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.component_bad_name");
  });

  it("rejects bad semver", () => {
    const r = validateComponent({
      name: "Button",
      version: "1.0.0",
      capabilityId: "CAP-091",
      path: "x",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.component_bad_version");
  });

  it("rejects bad capability", () => {
    const r = validateComponent({
      name: "Button",
      version: "v1.0.0",
      capabilityId: "cap-1",
      path: "x",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.component_bad_capability");
  });
});

describe("InMemoryComponentRegistry", () => {
  it("register + query byName", () => {
    const reg = new InMemoryComponentRegistry();
    reg.register(mk({ version: "v1.0.0" }));
    reg.register(mk({ version: "v1.1.0" }));
    const results = reg.query({ kind: "byName", name: "Button" });
    expect(results.length).toBe(2);
  });

  it("query byNameVersion returns exact match", () => {
    const reg = new InMemoryComponentRegistry();
    reg.register(mk({ version: "v1.0.0" }));
    reg.register(mk({ version: "v1.1.0" }));
    const results = reg.query({ kind: "byNameVersion", name: "Button", version: "v1.1.0" });
    expect(results.length).toBe(1);
    expect(results[0].version).toBe("v1.1.0");
  });

  it("query byCapability groups by CAP", () => {
    const reg = new InMemoryComponentRegistry();
    reg.register(mk({ name: "Button", capabilityId: "CAP-091" }));
    reg.register(mk({ name: "Card", capabilityId: "CAP-091" }));
    reg.register(mk({ name: "Modal", capabilityId: "CAP-092" }));
    expect(reg.query({ kind: "byCapability", capabilityId: "CAP-091" }).length).toBe(2);
    expect(reg.query({ kind: "byCapability", capabilityId: "CAP-092" }).length).toBe(1);
  });

  it("rejects duplicate name/version registration", () => {
    const reg = new InMemoryComponentRegistry();
    reg.register(mk({ version: "v1.0.0" }));
    const r = reg.register(mk({ version: "v1.0.0" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.component_duplicate_version");
  });

  it("latestOk returns latest PASS non-deprecated", () => {
    const reg = new InMemoryComponentRegistry();
    reg.register(mk({ version: "v1.0.0", nexDnaVerdict: "PASS" }));
    reg.register(mk({ version: "v1.1.0", nexDnaVerdict: "PASS" }));
    reg.register(mk({ version: "v1.2.0", nexDnaVerdict: "FAIL" }));
    const latest = reg.latestOk("Button");
    expect(latest?.version).toBe("v1.1.0");
  });

  it("latestOk skips deprecated", () => {
    const reg = new InMemoryComponentRegistry();
    reg.register(mk({ version: "v1.0.0", nexDnaVerdict: "PASS" }));
    reg.register(mk({ version: "v1.1.0", nexDnaVerdict: "PASS", deprecatedBy: "Button@v2.0.0" }));
    const latest = reg.latestOk("Button");
    expect(latest?.version).toBe("v1.0.0");
  });

  it("latestOk returns null when nothing matches", () => {
    const reg = new InMemoryComponentRegistry();
    expect(reg.latestOk("Nonexistent")).toBeNull();
  });
});
