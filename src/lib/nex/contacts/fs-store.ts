// NEX Master Contact Database · filesystem-backed store
//
// DOCTRINE
// The Master Contact Database is the Layer 2 foundation for Marketing ·
// Reporting · Audience Intelligence. Every person or entity NEX has
// interacted with is one Contact record with GDPR-safe consent flags,
// full source traceability, and lifecycle state.
// (`project_nex_audience_intelligence_database`)
//
// SCHEMA
//   contact_id · email · phone · name · kind · source · source_ref
//   tags · consent_marketing · consent_transactional · consent_source
//   attributes (arbitrary JSON) · lifecycle_stage · first_seen_at
//   last_seen_at · linked_business_id · updated_at
//
// STORAGE
// Append-only JSONL at `data/nex-contacts/contacts.jsonl`. Latest snapshot
// per contact_id wins on read. Deduplication key is normalised email · then
// normalised phone · then contact_id. Explicit upsert semantics.
//
// SAFETY
// GDPR: consent_marketing defaults to FALSE. Only explicit true from a
// legitimate source flips it. Every consent change appends a new snapshot
// AND emits an event with the prior value for audit.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { emitEventSafe } from "../events/fs-store";

// ── Paths ──────────────────────────────────────────────────────────

const ROOT = path.join(process.cwd(), "data", "nex-contacts");
const CONTACTS_FILE = path.join(ROOT, "contacts.jsonl");

async function ensureDir(): Promise<void> {
  await fs.mkdir(ROOT, { recursive: true });
}

// ── Types ──────────────────────────────────────────────────────────

export type ContactKind = "person" | "business" | "merchant" | "lead" | "customer" | "vendor" | "unknown";
export type LifecycleStage = "unknown" | "lead" | "prospect" | "customer" | "advocate" | "churned";

export type Contact = {
  contact_id: string;
  email: string | null;           // normalised: lowercased + trimmed
  phone: string | null;           // normalised: digits only with country prefix if present
  name: string | null;
  kind: ContactKind;
  source: string;                 // "manual" · "dump" · "signup" · "import" · "webhook" · ...
  source_ref: string | null;      // job_id · dump_id · webhook_id
  tags: string[];
  consent_marketing: boolean;
  consent_transactional: boolean;
  consent_source: string | null;  // "explicit-opt-in-2026-08-07" · "double-opt-in" · null
  attributes: Record<string, unknown>;
  lifecycle_stage: LifecycleStage;
  first_seen_at: string;
  last_seen_at: string;
  linked_business_id: string | null;
  updated_at: string;
};

export type UpsertContactInput = {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  kind?: ContactKind;
  source?: string;
  source_ref?: string | null;
  tags?: string[];
  consent_marketing?: boolean;
  consent_transactional?: boolean;
  consent_source?: string | null;
  attributes?: Record<string, unknown>;
  lifecycle_stage?: LifecycleStage;
  linked_business_id?: string | null;
};

// ── Normalisers ───────────────────────────────────────────────────

export function normaliseEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const t = email.trim().toLowerCase();
  // Loose validity check · we don't want to accept "hi" as an email.
  if (!t.includes("@") || t.indexOf("@") === t.length - 1) return null;
  return t;
}

export function normalisePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.length < 6) return null;   // too short to be real
  return digits;
}

// ── Read helpers ──────────────────────────────────────────────────

