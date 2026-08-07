// GET/POST /api/nex/contacts — Master Contact Database
//
// GET   returns contact list + stats. Query params:
//         limit, lifecycle_stage, kind, tag, consent_marketing, since_hours,
//         email, phone   (email/phone = lookup one contact by identifier)
//
// POST  upsert one contact. Body accepts every UpsertContactInput field.
//       Deduplication is automatic (email primary, phone fallback).
//       Consent defaults to FALSE for new contacts · never silently upgraded.
//
// Turns Master Contact Database from 🔴 Not Installed → 🟢 Running.
//
// Doctrine: project_nex_audience_intelligence_database +
//           project_nex_phase8_backend_build_starts_2026_08_07.md

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  upsertContact,
  contactStats,
  listContacts,
  findContact,
  type ContactKind,
  type LifecycleStage,
} from "@/lib/nex/contacts/fs-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_LIFECYCLE: LifecycleStage[] = ["unknown", "lead", "prospect", "customer", "advocate", "churned"];
const VALID_KIND: ContactKind[] = ["person", "business", "merchant", "lead", "customer", "vendor", "unknown"];

// ── GET · list + stats OR single-contact lookup ──────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const phone = searchParams.get("phone");

  // Single-contact lookup by identifier
  if (email || phone) {
    try {
      const contact = await findContact({ email: email ?? undefined, phone: phone ?? undefined });
      if (!contact) {
        return NextResponse.json({ ok: true, contact: null, found: false });
      }
      return NextResponse.json({ ok: true, contact, found: true, backend: "filesystem" });
    } catch (err) {
      console.error("[contacts.GET.lookup] failed:", err);
      return NextResponse.json(
        { ok: false, error: "lookup_failed", detail: err instanceof Error ? err.message : "unknown" },
        { status: 500 },
      );
    }
  }

  // List + stats
  const limit = Math.min(Math.max(1, Number(searchParams.get("limit") ?? "50") || 50), 1000);
  const hours = Number(searchParams.get("since_hours"));
  const lifecycleRaw = searchParams.get("lifecycle_stage") as LifecycleStage | null;
  const kindRaw = searchParams.get("kind") as ContactKind | null;
  const tag = searchParams.get("tag") ?? undefined;
  const consentRaw = searchParams.get("consent_marketing");

  const lifecycle_stage = lifecycleRaw && VALID_LIFECYCLE.includes(lifecycleRaw) ? lifecycleRaw : undefined;
  const kind = kindRaw && VALID_KIND.includes(kindRaw) ? kindRaw : undefined;
  const consent_marketing = consentRaw === "true" ? true : consentRaw === "false" ? false : undefined;
  const since_ms = Number.isFinite(hours) && hours > 0 ? hours * 60 * 60 * 1000 : undefined;

  try {
    const [contacts, stats] = await Promise.all([
      listContacts({ limit, lifecycle_stage, kind, tag, consent_marketing, since_ms }),
      contactStats(),
    ]);
    return NextResponse.json({
      ok: true,
      backend: "filesystem",
      contacts,
      count: contacts.length,
      stats,
    });
  } catch (err) {
    console.error("[contacts.GET.list] failed:", err);
    return NextResponse.json(
      { ok: false, error: "list_failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

// ── POST · upsert one contact ────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const kindRaw = body.kind as ContactKind | undefined;
  const lifecycleRaw = body.lifecycle_stage as LifecycleStage | undefined;

  const input = {
    email: typeof body.email === "string" ? body.email : undefined,
    phone: typeof body.phone === "string" ? body.phone : undefined,
    name: typeof body.name === "string" ? body.name : undefined,
    kind: kindRaw && VALID_KIND.includes(kindRaw) ? kindRaw : undefined,
    source: typeof body.source === "string" ? body.source : undefined,
    source_ref: typeof body.source_ref === "string" ? body.source_ref : undefined,
    tags: Array.isArray(body.tags) ? (body.tags as unknown[]).filter((t): t is string => typeof t === "string") : undefined,
    consent_marketing: typeof body.consent_marketing === "boolean" ? body.consent_marketing : undefined,
    consent_transactional: typeof body.consent_transactional === "boolean" ? body.consent_transactional : undefined,
    consent_source: typeof body.consent_source === "string" ? body.consent_source : undefined,
    attributes: body.attributes && typeof body.attributes === "object" && !Array.isArray(body.attributes)
      ? (body.attributes as Record<string, unknown>) : undefined,
    lifecycle_stage: lifecycleRaw && VALID_LIFECYCLE.includes(lifecycleRaw) ? lifecycleRaw : undefined,
    linked_business_id: typeof body.linked_business_id === "string" ? body.linked_business_id : undefined,
  };

  try {
    const result = await upsertContact(input);
    return NextResponse.json({
      ok: true,
      backend: "filesystem",
      contact: result.contact,
      created: result.created,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    if (message.includes("requires at least")) {
      return NextResponse.json({ ok: false, error: "insufficient_identifier", detail: message }, { status: 400 });
    }
    console.error("[contacts.POST] failed:", err);
    return NextResponse.json({ ok: false, error: "upsert_failed", detail: message }, { status: 500 });
  }
}
