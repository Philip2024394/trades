// case-store.ts — filesystem persistence for Refacing Cases.
//
// Cases are stored as individual JSON files under
// data/refacing-cases/<rf_id>.json. This matches the existing filesystem-
// store pattern used by contacts (src/lib/nex/contacts/fs-store.ts) and
// events (src/lib/nex/events/fs-store.ts) · deliberately simple · adapter-
// swap to a database is a Stage-later concern (per Nex Backend Provider-
// Agnostic Architecture memory).
//
// Doctrinal enforcement:
//   · Every write runs validateRefacingCase (PR-16 + PR-13 + PR-18)
//   · Cases without composition_provenance are schema-rejected at LOCK
//   · Anonymous return_token is signed opaque data (magic-link-later)

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { newRefacingCaseId, type RefacingCaseId, assertRefacingCaseId } from "./case-id";
import type { RefacingCase, CaseStatus } from "./case-schema";
import { validateRefacingCase, PR16ConfidenceError, PR13PriceOnCaseError } from "./validators";
import { PR18ProvenanceError } from "./provenance";
import { loadKnownImageIds } from "./manifest";

const CASES_DIR = join(process.cwd(), "data", "refacing-cases");

// ── Errors ────────────────────────────────────────────────────────────────

export class CaseNotFoundError extends Error {
  constructor(public readonly caseId: string) {
    super(`Refacing Case not found · ${caseId}`);
    this.name = "CaseNotFoundError";
  }
}

export class CaseValidationError extends Error {
  constructor(
    public readonly caseId: string,
    public readonly reason:
      | "pr16_confidence"
      | "pr13_price_on_case"
      | "pr18_provenance"
      | "schema",
    public readonly detail: string
  ) {
    super(`Case validation failed · ${caseId} · ${reason} · ${detail}`);
    this.name = "CaseValidationError";
  }
}

// ── Path helpers ──────────────────────────────────────────────────────────

function pathForCase(caseId: string): string {
  return join(CASES_DIR, `${caseId}.json`);
}

async function ensureDir(): Promise<void> {
  await mkdir(CASES_DIR, { recursive: true });
}

// ── Create ────────────────────────────────────────────────────────────────

/**
 * Create a new anonymous DRAFT Refacing Case. No customer name/phone/email
 * required (per Stage 1 · C4 LOCKED · no forced registration at entry).
 *
 * Returns { refacing_case_id, anonymous_return_token }. The token grants
 * resume-access without the customer needing an account.
 */
export async function createDraftCase(): Promise<{
  refacing_case_id: RefacingCaseId;
  anonymous_return_token: string;
}> {
  await ensureDir();
  const refacing_case_id = newRefacingCaseId();
  const anonymous_return_token = randomBytes(24).toString("base64url");
  const nowIso = new Date().toISOString();

  const initial: RefacingCase = {
    refacing_case_id,
    created_at: nowIso,
    updated_at: nowIso,
    status: "DRAFT",
    existing_staircase: {
      photos: [],
      customer_confirmed: false,
    },
    customer_intent: {
      feelings: [],
      intent_entries: [],
    },
    unknown_items: [
      {
        concern: "photo_pending",
        reason: "Draft Case created before customer has uploaded a staircase photo.",
      },
    ],
    composition_provenance: [], // Empty is legal at DRAFT · required only at LOCK
    anonymous_return_token,
  };

  // Validators require knownImageIds even for a draft. At DRAFT there's no
  // composed design, so PR-18 provenance check passes trivially with empty
  // composition_provenance + no claimed component roles.
  const knownImageIds = await loadKnownImageIds();

  try {
    validateRefacingCase(initial, { knownImageIds });
  } catch (err) {
    throw asValidationError(refacing_case_id, err);
  }

  await writeFile(
    pathForCase(refacing_case_id),
    JSON.stringify(initial, null, 2) + "\n",
    "utf8"
  );

  return { refacing_case_id, anonymous_return_token };
}

// ── Read ──────────────────────────────────────────────────────────────────

/**
 * Read a Case by ID. Throws CaseNotFoundError if missing.
 * Does NOT verify the return_token · that's the caller's job (endpoint level).
 */
export async function readCase(caseId: string): Promise<RefacingCase> {
  assertRefacingCaseId(caseId);
  try {
    const raw = await readFile(pathForCase(caseId), "utf8");
    return JSON.parse(raw) as RefacingCase;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new CaseNotFoundError(caseId);
    }
    throw err;
  }
}

/**
 * Read a Case + verify the caller's return_token matches.
 * Use this at every resume-access endpoint.
 */
export async function readCaseWithToken(
  caseId: string,
  providedToken: string
): Promise<RefacingCase> {
  const c = await readCase(caseId);
  if (c.anonymous_return_token !== providedToken) {
    // Deliberately generic error · never leaks whether the Case exists.
    throw new CaseNotFoundError(caseId);
  }
  return c;
}

// ── Update ────────────────────────────────────────────────────────────────

/**
 * Overwrite a Case with a new state. Runs full validation.
 *
 * @param nextStatus optional new CaseStatus — pass to transition state
 */
export async function updateCase(
  caseId: string,
  mutate: (current: RefacingCase) => RefacingCase,
  nextStatus?: CaseStatus
): Promise<RefacingCase> {
  const current = await readCase(caseId);
  const mutated = mutate(current);

  const next: RefacingCase = {
    ...mutated,
    refacing_case_id: current.refacing_case_id, // Preserve · never mutable
    created_at: current.created_at, // Preserve · never mutable
    updated_at: new Date().toISOString(),
    status: nextStatus ?? mutated.status ?? current.status,
  };

  const knownImageIds = await loadKnownImageIds();
  try {
    validateRefacingCase(next, { knownImageIds });
  } catch (err) {
    throw asValidationError(caseId, err);
  }

  await writeFile(
    pathForCase(caseId),
    JSON.stringify(next, null, 2) + "\n",
    "utf8"
  );
  return next;
}

// ── Error shaping ─────────────────────────────────────────────────────────

function asValidationError(caseId: string, err: unknown): CaseValidationError {
  if (err instanceof PR16ConfidenceError) {
    return new CaseValidationError(caseId, "pr16_confidence", err.message);
  }
  if (err instanceof PR13PriceOnCaseError) {
    return new CaseValidationError(caseId, "pr13_price_on_case", err.message);
  }
  if (err instanceof PR18ProvenanceError) {
    return new CaseValidationError(caseId, "pr18_provenance", err.message);
  }
  return new CaseValidationError(
    caseId,
    "schema",
    err instanceof Error ? err.message : String(err)
  );
}
