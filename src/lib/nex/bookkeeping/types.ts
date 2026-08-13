// Nex Booker · shared TypeScript types.
//
// Mirrors the SQL schema in supabase/migrations/20260806000000_nex_booker_foundations.sql.
// If the schema changes, these types change in lock-step — they are the
// only supported contract between the DB and the rest of the app.
//
// Naming: `nex_bk_*` in the DB · `NexBk*` in TypeScript. Engineering
// speaks "bookkeeping"; customer-facing UI says "Nex Booker".

// ── Base types ──────────────────────────────────────────────────────

export type Uuid = string;
export type IsoTimestamp = string;   // e.g. "2026-08-06T14:23:00Z"
export type IsoDate = string;         // e.g. "2026-08-06"
export type CurrencyCode = string;    // ISO 4217 alpha-3, e.g. "GBP"
export type CountryCode = string;     // ISO 3166-1 alpha-2, e.g. "GB"

// ── Event log ───────────────────────────────────────────────────────

export type NexBkEventActorType = "user" | "nex" | "accountant" | "system" | "import";
export type NexBkEventSource = "chat" | "photo" | "voice" | "manual" | "import" | "api" | "background";

/** Complete event row as stored in nex_bk_events. */
export type NexBkEvent = {
  id: Uuid;
  business_id: Uuid;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor_type: NexBkEventActorType;
  actor_id: string | null;
  source: NexBkEventSource;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  reason: string | null;
  request_id: Uuid | null;
  event_at: IsoTimestamp;
  recorded_at: IsoTimestamp;
  meta: Record<string, unknown>;
};

/** Input shape for appending a new event — id, recorded_at, meta default. */
export type NexBkEventInput = Omit<NexBkEvent, "id" | "recorded_at" | "meta"> & {
  meta?: Record<string, unknown>;
};

// ── Chart of accounts ───────────────────────────────────────────────

export type NexBkAccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type NexBkAccountSide = "debit" | "credit";

export type NexBkAccount = {
  id: Uuid;
  business_id: Uuid;
  code: string;
  name: string;
  type: NexBkAccountType;
  normal_side: NexBkAccountSide;
  parent_id: Uuid | null;
  is_system: boolean;
  active: boolean;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
};

// ── Journal entries + lines ─────────────────────────────────────────

export type NexBkPostedByType = "nex" | "accountant" | "user" | "system";

export type NexBkJournalEntry = {
  id: Uuid;
  business_id: Uuid;
  entry_at: IsoTimestamp;
  source_event_id: Uuid;
  description: string;
  posted_at: IsoTimestamp;
  posted_by_type: NexBkPostedByType;
  posted_by_id: string | null;
  reversed_by_entry_id: Uuid | null;
  reverses_entry_id: Uuid | null;
  compliance_package_version: string | null;
  is_adjustment: boolean;
  meta: Record<string, unknown>;
};

export type NexBkJournalLine = {
  id: Uuid;
  entry_id: Uuid;
  business_id: Uuid;
  account_id: Uuid;
  debit: number;
  credit: number;
  currency: CurrencyCode;
  original_amount: number | null;
  original_currency: CurrencyCode | null;
  exchange_rate: number | null;
  exchange_rate_date: IsoDate | null;
  exchange_rate_source: string | null;
  project_id: string | null;
  customer_id: string | null;
  supplier_id: string | null;
  memo: string | null;
  line_number: number;
};

/** Input shape for posting an entry via nex_bk_post_journal_entry.
 *  Debits and credits must sum to zero across `lines`. Enforced server-side. */
export type NexBkJournalEntryInput = {
  business_id: Uuid;
  entry_at: IsoTimestamp;
  source_event_id: Uuid;
  description: string;
  posted_by_type: NexBkPostedByType;
  posted_by_id?: string | null;
  reverses_entry_id?: Uuid | null;
  compliance_package_version?: string | null;
  is_adjustment?: boolean;
  meta?: Record<string, unknown>;
};

/** Input shape for a single line inside an entry input. */
export type NexBkJournalLineInput = {
  account_id: Uuid;
  debit?: number;                    // Exactly one of debit or credit > 0
  credit?: number;
  currency?: CurrencyCode;           // Defaults to 'GBP' server-side
  original_amount?: number | null;
  original_currency?: CurrencyCode | null;
  exchange_rate?: number | null;
  exchange_rate_date?: IsoDate | null;
  exchange_rate_source?: string | null;
  project_id?: string | null;
  customer_id?: string | null;
  supplier_id?: string | null;
  memo?: string | null;
};

