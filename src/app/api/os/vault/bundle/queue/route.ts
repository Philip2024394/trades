// POST /api/os/vault/bundle/queue
//
// Queue an end-of-project bundle export for a project the current
// homeowner owns. Bundle generation itself is a background job that
// reads from os_project_bundle_exports where status='queued'.
//
// Requires vault entitlement (bundle_export_enabled).

import { NextResponse } from "next/server";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { loadVaultEntitlements } from "@/lib/os/vault/entitlements";
import {
  partyOwnsProject,
  queueProjectBundleExport
} from "@/lib/os/vault/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EXPORT_TYPES = [
  "project_completion",
  "homeowner_manual",
  "property_sale_transfer",
  "legal_disclosure",
  "insurance_claim"
] as const;

type AllowedExportType = (typeof ALLOWED_EXPORT_TYPES)[number];

export async function POST(request: Request) {
  const party = await loadHomeownerSession();
  if (!party) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 }
    );
  }

  let body: { projectId?: string; exportType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!body.projectId || typeof body.projectId !== "string") {
    return NextResponse.json(
      { ok: false, error: "projectId is required." },
      { status: 400 }
    );
  }

  const exportType = (body.exportType ??
    "homeowner_manual") as AllowedExportType;
  if (!ALLOWED_EXPORT_TYPES.includes(exportType)) {
    return NextResponse.json(
      { ok: false, error: "Invalid exportType." },
      { status: 400 }
    );
  }

  // Ownership check — homeowner must have a property claim covering
  // the project's property. Fail-closed on missing claim.
  const owns = await partyOwnsProject(party.id, body.projectId);
  if (!owns) {
    return NextResponse.json(
      { ok: false, error: "Project not found or not owned by you." },
      { status: 404 }
    );
  }

  // Entitlement check — bundle export requires the flag on the derived
  // cache. Free tier gets this by default so failure is rare, but we
  // enforce structurally so a future policy change lands cleanly.
  const entitlements = await loadVaultEntitlements(party.id);
  if (!entitlements.bundleExportEnabled) {
    return NextResponse.json(
      {
        ok: false,
        error: "Bundle export not enabled on your plan.",
        upgradeHref: "/home/vault/upgrade"
      },
      { status: 402 }
    );
  }

  let bundleId: string;
  try {
    bundleId = await queueProjectBundleExport(
      body.projectId,
      party.id,
      exportType
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to queue bundle export." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, bundleId });
}
