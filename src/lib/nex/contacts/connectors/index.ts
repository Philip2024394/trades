// NEX Contact Intelligence · connector registry
//
// Central roster · every connector adds one entry here + its own file
// under ./connectors/. Consumers look up by id and call the shared runner.

import type { Connector, ConnectorDefinition } from "./types";
import { tradesConnector } from "./trades";
import { newsletterConnector } from "./newsletter";

// All known connectors, ordered by build priority (per doctrine memory).
export const KNOWN_CONNECTORS: readonly Connector[] = [tradesConnector, newsletterConnector];

// Definitions for connectors not yet built · surfaced in the Mission Control
// panel so admins see the full roadmap · never triggerable.
export const PLANNED_CONNECTORS: readonly ConnectorDefinition[] = [
  { id: "contact-form", label: "Contact Form",           source_type: "form",         status: "planned", description: "Every /api/contact submission becomes a contact · Phase 3b.3", scheduled: false },
  { id: "manual",       label: "Manual Contact Entry",   source_type: "manual",       status: "planned", description: "Admin-added contacts via HQ form · Phase 3b.4", scheduled: false },
  { id: "csv",          label: "CSV Import",             source_type: "csv",          status: "planned", description: "Bulk CSV upload with column mapping · Phase 3b.5", scheduled: false },
  { id: "crm",          label: "CRM Records",            source_type: "crm",          status: "planned", description: "hammerex_xrated_customer / CRM tables · Phase 3b.6", scheduled: false },
  { id: "fs-store",     label: "Master Contact DB v0",   source_type: "fs-store",     status: "planned", description: "Migrate legacy filesystem-based contacts.jsonl into the registry · Phase 3b.7", scheduled: false },
];

export function findConnector(id: string): Connector | undefined {
  return KNOWN_CONNECTORS.find((c) => c.definition.id === id);
}

export function allDefinitions(): Array<ConnectorDefinition & { built: boolean }> {
  return [
    ...KNOWN_CONNECTORS.map((c) => ({ ...c.definition, built: true })),
    ...PLANNED_CONNECTORS.map((d) => ({ ...d, built: false })),
  ];
}
