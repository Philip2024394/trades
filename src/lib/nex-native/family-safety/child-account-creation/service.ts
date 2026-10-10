// src/lib/nex-native/family-safety/child-account-creation/service.ts
//
// NEX Family Safety · child-account-creation service · LOCAL STUB.
// ----------------------------------------------------------------
// Authored by CC-2 (wizard UI agent) 2026-10-10 to unblock the UI
// while CC-1's authoritative module is being wired to the migration-
// 203..207 tables. CC-1 has already published the sealed types in
// `./types.ts` and `./ui-tokens.ts` · this file provides the behaviour
// backing the server actions until CC-1's wired module is ready.
//
// TODO (CC-1): swap the body of each function below to the sealed
// authoritative implementation. The exported function signatures are
// the UI contract and must not change.
//
// This stub is intentionally honest about its limits:
//   · Data lives in a process-local in-memory map. Restart = loss.
//   · It is only usable in dev / preview. Production MUST import the
//     CC-1 wired module (feature-flag + build guard in CC-4 enforce).
//   · No ID bytes are persisted here. We hash the base64 payload to
//     a sha256 hex and discard the plaintext bytes immediately.

import "server-only";
import { randomUUID, createHash } from "node:crypto";
import type {
  ChildCreationRequestRow,
  ChildCreationState,
  GovernmentIdDocumentType,
} from "./types";

// ─────────────────────────────────────────────────────────────────────
// Server-action input shapes (local to this file · the UI calls these
// via actions.ts).
// ─────────────────────────────────────────────────────────────────────

export interface CreateChildCreationRequestInput {
  readonly childDisplayName: string;
  readonly childDeclaredDateOfBirth: string;
}
export interface CreateChildCreationRequestResult {
  readonly requestId: string;
}

export interface UploadIdDocumentInput {
  readonly requestId: string;
  readonly documentType: GovernmentIdDocumentType;
  readonly documentFilename: string;
  readonly documentMimeType: string;
  readonly documentByteLength: number;
  readonly documentBytesBase64: string;
  readonly idempotencyKey: string;
}
export interface UploadIdDocumentResult {
  readonly submissionId: string;
}

export interface TransitionCreationStateInput {
  readonly requestId: string;
  readonly nextState: ChildCreationState;
}

export interface CancelRequestInput {
  readonly requestId: string;
  readonly reason: string;
}

interface StoredRequest extends ChildCreationRequestRow {
  readonly documentContentSha256: string | null;
}

type RequestStore = Map<string, StoredRequest>;

const g = globalThis as unknown as {
  __nexCC2ChildCreationStub?: RequestStore;
};

function store(): RequestStore {
  if (!g.__nexCC2ChildCreationStub) {
    g.__nexCC2ChildCreationStub = new Map();
  }
  return g.__nexCC2ChildCreationStub;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────

export function isValidChildDisplayName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 3 && trimmed.length <= 60;
}

/**
 * The DOB must be:
 *   · a well-formed yyyy-mm-dd
 *   · at least one day ago (no future / today DOB)
 *   · at most 16 years ago (child must be under 16)
 */
export function isValidChildDateOfBirth(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (d.getTime() > oneDayAgo.getTime()) return false;
  const sixteenYearsAgo = new Date(now.getTime());
  sixteenYearsAgo.setUTCFullYear(now.getUTCFullYear() - 16);
  if (d.getTime() < sixteenYearsAgo.getTime()) return false;
  return true;
}

export function computeAgeYears(dob: string, now: Date = new Date()): number {
  const d = new Date(`${dob}T00:00:00Z`);
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
}

// ─────────────────────────────────────────────────────────────────────
// Server-action implementations
// ─────────────────────────────────────────────────────────────────────

export async function createChildCreationRequest(
  parentAccountId: string,
  input: CreateChildCreationRequestInput,
): Promise<CreateChildCreationRequestResult> {
  if (!isValidChildDisplayName(input.childDisplayName)) {
    throw new Error("INVALID_CHILD_DISPLAY_NAME");
  }
  if (!isValidChildDateOfBirth(input.childDeclaredDateOfBirth)) {
    throw new Error("INVALID_CHILD_DATE_OF_BIRTH");
  }
  const requestId = randomUUID();
  const row: StoredRequest = {
    requestId,
    parentAccountId,
    childDisplayName: input.childDisplayName.trim(),
    childDeclaredDateOfBirth: input.childDeclaredDateOfBirth,
    state: "draft",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    submissionId: null,
    documentFilename: null,
    documentType: null,
    rejectionReason: null,
    custodyId: null,
    heldForLegalClearance: false,
    documentContentSha256: null,
  };
  store().set(requestId, row);
  return { requestId };
}