// ── Compliance ──────────────────────────────────────────────────────

export type NexBkCompliancePackage = {
  id: Uuid;
  country_code: CountryCode;
  state_code: string | null;
  version: string;
  effective_from: IsoDate;
  effective_to: IsoDate | null;
  last_verified_at: IsoTimestamp;
  source_urls: string[];
  release_notes: string | null;
  created_at: IsoTimestamp;
};

/** Per-rule row. rule_value is JSONB — shape depends on rule_key.
 *  Consumers should validate the shape before use (see compliance/rules.ts). */
export type NexBkComplianceRule = {
  id: Uuid;
  package_id: Uuid;
  rule_key: string;
  rule_value: unknown;
  description: string;
  effective_from: IsoDate | null;
  effective_to: IsoDate | null;
};

/** Convenience: a package hydrated with its rules as a keyed map. */
export type NexBkComplianceBundle = {
  package: NexBkCompliancePackage;
  rules: Record<string, unknown>;    // rule_key → rule_value
};

// ── Period locks ────────────────────────────────────────────────────

export type NexBkPeriodType = "month" | "quarter" | "year" | "vat_return" | "custom";

export type NexBkPeriodLock = {
  id: Uuid;
  business_id: Uuid;
  period_type: NexBkPeriodType;
  period_start: IsoDate;
  period_end: IsoDate;
  locked_at: IsoTimestamp;
  locked_by_user_id: Uuid | null;
  lock_reason: string | null;
  reviewed_by_accountant_id: Uuid | null;
  reviewed_at: IsoTimestamp | null;
  review_notes: string | null;
  filed_at: IsoTimestamp | null;
  filing_reference: string | null;
  unlocked_at: IsoTimestamp | null;
  unlocked_by_user_id: Uuid | null;
  unlock_reason: string | null;
};

// ── Accountant grants ───────────────────────────────────────────────

export type NexBkAccountantPermissions = {
  read_ledger?: boolean;
  add_adjustments?: boolean;
  sign_off_periods?: boolean;
  request_corrections?: boolean;
};

export type NexBkAccountantGrant = {
  id: Uuid;
  business_id: Uuid;
  accountant_user_id: Uuid;
  granted_by_user_id: Uuid;
  granted_at: IsoTimestamp;
  permissions: NexBkAccountantPermissions;
  revoked_at: IsoTimestamp | null;
  revoked_by_user_id: Uuid | null;
  revoke_reason: string | null;
};

// ── Autopilot rules ────────────────────────────────────────────────

export type NexBkAutopilotMode = "suggest_only" | "auto_execute" | "disabled";

/** Supported trigger types. Adding one = update this union + add a
 *  matcher case in autopilot.ts + tests. */
export type NexBkAutopilotTriggerType =
  | "on_receipt_captured"
  | "on_invoice_issued"
  | "on_customer_payment"
  | "on_invoice_overdue_days"
  | "on_stock_below_min"
  | "on_period_ready_for_accountant";

/** Optional predicate applied after the trigger matches. Each condition
 *  is (field, op, value); all conditions must match for the rule to fire. */
export type NexBkAutopilotCondition = {
  field: string;                     // e.g. "customer_id" · "gross_amount" · "supplier_id"
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "not_in" | "contains";
  value: unknown;
};

/** Supported action types. Executor (future) knows how to run each. */
export type NexBkAutopilotActionType =
  | "mark_invoice_paid"
  | "send_message"
  | "request_review"
  | "draft_supplier_order"
  | "notify_owner"
  | "add_audit_note";

export type NexBkAutopilotAction = {
  type: NexBkAutopilotActionType;
  config: Record<string, unknown>;   // Shape depends on `type` — validated per-action
};

export type NexBkAutopilotRule = {
  id: Uuid;
  business_id: Uuid;
  name: string;
  description: string | null;
  trigger_type: NexBkAutopilotTriggerType;
  trigger_config: Record<string, unknown>;
  conditions: NexBkAutopilotCondition[];
  actions: NexBkAutopilotAction[];
  mode: NexBkAutopilotMode;
  created_by_user_id: Uuid | null;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
  last_fired_at: IsoTimestamp | null;
  last_fired_event_id: Uuid | null;
  fired_count: number;
  last_error: string | null;
  notes: string | null;
};
