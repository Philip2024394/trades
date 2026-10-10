// src/lib/nex-native/family-safety/custody/service.ts
//
// NEX Family Safety · parent custody service · LOCAL STUB.
// --------------------------------------------------------
// Authored by CC-2 (wizard UI agent) 2026-10-10. CC-1 shipped the
// sealed types in `../child-account-creation/types.ts` but has not
// yet wired a custody service against the migration 205/207 tables.
// This stub keeps the UI live until CC-1's wired module ships.
//
// TODO (CC-1): replace this stub with the authoritative module backed
// by `nex.parent_custody_link` + `nex.parent_custody_audit_log`.
//
// Hard invariants preserved by every function:
//   · The parent NEVER receives a plaintext credential.
//   · Audit entries are summarised · never contain tokens or passwords.
//   · listCustodiesForParent returns ONLY custodies the viewer is the
//     parent on. Cross-account read attempts return [].

import "server-only";
import { randomUUID } from "node:crypto";
import type {
  ChildCustodyAuditAction,
  ChildPasswordResetTicket,
} from "../child-account-creation/types";

/** UI-shape custody row (not DB shape). */
export interface ParentCustodyRow {
  readonly custodyId: string;
  readonly parentAccountId: string;
  readonly childAccountId: string;
  readonly childDisplayName: string;
  readonly childDateOfBirth: string;
  readonly createdAt: string;
  readonly autoTransferAt: string;
  readonly isActive: boolean;
  readonly auditEntryCount: number;
}

/** UI-shape audit entry (not DB shape). */
export interface ChildCustodyAuditEntry {
  readonly auditEntryId: string;
  readonly custodyId: string;
  readonly action: ChildCustodyAuditAction;
  readonly actorAccountId: string;
  readonly occurredAt: string;
  readonly summary: string;
}

export interface RequestPasswordResetForChildInput {
  readonly custodyId: string;
}

type CustodyStore = Map<string, ParentCustodyRow>;
type AuditStore = Map<string, ChildCustodyAuditEntry[]>;

const g = globalThis as unknown as {
  __nexCC2CustodyStub?: CustodyStore;
  __nexCC2CustodyAuditStub?: AuditStore;
};

function custodyStore(): CustodyStore {
  if (!g.__nexCC2CustodyStub) g.__nexCC2CustodyStub = new Map();
  return g.__nexCC2CustodyStub;
}

function auditStore(): AuditStore {
  if (!g.__nexCC2CustodyAuditStub) g.__nexCC2CustodyAuditStub = new Map();
  return g.__nexCC2CustodyAuditStub;
}

function nowIso(): string {
  return new Date().toISOString();
}

function computeAutoTransferAt(dobIso: string): string {
  const d = new Date(`${dobIso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 16);
  return d.toISOString();
}

export function daysUntil(iso: string, now: Date = new Date()): number {
  const t = new Date(iso).getTime();
  const diffMs = t - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

export async function listCustodiesForParent(
  parentAccountId: string,
): Promise<readonly ParentCustodyRow[]> {
  const out: ParentCustodyRow[] = [];
  for (const row of custodyStore().values()) {
    if (row.parentAccountId === parentAccountId) out.push(row);
  }
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return out;
}

export async function getCustodyById(
  parentAccountId: string,
  custodyId: string,
): Promise<ParentCustodyRow | null> {
  const row = custodyStore().get(custodyId);
  if (!row) return null;
  if (row.parentAccountId !== parentAccountId) return null;
  return row;
}

export async function requestPasswordResetForChild(
  parentAccountId: string,
  input: RequestPasswordResetForChildInput,
): Promise<ChildPasswordResetTicket> {
  const row = custodyStore().get(input.custodyId);
  if (!row) throw new Error("CUSTODY_NOT_FOUND");
  if (row.parentAccountId !== parentAccountId) throw new Error("NOT_PERMITTED");
  if (!row.isActive) throw new Error("CUSTODY_INACTIVE");
  const ticket: ChildPasswordResetTicket = {
    resetTokenRefOpaque: randomUUID(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    displayHint:
      "Your child will set a new password the next time they sign in. You will not see the new password.",
  };
  appendAudit(input.custodyId, {
    action: "password_reset_issued",
    actorAccountId: parentAccountId,
    summary:
      "Parent issued a password reset. Child will choose a new password at next sign-in. Opaque details redacted.",
  });
  const next = {
    ...row,
    auditEntryCount: row.auditEntryCount + 1,
  };
  custodyStore().set(row.custodyId, next);
  return ticket;
}

export async function revokeCustody(
  parentAccountId: string,
  custodyId: string,
): Promise<ParentCustodyRow> {
  const row = custodyStore().get(custodyId);
  if (!row) throw new Error("CUSTODY_NOT_FOUND");
  if (row.parentAccountId !== parentAccountId) throw new Error("NOT_PERMITTED");
  if (!row.isActive) return row;
  appendAudit(custodyId, {
    action: "custody_revoked",
    actorAccountId: parentAccountId,
    summary:
      "Parent revoked custody for this child. Opaque details redacted.",
  });
  const next: ParentCustodyRow = {
    ...row,
    isActive: false,
    auditEntryCount: row.auditEntryCount + 1,
  };
  custodyStore().set(custodyId, next);
  return next;
}

export async function readRecentForCustody(
  parentAccountId: string,
  custodyId: string,
  limit = 20,
): Promise<readonly ChildCustodyAuditEntry[]> {
  const row = custodyStore().get(custodyId);
  if (!row) return [];
  if (row.parentAccountId !== parentAccountId) return [];
  const entries = (auditStore().get(custodyId) ?? []).slice();
  entries.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
  return entries.slice(0, limit);
}

function appendAudit(
  custodyId: string,
  partial: {
    readonly action: ChildCustodyAuditAction;
    readonly actorAccountId: string;
    readonly summary: string;
  },
): void {
  const prev = auditStore().get(custodyId) ?? [];
  const entry: ChildCustodyAuditEntry = {
    auditEntryId: randomUUID(),
    custodyId,
    action: partial.action,
    actorAccountId: partial.actorAccountId,
    occurredAt: nowIso(),
    summary: partial.summary,
  };
  auditStore().set(custodyId, [...prev, entry]);
}

// ─────────────────────────────────────────────────────────────────────
// Internal · used by child-creation service when creating an account.
// Not part of the public UI surface.
// ─────────────────────────────────────────────────────────────────────

export function _createCustodyForTest(
  parentAccountId: string,
  input: {
    readonly childDisplayName: string;
    readonly childDateOfBirth: string;
  },
): ParentCustodyRow {
  const custodyId = randomUUID();
  const row: ParentCustodyRow = {
    custodyId,
    parentAccountId,
    childAccountId: randomUUID(),
    childDisplayName: input.childDisplayName,
    childDateOfBirth: input.childDateOfBirth,
    createdAt: nowIso(),
    autoTransferAt: computeAutoTransferAt(input.childDateOfBirth),
    isActive: true,
    auditEntryCount: 1,
  };
  custodyStore().set(custodyId, row);
  appendAudit(custodyId, {
    action: "custody_created",
    actorAccountId: parentAccountId,
    summary:
      "Custody created · child account provisioned. Opaque details redacted.",
  });
  return row;
}

export function _resetCustodyStore(): void {
  custodyStore().clear();
  auditStore().clear();
}