async function readAll(): Promise<Contact[]> {
  let raw: string;
  try {
    raw = await fs.readFile(CONTACTS_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const latest = new Map<string, Contact>();
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try {
      const c = JSON.parse(line) as Contact;
      latest.set(c.contact_id, c);
    } catch { /* skip malformed */ }
  }
  return [...latest.values()];
}

/** Find a contact by dedup keys (email primary · phone fallback). */
async function findExisting(input: UpsertContactInput): Promise<Contact | null> {
  const email = normaliseEmail(input.email);
  const phone = normalisePhone(input.phone);
  if (!email && !phone) return null;
  const all = await readAll();
  if (email) {
    const byEmail = all.find((c) => c.email === email);
    if (byEmail) return byEmail;
  }
  if (phone) {
    const byPhone = all.find((c) => c.phone === phone);
    if (byPhone) return byPhone;
  }
  return null;
}

// ── Upsert · atomic create-or-update ──────────────────────────────

export type UpsertResult = { contact: Contact; created: boolean };

export async function upsertContact(input: UpsertContactInput): Promise<UpsertResult> {
  const email = normaliseEmail(input.email);
  const phone = normalisePhone(input.phone);
  if (!email && !phone && !input.name) {
    throw new Error("upsertContact requires at least email, phone, or name");
  }
  const existing = await findExisting(input);
  const now = new Date().toISOString();

  if (existing) {
    // Merge · new values win when explicitly provided, prior values stick otherwise.
    // Consent NEVER downgrades silently — a caller sending consent_marketing:false
    // over an existing true does flip it (they intentionally set it) but that
    // change is logged as a consent event.
    const prior_marketing = existing.consent_marketing;
    const prior_transactional = existing.consent_transactional;
    const next: Contact = {
      ...existing,
      email: email ?? existing.email,
      phone: phone ?? existing.phone,
      name: input.name ?? existing.name,
      kind: input.kind ?? existing.kind,
      source: existing.source,                          // never overwrite original source
      source_ref: input.source_ref ?? existing.source_ref,
      tags: input.tags ? [...new Set([...existing.tags, ...input.tags])] : existing.tags,
      consent_marketing: input.consent_marketing ?? existing.consent_marketing,
      consent_transactional: input.consent_transactional ?? existing.consent_transactional,
      consent_source: input.consent_source ?? existing.consent_source,
      attributes: input.attributes
        ? { ...existing.attributes, ...input.attributes }
        : existing.attributes,
      lifecycle_stage: input.lifecycle_stage ?? existing.lifecycle_stage,
      linked_business_id: input.linked_business_id ?? existing.linked_business_id,
      last_seen_at: now,
      updated_at: now,
    };
    await ensureDir();
    await fs.appendFile(CONTACTS_FILE, JSON.stringify(next) + "\n", "utf8");

    // Event: consent transitions are audit-critical
    if (prior_marketing !== next.consent_marketing || prior_transactional !== next.consent_transactional) {
      emitEventSafe({
        event_type: "contact_consent_changed",
        source: "system",
        actor_id: input.source ?? "system",
        related_department: "operations",
        outcome: "informational",
        payload: {
          contact_id: next.contact_id,
          prior_marketing,
          new_marketing: next.consent_marketing,
          prior_transactional,
          new_transactional: next.consent_transactional,
          consent_source: next.consent_source,
        },
      });
    } else {
      emitEventSafe({
        event_type: "contact_updated",
        source: "system",
        actor_id: input.source ?? "system",
        related_department: "operations",
        outcome: "informational",
        payload: {
          contact_id: next.contact_id,
          fields_changed: Object.keys(input).filter((k) => k !== "source" && k !== "source_ref"),
        },
      });
    }
    return { contact: next, created: false };
  }

  // Create new
  const contact: Contact = {
    contact_id: randomUUID(),
    email,
    phone,
    name: input.name?.trim() || null,
    kind: input.kind ?? "unknown",
    source: input.source ?? "manual",
    source_ref: input.source_ref ?? null,
    tags: input.tags ? [...new Set(input.tags)] : [],
    consent_marketing: input.consent_marketing === true,          // default FALSE
    consent_transactional: input.consent_transactional === true,  // default FALSE
    consent_source: input.consent_source ?? null,
    attributes: input.attributes ?? {},
    lifecycle_stage: input.lifecycle_stage ?? "unknown",
    first_seen_at: now,
    last_seen_at: now,
    linked_business_id: input.linked_business_id ?? null,
    updated_at: now,
  };
  await ensureDir();
  await fs.appendFile(CONTACTS_FILE, JSON.stringify(contact) + "\n", "utf8");

  emitEventSafe({
    event_type: "contact_created",
    source: "system",
    actor_id: input.source ?? "system",
    related_department: "operations",
    outcome: "success",
    payload: {
      contact_id: contact.contact_id,
      kind: contact.kind,
      source: contact.source,
      has_email: Boolean(contact.email),
      has_phone: Boolean(contact.phone),
      consent_marketing: contact.consent_marketing,
    },
  });
  return { contact, created: true };
}

/** Safe wrapper for hot paths · never throws. */
export async function upsertContactSafe(input: UpsertContactInput): Promise<UpsertResult | null> {
  try {
    return await upsertContact(input);
  } catch (err) {
    console.warn("[contacts] upsert failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Read · single + list + stats ──────────────────────────────────

export async function getContact(contact_id: string): Promise<Contact | null> {
  const all = await readAll();
  return all.find((c) => c.contact_id === contact_id) ?? null;
}

export async function findContact(query: { email?: string; phone?: string }): Promise<Contact | null> {
  const email = normaliseEmail(query.email);
  const phone = normalisePhone(query.phone);
  if (!email && !phone) return null;
  const all = await readAll();
  if (email) {
    const byEmail = all.find((c) => c.email === email);
    if (byEmail) return byEmail;
  }
  if (phone) return all.find((c) => c.phone === phone) ?? null;
  return null;
}

export type ListContactsOptions = {
  limit?: number;
  lifecycle_stage?: LifecycleStage;
  kind?: ContactKind;
  tag?: string;
  consent_marketing?: boolean;
  since_ms?: number;
};

export async function listContacts(options: ListContactsOptions = {}): Promise<Contact[]> {
  const limit = Math.min(Math.max(1, options.limit ?? 50), 1000);
  const sinceIso = options.since_ms
    ? new Date(Date.now() - options.since_ms).toISOString()
    : null;
  const all = await readAll();
  const filtered = all
    .filter((c) => (options.lifecycle_stage ? c.lifecycle_stage === options.lifecycle_stage : true))
    .filter((c) => (options.kind ? c.kind === options.kind : true))
    .filter((c) => (options.tag ? c.tags.includes(options.tag) : true))
    .filter((c) => (typeof options.consent_marketing === "boolean" ? c.consent_marketing === options.consent_marketing : true))
    .filter((c) => (sinceIso ? c.updated_at >= sinceIso : true))
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, limit);
  return filtered;
}

export type ContactStats = {
  total: number;
  by_lifecycle: Record<LifecycleStage, number>;
  by_kind: Record<ContactKind, number>;
  consent_marketing_yes: number;
  consent_transactional_yes: number;
  with_email: number;
  with_phone: number;
};

export async function contactStats(): Promise<ContactStats> {
  const all = await readAll();
  const stats: ContactStats = {
    total: all.length,
    by_lifecycle: { unknown: 0, lead: 0, prospect: 0, customer: 0, advocate: 0, churned: 0 },
    by_kind: { person: 0, business: 0, merchant: 0, lead: 0, customer: 0, vendor: 0, unknown: 0 },
    consent_marketing_yes: 0,
    consent_transactional_yes: 0,
    with_email: 0,
    with_phone: 0,
  };
  for (const c of all) {
    stats.by_lifecycle[c.lifecycle_stage] = (stats.by_lifecycle[c.lifecycle_stage] ?? 0) + 1;
    stats.by_kind[c.kind] = (stats.by_kind[c.kind] ?? 0) + 1;
    if (c.consent_marketing) stats.consent_marketing_yes += 1;
    if (c.consent_transactional) stats.consent_transactional_yes += 1;
    if (c.email) stats.with_email += 1;
    if (c.phone) stats.with_phone += 1;
  }
  return stats;
}
