// Nex Booker · storage adapter.
//
// Thin wrapper over Supabase for all bookkeeping DB operations. Follows
// the `brainStore()` pattern from src/lib/nex/brain/storage.ts:
//   · Singleton, service-role credentials
//   · Pure I/O — no business logic (posting engine is separate)
//   · Every method that mutates goes through nex_bk_post_journal_entry
//     (the stored procedure) or writes directly to the event log
//   · Never directly INSERTs into nex_bk_journal_entries or
//     nex_bk_journal_lines — those go through the procedure
//
// The posting engine (posting-engine.ts) is a pure module that consumes
// this store to append events and post entries. Business logic (how a
// receipt becomes journal entries) lives there; this file is just I/O.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  NexBkAccount,
  NexBkAccountantGrant,
  NexBkCompliancePackage,
  NexBkComplianceBundle,
  NexBkComplianceRule,
  NexBkEvent,
  NexBkEventInput,
  NexBkJournalEntry,
  NexBkJournalEntryInput,
  NexBkJournalLine,
  NexBkJournalLineInput,
  NexBkPeriodLock,
  Uuid,
  IsoDate,
} from "./types";

// ── Store interface ─────────────────────────────────────────────────

export type NexBkStore = {
  // Event log
  appendEvent(input: NexBkEventInput): Promise<NexBkEvent>;
  listEventsForEntity(businessId: Uuid, entityType: string, entityId: string, limit?: number): Promise<NexBkEvent[]>;
  listRecentEvents(businessId: Uuid, limit?: number): Promise<NexBkEvent[]>;

  // Chart of accounts
  listAccounts(businessId: Uuid): Promise<NexBkAccount[]>;
  getAccountByCode(businessId: Uuid, code: string): Promise<NexBkAccount | null>;

  // Journal (mutation goes ONLY through postJournalEntry)
  postJournalEntry(entry: NexBkJournalEntryInput, lines: NexBkJournalLineInput[]): Promise<Uuid>;
  getJournalEntry(entryId: Uuid): Promise<NexBkJournalEntry | null>;
  listJournalLinesForEntry(entryId: Uuid): Promise<NexBkJournalLine[]>;
  listJournalEntriesInRange(businessId: Uuid, fromDate: IsoDate, toDate: IsoDate): Promise<NexBkJournalEntry[]>;

  // Compliance
  getCurrentCompliancePackage(countryCode: string, stateCode?: string | null): Promise<NexBkCompliancePackage | null>;
  getComplianceBundle(packageId: Uuid): Promise<NexBkComplianceBundle | null>;

  // Period locks
  isPeriodLocked(businessId: Uuid, date: IsoDate): Promise<boolean>;
  lockPeriod(input: Omit<NexBkPeriodLock, "id" | "locked_at" | "unlocked_at" | "unlocked_by_user_id" | "unlock_reason" | "reviewed_by_accountant_id" | "reviewed_at" | "review_notes" | "filed_at" | "filing_reference">): Promise<NexBkPeriodLock>;
  unlockPeriod(lockId: Uuid, unlockedByUserId: Uuid, reason: string): Promise<void>;
  listActivePeriodLocks(businessId: Uuid): Promise<NexBkPeriodLock[]>;

  // Accountant grants
  listActiveAccountantGrants(businessId: Uuid): Promise<NexBkAccountantGrant[]>;

  // Onboarding
  /**
   * Seeds the default UK small-business chart of accounts for a business.
   * Idempotent — returns 0 if the business already has any accounts.
   * Call once at business onboarding time before any postings.
   */
  seedDefaultAccounts(businessId: Uuid): Promise<number>;
};

// ── Implementation ──────────────────────────────────────────────────

class SupabaseNexBkStore implements NexBkStore {
  private get sb() {
    return supabaseAdmin();
  }

  async appendEvent(input: NexBkEventInput): Promise<NexBkEvent> {
    const { data, error } = await this.sb
      .from("nex_bk_events")
      .insert({
        business_id: input.business_id,
        event_type: input.event_type,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        actor_type: input.actor_type,
        actor_id: input.actor_id ?? null,
        source: input.source,
        before_state: input.before_state ?? null,
        after_state: input.after_state ?? null,
        reason: input.reason ?? null,
        request_id: input.request_id ?? null,
        event_at: input.event_at,
        meta: input.meta ?? {},
      })
      .select()
      .single();
    if (error) throw new Error(`nex_bk.appendEvent failed: ${error.message}`);
    return data as NexBkEvent;
  }

