// POST /api/nex/staircase-renovations/enquiry
//
// Customer-facing atomic quote submission. Accepts multipart/form-data:
//   Text fields:
//     path                 · "plan" | "photos"
//     name                 · required
//     phone                · required
//     email                · required
//     postcode             · optional
//     notes                · optional (only meaningful on `photos` path)
//     renovation_slug      · which category the customer was viewing
//     renovation_image_src · exact image src (may be empty · e.g. category
//                            with no images · customer opened Quote anyway)
//     renovation_image_alt · alt text of that image
//     renovation_image_id  · derived id (slug + index) · authoritative
//     plan_slug            · selected plan (only on `plan` path)
//     plan_label           · label of the selected plan
//     source_page          · always /nex-app/staircase-renovations
//   File fields (only on `photos` path · all optional):
//     photo_bottom, photo_top, photo_side, photo_balcony (single each)
//     photo_extra_*         · any additional slots
//
// Persists:
//   1. Enquiry JSON at data/staircase-renovations/enquiries/<id>.json
//   2. Photo files at data/staircase-renovations/uploads/<id>/<slot>-<safe-name>
//   3. Contact upsert via existing Master Contact Database (dedup by email/phone)
//   4. Intelligence event via existing enterprise event bus
//
// Freeze-safe:
//   · Uses existing NEX contact + event APIs · no new schemas
//   · No worker chain changes · no Truth-Contract surfaces touched
//   · No migrations · no database writes beyond existing storage

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { upsertContact } from "@/lib/nex/contacts/fs-store";
import { emitEventSafe } from "@/lib/nex/events/fs-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ENQUIRIES_DIR = join(process.cwd(), "data", "staircase-renovations", "enquiries");
const UPLOADS_ROOT  = join(process.cwd(), "data", "staircase-renovations", "uploads");
const MAX_FILE_BYTES = 12 * 1024 * 1024;   // 12 MB per photo · pragmatic mobile ceiling
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function safeFilename(name: string): string {
  const clean = name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  return clean.length > 0 ? clean : "photo";
}

function trim(v: FormDataEntryValue | null, max = 500): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function isFile(v: FormDataEntryValue | null): v is File {
  return v instanceof File && typeof v.size === "number" && v.size > 0;
}

