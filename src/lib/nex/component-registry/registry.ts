// src/lib/nex/component-registry/registry.ts
//
// Stage 10 · in-memory component registry. Every registered component is
// verified for uniqueness (name, version) and NEX DNA verdict.

import type { ComponentQuery, ComponentRecord, RegistryValidation } from "./types";
import { parseSemver, compareSemver } from "../section-build/semver";

const NAME_RE = /^[A-Z][A-Za-z0-9]*$/;

export function validateComponent(input: {
  name: string;
  version: string;
  capabilityId: string;
  path: string;
}): RegistryValidation {
  if (!NAME_RE.test(input.name)) {
    return { ok: false, code: "sec.component_bad_name", reason: `Component name "${input.name}" must be PascalCase` };
  }
  if (!parseSemver(input.version)) {
    return { ok: false, code: "sec.component_bad_version", reason: `Invalid semver "${input.version}"` };
  }
  if (!/^CAP-\d+$/.test(input.capabilityId)) {
    return { ok: false, code: "sec.component_bad_capability", reason: `Invalid capability id` };
  }
  if (!input.path || input.path.length === 0) {
    return { ok: false, code: "sec.component_bad_path", reason: `Path required` };
  }
  return { ok: true };
}

export class InMemoryComponentRegistry {
  private records: ComponentRecord[] = [];

  register(record: ComponentRecord): RegistryValidation {
    const v = validateComponent(record);
    if (!v.ok) return v;
    const conflict = this.records.find(
      (r) => r.name === record.name && r.version === record.version,
    );
    if (conflict) {
      return {
        ok: false,
        code: "sec.component_duplicate_version",
        reason: `Component ${record.name}@${record.version} already registered`,
      };
    }
    this.records.push(record);
    return { ok: true };
  }

  query(q: ComponentQuery): readonly ComponentRecord[] {
    switch (q.kind) {
      case "byName":
        return this.records.filter((r) => r.name === q.name);
      case "byNameVersion":
        return this.records.filter((r) => r.name === q.name && r.version === q.version);
      case "byCapability":
        return this.records.filter((r) => r.capabilityId === q.capabilityId);
    }
  }

  /**
   * Latest non-deprecated version of a component with PASS DNA verdict.
   */
  latestOk(name: string): ComponentRecord | null {
    const eligible = this.records
      .filter((r) => r.name === name && !r.deprecatedBy && r.nexDnaVerdict === "PASS")
      .sort((a, b) => compareSemver(a.version, b.version));
    return eligible[eligible.length - 1] ?? null;
  }

  clear(): void {
    this.records = [];
  }
}
