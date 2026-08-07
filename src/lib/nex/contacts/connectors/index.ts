// NEX Contact Intelligence · connector registry
//
// Central roster · every connector adds one entry here + its own file
// under ./connectors/. Consumers look up by id and call the shared runner.

import type { Connector, ConnectorDefinition } from "./types";
import { tradesConnector } from "./trades";
import { newsletterConnector } from "./newsletter";
import { contactFormConnectorDefinition } from "./contact_form";
import { manualConnectorDefinition } from "./manual";
import { fsStoreConnector } from "./fs_store";
import { csvConnectorDefinition } from "./csv";
import { crmConnector } from "./crm";

// Pull-mode connectors: have a sync() method · admin/scheduled trigger.
export const KNOWN_CONNECTORS: readonly Connector[] = [tradesConnector, newsletterConnector, fsStoreConnector, crmConnector];

// Push-mode connectors: event-driven · caller fires records · no sync().
// Definition-only; the caller (e.g. /api/contact) uses a dedicated helper
// like `recordContactFromForm()` to record each event.
export const PUSH_CONNECTORS: readonly ConnectorDefinition[] = [contactFormConnectorDefinition, manualConnectorDefinition];

// Upload-mode connectors: admin uploads a file · no external source · no
// scheduled sync. Panel renders a file picker on the card.
export const UPLOAD_CONNECTORS: readonly ConnectorDefinition[] = [csvConnectorDefinition];

// Definitions for connectors not yet built · surfaced in the Mission Control
// panel so admins see the full roadmap · never triggerable.
// Phase 3b is complete · every roadmap connector is now built.
export const PLANNED_CONNECTORS: readonly ConnectorDefinition[] = [];

export function findConnector(id: string): Connector | undefined {
  return KNOWN_CONNECTORS.find((c) => c.definition.id === id);
}

export function allDefinitions(): Array<ConnectorDefinition & { built: boolean }> {
  return [
    ...KNOWN_CONNECTORS.map((c) => ({ ...c.definition, built: true })),
    ...PUSH_CONNECTORS.map((d) => ({ ...d, built: true })),
    ...UPLOAD_CONNECTORS.map((d) => ({ ...d, built: true })),
    ...PLANNED_CONNECTORS.map((d) => ({ ...d, built: false })),
  ];
}