export async function POST(req: NextRequest) {
  // Content-type gate · reject non-multipart calls cleanly.
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json({ ok: false, error: "expected multipart/form-data" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    return NextResponse.json({ ok: false, error: `form parse failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 400 });
  }

  // ── Required text fields ──────────────────────────────────────
  const path = trim(form.get("path"), 32);
  if (path !== "plan" && path !== "photos") {
    return NextResponse.json({ ok: false, error: "path must be 'plan' or 'photos'" }, { status: 400 });
  }
  const name  = trim(form.get("name"), 120);
  const phone = trim(form.get("phone"), 40);
  const email = trim(form.get("email"), 160).toLowerCase();
  if (!name)  return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
  if (!phone) return NextResponse.json({ ok: false, error: "phone is required" }, { status: 400 });
  if (!email) return NextResponse.json({ ok: false, error: "email is required" }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ ok: false, error: "email format invalid" }, { status: 400 });

  const postcode = trim(form.get("postcode"), 16).toUpperCase();
  const notes    = trim(form.get("notes"), 1000);

  // ── Renovation context (authoritative from viewer state) ──────
  const renovationSlug     = trim(form.get("renovation_slug"), 60);
  const renovationImageSrc = trim(form.get("renovation_image_src"), 500);
  const renovationImageAlt = trim(form.get("renovation_image_alt"), 240);
  const renovationImageId  = trim(form.get("renovation_image_id"), 120);

  // ── Plan-path fields (only used when path === 'plan') ─────────
  const planSlug  = trim(form.get("plan_slug"), 80);
  const planLabel = trim(form.get("plan_label"), 120);
  if (path === "plan" && !planSlug) {
    return NextResponse.json({ ok: false, error: "plan_slug required when path=plan" }, { status: 400 });
  }

  const sourcePage = trim(form.get("source_page"), 120) || "/nex-app/staircase-renovations";

  // ── Create enquiry id + directories ───────────────────────────
  const enquiryId = `sr_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const uploadDir = join(UPLOADS_ROOT, enquiryId);
  await mkdir(ENQUIRIES_DIR, { recursive: true });

  // ── Persist photo attachments (only on photos path) ───────────
  type StoredPhoto = { slot: string; original_filename: string; size_bytes: number; mime_type: string; stored_path: string };
  const storedPhotos: StoredPhoto[] = [];
  const photoErrors: Array<{ slot: string; error: string }> = [];

  if (path === "photos") {
    const knownSlots = ["photo_bottom", "photo_top", "photo_side", "photo_balcony"];
    // Also accept any photo_extra_* single-file slots
    const extras = Array.from(form.keys()).filter((k) => k.startsWith("photo_extra_"));
    const allSlots = [...knownSlots, ...extras];
    // Ensure upload dir exists ONLY when we actually have photos to write
    let dirCreated = false;
    for (const slot of allSlots) {
      const entry = form.get(slot);
      if (!isFile(entry)) continue;
      const file = entry;
      if (file.size > MAX_FILE_BYTES) {
        photoErrors.push({ slot, error: `file exceeds ${MAX_FILE_BYTES} bytes` });
        continue;
      }
      if (file.type && !ALLOWED_MIME.has(file.type.toLowerCase())) {
        photoErrors.push({ slot, error: `mime not allowed: ${file.type}` });
        continue;
      }
      if (!dirCreated) { await mkdir(uploadDir, { recursive: true }); dirCreated = true; }
      const safe = safeFilename(file.name || `${slot}.bin`);
      const dest = join(uploadDir, `${slot}-${safe}`);
      try {
        const buf = Buffer.from(await file.arrayBuffer());
        await writeFile(dest, buf);
        storedPhotos.push({
          slot,
          original_filename: file.name,
          size_bytes:        file.size,
          mime_type:         file.type || "application/octet-stream",
          stored_path:       dest,
        });
      } catch (err) {
        photoErrors.push({ slot, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  // ── Contact upsert via existing Master Contact Database ───────
  // Dedup by email primary + phone fallback · consent DEFAULTS FALSE.
  // We do not silently opt the customer into marketing.
  let contactRef: { contact_id: string; created: boolean } | null = null;
  try {
    const c = await upsertContact({
      email,
      phone,
      name,
      lifecycle_stage: "lead",
      kind: "lead",
      tags: ["staircase-renovations", `renovation:${renovationSlug || "unknown"}`, path === "plan" ? "path:plan" : "path:photos"],
      source: "staircase-renovations-quote",
      source_ref: renovationImageId || renovationSlug || null,
      attributes: {
        postcode: postcode || null,
        source_page: sourcePage,
      },
    });
    contactRef = { contact_id: c.contact.contact_id, created: c.created };
  } catch (err) {
    // Contact upsert failure MUST NOT fail the enquiry submission ·
    // the enquiry file + photos are still authoritative.
    photoErrors.push({ slot: "__contact_upsert__", error: err instanceof Error ? err.message : String(err) });
  }

  // ── Compose the enquiry record ───────────────────────────────
  const submittedAt = new Date().toISOString();
  const enquiry = {
    enquiry_id: enquiryId,
    source:     "staircase-renovations",
    source_page: sourcePage,
    submitted_at: submittedAt,
    path,
    customer: { name, phone, email, postcode: postcode || null, notes: notes || null },
    renovation_context: {
      collection_slug: renovationSlug || null,
      image_src:       renovationImageSrc || null,
      image_alt:       renovationImageAlt || null,
      image_id:        renovationImageId || null,
    },
    plan_selection: path === "plan" ? { plan_slug: planSlug, plan_label: planLabel || null } : null,
    photos:         storedPhotos,
    photo_errors:   photoErrors,
    contact_ref:    contactRef,
    request_headers: {
      user_agent: req.headers.get("user-agent") ?? null,
    },
  };

  // ── Persist enquiry JSON ─────────────────────────────────────
  const enquiryPath = join(ENQUIRIES_DIR, `${enquiryId}.json`);
  try {
    await writeFile(enquiryPath, JSON.stringify(enquiry, null, 2), "utf8");
  } catch (err) {
    return NextResponse.json({ ok: false, error: `enquiry write failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }

  // ── Intelligence event · enterprise event bus (fire-and-forget) ─
  try {
    emitEventSafe({
      event_type: "staircase_quote_submitted",
      source: "staircase-renovations-quote",
      related_department: "sales",
      outcome: "success",
      // Never include full name / email / phone / notes here · reference only.
      payload: {
        enquiry_id:      enquiryId,
        path,
        collection_slug: renovationSlug || null,
        image_id:        renovationImageId || null,
        plan_slug:       path === "plan" ? planSlug : null,
        photo_count:     storedPhotos.length,
        contact_id:      contactRef?.contact_id ?? null,
      },
    });
  } catch { /* fire-and-forget · never fails the request */ }

  return NextResponse.json({
    ok: true,
    enquiry_id: enquiryId,
    submitted_at: submittedAt,
    path,
    photos_stored: storedPhotos.length,
    photo_errors: photoErrors,
    contact_ref: contactRef,
  });
}