  async listEventsForEntity(businessId: Uuid, entityType: string, entityId: string, limit = 100): Promise<NexBkEvent[]> {
    const { data, error } = await this.sb
      .from("nex_bk_events")
      .select("*")
      .eq("business_id", businessId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("recorded_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`nex_bk.listEventsForEntity failed: ${error.message}`);
    return (data ?? []) as NexBkEvent[];
  }

  async listRecentEvents(businessId: Uuid, limit = 50): Promise<NexBkEvent[]> {
    const { data, error } = await this.sb
      .from("nex_bk_events")
      .select("*")
      .eq("business_id", businessId)
      .order("recorded_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`nex_bk.listRecentEvents failed: ${error.message}`);
    return (data ?? []) as NexBkEvent[];
  }

  async listAccounts(businessId: Uuid): Promise<NexBkAccount[]> {
    const { data, error } = await this.sb
      .from("nex_bk_accounts")
      .select("*")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("code", { ascending: true });
    if (error) throw new Error(`nex_bk.listAccounts failed: ${error.message}`);
    return (data ?? []) as NexBkAccount[];
  }

  async getAccountByCode(businessId: Uuid, code: string): Promise<NexBkAccount | null> {
    const { data, error } = await this.sb
      .from("nex_bk_accounts")
      .select("*")
      .eq("business_id", businessId)
      .eq("code", code)
      .maybeSingle();
    if (error) throw new Error(`nex_bk.getAccountByCode failed: ${error.message}`);
    return (data as NexBkAccount | null) ?? null;
  }

  /**
   * Posts a journal entry via the nex_bk_post_journal_entry stored procedure.
   * This is the ONLY route by which journal entries + lines are created.
   * The procedure enforces balance (debits = credits) and locked-period
   * checks — this method will throw if either fails.
   */
  async postJournalEntry(entry: NexBkJournalEntryInput, lines: NexBkJournalLineInput[]): Promise<Uuid> {
    const { data, error } = await this.sb.rpc("nex_bk_post_journal_entry", {
      p_entry: {
        business_id: entry.business_id,
        entry_at: entry.entry_at,
        source_event_id: entry.source_event_id,
        description: entry.description,
        posted_by_type: entry.posted_by_type,
        posted_by_id: entry.posted_by_id ?? null,
        reverses_entry_id: entry.reverses_entry_id ?? null,
        compliance_package_version: entry.compliance_package_version ?? null,
        is_adjustment: entry.is_adjustment ?? false,
        meta: entry.meta ?? {},
      },
      p_lines: lines.map((l) => ({
        account_id: l.account_id,
        debit: l.debit ?? 0,
        credit: l.credit ?? 0,
        currency: l.currency ?? "GBP",
        original_amount: l.original_amount ?? null,
        original_currency: l.original_currency ?? null,
        exchange_rate: l.exchange_rate ?? null,
        exchange_rate_date: l.exchange_rate_date ?? null,
        exchange_rate_source: l.exchange_rate_source ?? null,
        project_id: l.project_id ?? null,
        customer_id: l.customer_id ?? null,
        supplier_id: l.supplier_id ?? null,
        memo: l.memo ?? null,
      })),
    });
    if (error) throw new Error(`nex_bk.postJournalEntry failed: ${error.message}`);
    return data as Uuid;
  }

  async getJournalEntry(entryId: Uuid): Promise<NexBkJournalEntry | null> {
    const { data, error } = await this.sb
      .from("nex_bk_journal_entries")
      .select("*")
      .eq("id", entryId)
      .maybeSingle();
    if (error) throw new Error(`nex_bk.getJournalEntry failed: ${error.message}`);
    return (data as NexBkJournalEntry | null) ?? null;
  }

  async listJournalLinesForEntry(entryId: Uuid): Promise<NexBkJournalLine[]> {
    const { data, error } = await this.sb
      .from("nex_bk_journal_lines")
      .select("*")
      .eq("entry_id", entryId)
      .order("line_number", { ascending: true });
    if (error) throw new Error(`nex_bk.listJournalLinesForEntry failed: ${error.message}`);
    return (data ?? []) as NexBkJournalLine[];
  }

  async listJournalEntriesInRange(businessId: Uuid, fromDate: IsoDate, toDate: IsoDate): Promise<NexBkJournalEntry[]> {
    const { data, error } = await this.sb
      .from("nex_bk_journal_entries")
      .select("*")
      .eq("business_id", businessId)
      .gte("entry_at", fromDate)
      .lte("entry_at", toDate)
      .order("entry_at", { ascending: true });
    if (error) throw new Error(`nex_bk.listJournalEntriesInRange failed: ${error.message}`);
    return (data ?? []) as NexBkJournalEntry[];
  }

  async getCurrentCompliancePackage(countryCode: string, stateCode: string | null = null): Promise<NexBkCompliancePackage | null> {
    let q = this.sb
      .from("nex_bk_compliance_packages")
      .select("*")
      .eq("country_code", countryCode)
      .is("effective_to", null)
      .order("effective_from", { ascending: false })
      .limit(1);
    q = stateCode === null ? q.is("state_code", null) : q.eq("state_code", stateCode);
    const { data, error } = await q.maybeSingle();
    if (error) throw new Error(`nex_bk.getCurrentCompliancePackage failed: ${error.message}`);
    return (data as NexBkCompliancePackage | null) ?? null;
  }

  async getComplianceBundle(packageId: Uuid): Promise<NexBkComplianceBundle | null> {
    const [{ data: pkg, error: pkgErr }, { data: rules, error: rulesErr }] = await Promise.all([
      this.sb.from("nex_bk_compliance_packages").select("*").eq("id", packageId).maybeSingle(),
      this.sb.from("nex_bk_compliance_rules").select("*").eq("package_id", packageId),
    ]);
    if (pkgErr) throw new Error(`nex_bk.getComplianceBundle package failed: ${pkgErr.message}`);
    if (rulesErr) throw new Error(`nex_bk.getComplianceBundle rules failed: ${rulesErr.message}`);
    if (!pkg) return null;
    const map: Record<string, unknown> = {};
    for (const r of (rules ?? []) as NexBkComplianceRule[]) {
      map[r.rule_key] = r.rule_value;
    }
    return { package: pkg as NexBkCompliancePackage, rules: map };
  }

  async isPeriodLocked(businessId: Uuid, date: IsoDate): Promise<boolean> {
    const { data, error } = await this.sb.rpc("nex_bk_is_period_locked", {
      p_business_id: businessId,
      p_date: date,
    });
    if (error) throw new Error(`nex_bk.isPeriodLocked failed: ${error.message}`);
    return Boolean(data);
  }

  async lockPeriod(input: Omit<NexBkPeriodLock, "id" | "locked_at" | "unlocked_at" | "unlocked_by_user_id" | "unlock_reason" | "reviewed_by_accountant_id" | "reviewed_at" | "review_notes" | "filed_at" | "filing_reference">): Promise<NexBkPeriodLock> {
    const { data, error } = await this.sb
      .from("nex_bk_period_locks")
      .insert({
        business_id: input.business_id,
        period_type: input.period_type,
        period_start: input.period_start,
        period_end: input.period_end,
        locked_by_user_id: input.locked_by_user_id ?? null,
        lock_reason: input.lock_reason ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(`nex_bk.lockPeriod failed: ${error.message}`);
    return data as NexBkPeriodLock;
  }

  async unlockPeriod(lockId: Uuid, unlockedByUserId: Uuid, reason: string): Promise<void> {
    const { error } = await this.sb
      .from("nex_bk_period_locks")
      .update({
        unlocked_at: new Date().toISOString(),
        unlocked_by_user_id: unlockedByUserId,
        unlock_reason: reason,
      })
      .eq("id", lockId)
      .is("unlocked_at", null);   // Prevent overwriting an already-unlocked row
    if (error) throw new Error(`nex_bk.unlockPeriod failed: ${error.message}`);
  }

  async listActivePeriodLocks(businessId: Uuid): Promise<NexBkPeriodLock[]> {
    const { data, error } = await this.sb
      .from("nex_bk_period_locks")
      .select("*")
      .eq("business_id", businessId)
      .is("unlocked_at", null)
      .order("period_start", { ascending: false });
    if (error) throw new Error(`nex_bk.listActivePeriodLocks failed: ${error.message}`);
    return (data ?? []) as NexBkPeriodLock[];
  }

  async listActiveAccountantGrants(businessId: Uuid): Promise<NexBkAccountantGrant[]> {
    const { data, error } = await this.sb
      .from("nex_bk_accountant_grants")
      .select("*")
      .is("revoked_at", null)
      .eq("business_id", businessId)
      .order("granted_at", { ascending: false });
    if (error) throw new Error(`nex_bk.listActiveAccountantGrants failed: ${error.message}`);
    return (data ?? []) as NexBkAccountantGrant[];
  }

  async seedDefaultAccounts(businessId: Uuid): Promise<number> {
    const { data, error } = await this.sb.rpc("nex_bk_seed_default_accounts", {
      p_business_id: businessId,
    });
    if (error) throw new Error(`nex_bk.seedDefaultAccounts failed: ${error.message}`);
    return (data as number | null) ?? 0;
  }
}

// ── Singleton accessor ──────────────────────────────────────────────

let _store: NexBkStore | null = null;

/** Get the singleton Nex Booker store. Uses service-role Supabase credentials. */
export function nexBkStore(): NexBkStore {
  if (!_store) _store = new SupabaseNexBkStore();
  return _store;
}
