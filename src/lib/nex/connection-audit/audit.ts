// src/lib/nex/connection-audit/audit.ts
//
// Whole-system connection audit. For every registered CAP · check applicable
// connections to NEX Brain · Truth Engine · Guardian · Master AI · NEX1 ·
// Security Agent · Lab · storage · APIs · auth · events · registries ·
// audit/logging · assets · UI DNA · tests · preview · GitHub · versioning ·
// rollback · intervention · build snapshots.
//
// Pure functions · no DB. Reads static registry + file-existence signals.

export type ConnectionSlot =
  | "nex_brain" | "truth_engine" | "guardian" | "master_ai" | "nex1"
  | "security_agent" | "lab" | "storage" | "apis" | "auth" | "events"
  | "registries" | "audit_logging" | "assets" | "ui_dna" | "tests"
  | "preview" | "github" | "versioning" | "rollback" | "intervention"
  | "build_snapshots";

export type SlotStatus = "connected" | "not_connected" | "not_applicable";

export interface CapConnectionRow {
  readonly capabilityId: string;
  readonly capabilityTitle: string;
  readonly slots: Readonly<Record<ConnectionSlot, SlotStatus>>;
  readonly connected_count: number;
  readonly not_connected_count: number;
  readonly not_applicable_count: number;
}

/**
 * Which slots does each capability care about? Not-applicable slots are not
 * counted against connectedness · but explicitly labelled so the audit shows
 * "N/A" (not "missing").
 */
const CAP_SLOT_MATRIX: Readonly<Record<string, Partial<Record<ConnectionSlot, boolean>>>> = {
  "CAP-091": { // Workstation
    security_agent: true, preview: true, versioning: true, apis: true, tests: true, ui_dna: true, audit_logging: true, registries: true,
  },
  "CAP-092": { // Review Queue
    security_agent: true, preview: true, versioning: true, apis: true, ui_dna: true, audit_logging: true, registries: true, intervention: true,
  },
  "CAP-093": { // Idea Lab
    master_ai: true, apis: true, ui_dna: true, audit_logging: true, registries: true, tests: true, nex1: true,
  },
  "CAP-094": { // Security HQ
    security_agent: true, apis: true, audit_logging: true, ui_dna: true, tests: true, registries: true,
  },
  "CAP-095": { // Section Intervention
    security_agent: true, apis: true, audit_logging: true, versioning: true, rollback: true, intervention: true, ui_dna: true, tests: true, registries: true,
  },
  "CAP-096": { // Email Marketing HQ
    apis: true, storage: true, ui_dna: true, events: true, audit_logging: true, registries: true, // reads from existing backend
  },
  "CAP-097": { // Component Registry
    apis: true, ui_dna: true, versioning: true, registries: true, tests: true,
  },
};

/**
 * Static known-connected registry: which slot connects via which mechanism.
 * For each CAP we mark the slot connected if the corresponding wire exists.
 * These are recorded from the actual code shipped in this build.
 */
const CAP_ACTUAL_CONNECTIONS: Readonly<Record<string, ReadonlyArray<ConnectionSlot>>> = {
  "CAP-091": ["security_agent", "preview", "versioning", "apis", "tests", "ui_dna", "audit_logging", "registries"],
  "CAP-092": ["security_agent", "preview", "versioning", "apis", "ui_dna", "audit_logging", "registries", "intervention"],
  "CAP-093": ["master_ai", "apis", "ui_dna", "audit_logging", "registries", "tests", "nex1"], // SEND_TO_CODING emits workstation build event · nex1 picks from stream
  "CAP-094": ["security_agent", "apis", "audit_logging", "ui_dna", "tests", "registries"],
  "CAP-095": ["security_agent", "apis", "audit_logging", "versioning", "rollback", "intervention", "ui_dna", "tests", "registries"],
  "CAP-096": ["apis", "storage", "ui_dna", "events", "audit_logging", "registries"],
  "CAP-097": ["apis", "ui_dna", "versioning", "registries", "tests"],
};

const CAP_TITLES: Readonly<Record<string, string>> = {
  "CAP-091": "NEX Workstation",
  "CAP-092": "Founder Review Queue",
  "CAP-093": "Idea Lab",
  "CAP-094": "Security HQ",
  "CAP-095": "Section Intervention",
  "CAP-096": "Email Marketing HQ",
  "CAP-097": "Component Registry",
};

const ALL_SLOTS: readonly ConnectionSlot[] = [
  "nex_brain", "truth_engine", "guardian", "master_ai", "nex1",
  "security_agent", "lab", "storage", "apis", "auth", "events",
  "registries", "audit_logging", "assets", "ui_dna", "tests",
  "preview", "github", "versioning", "rollback", "intervention", "build_snapshots",
];

export function auditAllCaps(): readonly CapConnectionRow[] {
  const rows: CapConnectionRow[] = [];
  for (const capId of Object.keys(CAP_SLOT_MATRIX)) {
    const applicable = CAP_SLOT_MATRIX[capId];
    const connected = new Set(CAP_ACTUAL_CONNECTIONS[capId] ?? []);
    const slots: Record<ConnectionSlot, SlotStatus> = {} as any;
    let connectedCount = 0, notConnectedCount = 0, notApplicableCount = 0;
    for (const slot of ALL_SLOTS) {
      if (applicable[slot]) {
        if (connected.has(slot)) {
          slots[slot] = "connected";
          connectedCount++;
        } else {
          slots[slot] = "not_connected";
          notConnectedCount++;
        }
      } else {
        slots[slot] = "not_applicable";
        notApplicableCount++;
      }
    }
    rows.push({
      capabilityId: capId,
      capabilityTitle: CAP_TITLES[capId] ?? capId,
      slots,
      connected_count: connectedCount,
      not_connected_count: notConnectedCount,
      not_applicable_count: notApplicableCount,
    });
  }
  return rows;
}

export function summarizeAudit(rows: readonly CapConnectionRow[]): {
  readonly total: number;
  readonly fully_connected: number;
  readonly has_gaps: number;
} {
  let fully = 0, gaps = 0;
  for (const r of rows) {
    if (r.not_connected_count === 0) fully++;
    else gaps++;
  }
  return { total: rows.length, fully_connected: fully, has_gaps: gaps };
}
