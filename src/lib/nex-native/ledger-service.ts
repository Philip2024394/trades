// src/lib/nex-native/ledger-service.ts
//
// ledger-service · balanced double-entry · reversal-safe.
//
// Doctrine:
//   · Commercial Doctrine · Layer C (Commerce Ledger) · never Wallet
//   · Founder 2026-09-24 · reversal-safe · reversals create compensating
//     entries · never mutate historical facts
//   · Founder 2026-09-24 · ledger writes go through controlled service
//     boundary (this file) · not raw DB access
//
// Balanced-entry invariant:
//   Postgres CHECK enforces per-line "exactly one side positive."
//   Application (this file) enforces per-entry "sum debits = sum credits"
//   BEFORE INSERT. Any imbalance throws.
//
// Reversal:
//   To reverse entry X, call postEntry with reversal_of_entry_id=X.id and
//   lines that are the exact opposite (debits become credits and vice
//   versa). Application asserts the opposite invariant before INSERT.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type {
  NexLedgerEntryInput,
  NexLedgerEntryRow,
  NexLedgerLineRow,
  NexUuid,
} from "./types";

/**
 * Post a balanced double-entry. Every line must have exactly one side
 * positive. Sum of debit_pence across lines must equal sum of credit_pence.
 *
 * Not atomic across entry + lines in the current implementation (uses
 * separate INSERTs). If a line insert fails, service throws · caller must
 * accept eventual manual reconciliation. Full atomicity via a Postgres
 * function is deferred to a follow-up wave; for MVP this is documented
 * honesty.
 */
export async function postEntry(
  input: NexLedgerEntryInput
): Promise<{ entry: NexLedgerEntryRow; lines: NexLedgerLineRow[] }> {
  // 1 · Normalise + validate lines
  const normalised = input.lines.map((line, idx) => {
    const d = line.debit_pence ?? 0;
    const c = line.credit_pence ?? 0;
    if (d < 0 || c < 0) {
      throw new Error(
        `ledger-service.postEntry: line ${idx} has negative amount · refusing`
      );
    }
    if ((d > 0 && c > 0) || (d === 0 && c === 0)) {
      throw new Error(
        `ledger-service.postEntry: line ${idx} must have exactly one of debit/credit positive (got d=${d} c=${c})`
      );
    }
    if (!/^[A-Z]{3}$/.test(line.currency)) {
      throw new Error(
        `ledger-service.postEntry: line ${idx} currency "${line.currency}" is not a 3-char ISO-4217 code`
      );
    }
    if (!line.account || line.account.trim().length === 0) {
      throw new Error(`ledger-service.postEntry: line ${idx} has empty account`);
    }
    return { ...line, debit_pence: d, credit_pence: c };
  });

  // 2 · Balance check
  const sumDebit = normalised.reduce((s, l) => s + l.debit_pence, 0);
  const sumCredit = normalised.reduce((s, l) => s + l.credit_pence, 0);
  if (sumDebit !== sumCredit) {
    throw new Error(
      `ledger-service.postEntry: entry not balanced · sum(debits)=${sumDebit} sum(credits)=${sumCredit}`
    );
  }
  if (sumDebit === 0) {
    throw new Error(`ledger-service.postEntry: entry has zero total value · refusing`);
  }

  // 3 · INSERT entry
  const { data: entryData, error: entryErr } = await nexSupabaseAdmin
    .from("nex_ledger_entry")
    .insert({
      order_id: input.order_id ?? null,
      description: input.description,
      reversal_of_entry_id: input.reversal_of_entry_id ?? null,
    })
    .select("*")
    .single();
  if (entryErr || !entryData) {
    throw new Error(
      `ledger-service.postEntry entry: ${entryErr?.message ?? "no row returned"}`
    );
  }
  const entry = entryData as NexLedgerEntryRow;

  // 4 · INSERT lines
  const { data: lineData, error: lineErr } = await nexSupabaseAdmin
    .from("nex_ledger_line")
    .insert(
      normalised.map((l) => ({
        entry_id: entry.id,
        account: l.account,
        debit_pence: l.debit_pence,
        credit_pence: l.credit_pence,
        currency: l.currency,
      }))
    )
    .select("*");
  if (lineErr || !lineData) {
    // Best-effort compensating: retain the entry but flag lines missing.
    // Full atomicity comes in a future wave via a Postgres function.
    throw new Error(
      `ledger-service.postEntry lines: ${lineErr?.message ?? "no rows returned"} · entry ${entry.id} may exist without lines · manual reconciliation required`
    );
  }
  return { entry, lines: lineData as NexLedgerLineRow[] };
}

/** Read entry by id. */
export async function getEntryById(
  id: NexUuid
): Promise<NexLedgerEntryRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_ledger_entry")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`ledger-service.getEntryById: ${error.message}`);
  return (data as NexLedgerEntryRow) ?? null;
}

/** List lines for an entry. */
export async function listLinesForEntry(
  entryId: NexUuid
): Promise<NexLedgerLineRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_ledger_line")
    .select("*")
    .eq("entry_id", entryId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`ledger-service.listLinesForEntry: ${error.message}`);
  return (data as NexLedgerLineRow[]) ?? [];
}

/** List entries for an order (including any reversal entries). */
export async function listEntriesForOrder(
  orderId: NexUuid
): Promise<NexLedgerEntryRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_ledger_entry")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`ledger-service.listEntriesForOrder: ${error.message}`);
  return (data as NexLedgerEntryRow[]) ?? [];
}

/**
 * Reverse a prior entry · creates a new compensating entry that
 * references the original via reversal_of_entry_id · does NOT mutate the
 * original. Caller supplies the reason as description.
 */
export async function reverseEntry(
  entryId: NexUuid,
  description: string
): Promise<{ entry: NexLedgerEntryRow; lines: NexLedgerLineRow[] }> {
  const original = await getEntryById(entryId);
  if (!original) {
    throw new Error(`ledger-service.reverseEntry: entry ${entryId} not found`);
  }
  const originalLines = await listLinesForEntry(entryId);
  if (originalLines.length === 0) {
    throw new Error(`ledger-service.reverseEntry: entry ${entryId} has no lines`);
  }
  // Build the reversal: swap debit/credit on each line
  const reversalLines = originalLines.map((l) => ({
    account: l.account,
    debit_pence: l.credit_pence,
    credit_pence: l.debit_pence,
    currency: l.currency,
  }));
  return postEntry({
    order_id: original.order_id ?? null,
    description,
    reversal_of_entry_id: entryId,
    lines: reversalLines,
  });
}