export async function uploadIdDocument(
  parentAccountId: string,
  input: UploadIdDocumentInput,
): Promise<UploadIdDocumentResult> {
  const row = store().get(input.requestId);
  if (!row) throw new Error("REQUEST_NOT_FOUND");
  if (row.parentAccountId !== parentAccountId) {
    throw new Error("NOT_PERMITTED");
  }
  if (row.state !== "draft") throw new Error("INVALID_STATE_FOR_UPLOAD");
  if (input.documentByteLength > 10 * 1024 * 1024) {
    throw new Error("DOCUMENT_TOO_LARGE");
  }
  const sha = createHash("sha256").update(input.documentBytesBase64).digest("hex");
  const submissionId = randomUUID();
  const next: StoredRequest = {
    ...row,
    submissionId,
    documentFilename: input.documentFilename,
    documentType: input.documentType,
    documentContentSha256: sha,
    updatedAt: nowIso(),
  };
  store().set(row.requestId, next);
  return { submissionId };
}

export async function transitionCreationState(
  parentAccountId: string,
  input: TransitionCreationStateInput,
): Promise<ChildCreationRequestRow> {
  const row = store().get(input.requestId);
  if (!row) throw new Error("REQUEST_NOT_FOUND");
  if (row.parentAccountId !== parentAccountId) {
    throw new Error("NOT_PERMITTED");
  }
  // Minimal legal transitions · UI only ever requests id_pending_verification.
  if (
    row.state === "draft" &&
    input.nextState === "id_pending_verification" &&
    row.submissionId
  ) {
    const next: StoredRequest = {
      ...row,
      state: "id_pending_verification",
      updatedAt: nowIso(),
    };
    store().set(row.requestId, next);
    return stripInternal(next);
  }
  throw new Error("INVALID_STATE_TRANSITION");
}

export async function cancelRequest(
  parentAccountId: string,
  input: CancelRequestInput,
): Promise<ChildCreationRequestRow> {
  const row = store().get(input.requestId);
  if (!row) throw new Error("REQUEST_NOT_FOUND");
  if (row.parentAccountId !== parentAccountId) {
    throw new Error("NOT_PERMITTED");
  }
  if (row.state === "account_created") {
    throw new Error("CANNOT_CANCEL_ACCOUNT_CREATED");
  }
  const next: StoredRequest = {
    ...row,
    state: "cancelled",
    rejectionReason: input.reason,
    updatedAt: nowIso(),
  };
  store().set(row.requestId, next);
  return stripInternal(next);
}

export async function getRequestById(
  parentAccountId: string,
  requestId: string,
): Promise<ChildCreationRequestRow | null> {
  const row = store().get(requestId);
  if (!row) return null;
  if (row.parentAccountId !== parentAccountId) return null;
  return stripInternal(row);
}

export async function listRequestsForParent(
  parentAccountId: string,
): Promise<readonly ChildCreationRequestRow[]> {
  const rows: ChildCreationRequestRow[] = [];
  for (const row of store().values()) {
    if (row.parentAccountId === parentAccountId) {
      rows.push(stripInternal(row));
    }
  }
  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return rows;
}

function stripInternal(row: StoredRequest): ChildCreationRequestRow {
  const { documentContentSha256: _ignored, ...public_ } = row;
  void _ignored;
  return public_;
}

/** Testing hook: wipe the in-memory store. */
export function _resetChildCreationStore(): void {
  store().clear();
}

/**
 * Testing hook: force a state (bypasses legal-transition guards).
 * Used only by UI tests to simulate verifier outcomes · never called
 * from a UI route.
 */
export function _forceRequestState(
  requestId: string,
  state: ChildCreationState,
  extra?: Partial<ChildCreationRequestRow>,
): void {
  const row = store().get(requestId);
  if (!row) return;
  store().set(requestId, {
    ...row,
    state,
    updatedAt: nowIso(),
    ...extra,
  } as StoredRequest);
}
