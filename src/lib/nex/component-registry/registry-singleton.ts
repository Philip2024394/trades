// src/lib/nex/component-registry/registry-singleton.ts
//
// Cross-request in-memory singleton for the component registry. Preloaded
// with the registered NEX components from this build so the UI has something
// to show without waiting for the DB migration.

import { InMemoryComponentRegistry } from "./registry";
import type { ComponentRecord } from "./types";

const g = globalThis as unknown as { __nex_component_registry?: InMemoryComponentRegistry };
if (!g.__nex_component_registry) {
  const reg = new InMemoryComponentRegistry();
  const now = new Date().toISOString();
  const seed: ComponentRecord[] = [
    { name: "WorkstationClient",   version: "v1.0.0", capabilityId: "CAP-091", path: "src/app/nex-head-quarters/workstation/WorkstationClient.tsx",   nexDnaVerdict: "PASS", doctrineTags: ["adr-0316d-rule-1", "adr-0316d-rule-3"], deprecatedBy: null, registeredAt: now },
    { name: "ReviewQueueClient",   version: "v1.0.0", capabilityId: "CAP-092", path: "src/app/nex-head-quarters/review-queue/ReviewQueueClient.tsx",   nexDnaVerdict: "PASS", doctrineTags: ["adr-0316d-rule-1", "adr-0316d-rule-5"], deprecatedBy: null, registeredAt: now },
    { name: "IdeaLabClient",       version: "v1.0.0", capabilityId: "CAP-093", path: "src/app/nex-head-quarters/idea-lab/IdeaLabClient.tsx",           nexDnaVerdict: "PASS", doctrineTags: ["adr-0316d-rule-5"], deprecatedBy: null, registeredAt: now },
    { name: "SecurityHqClient",    version: "v1.0.0", capabilityId: "CAP-094", path: "src/app/nex-head-quarters/security/SecurityHqClient.tsx",         nexDnaVerdict: "PASS", doctrineTags: ["adr-0316a", "adr-0316d-rule-1"], deprecatedBy: null, registeredAt: now },
    { name: "SectionInterventionClient", version: "v1.0.0", capabilityId: "CAP-095", path: "src/app/nex-head-quarters/section-intervention/SectionInterventionClient.tsx", nexDnaVerdict: "PASS", doctrineTags: ["adr-0316c"], deprecatedBy: null, registeredAt: now },
    { name: "EmailMarketingHqClient", version: "v1.0.0", capabilityId: "CAP-096", path: "src/app/nex-head-quarters/email-marketing/EmailMarketingHqClient.tsx", nexDnaVerdict: "PASS", doctrineTags: ["adr-0316d-rule-3"], deprecatedBy: null, registeredAt: now },
    { name: "ComponentRegistryClient", version: "v1.0.0", capabilityId: "CAP-097", path: "src/app/nex-head-quarters/component-registry/ComponentRegistryClient.tsx", nexDnaVerdict: "PASS", doctrineTags: ["adr-0316d"], deprecatedBy: null, registeredAt: now },
  ];
  for (const r of seed) reg.register(r);
  g.__nex_component_registry = reg;
}
export const componentRegistry: InMemoryComponentRegistry = g.__nex_component_registry;
