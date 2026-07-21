// POST /api/admin/coverage — upsert a city launch entry.
// PATCH /api/admin/coverage — status transition.

import { NextResponse } from "next/server";
import { assertAdminRole, getAdminIdentity } from "@/lib/admin/rbac";
import { writeAuditLog, extractRequestContext } from "@/lib/admin/auditLog";
import { upsertCityLaunch, setStatus, loadCityLaunch, type CityLaunchStatus } from "@/lib/cityLaunch/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await assertAdminRole(["admin", "analyst"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json().catch(() => null) as {
    citySlug?: string; cityDisplay?: string; region?: string;
    status?: CityLaunchStatus;
    targetTradesTotal?: number;
    targetHomeownerSignups?: number;
    plannedLaunchDate?: string;
    ownerAdminEmail?: string;
    adminNotes?: string; nextStep?: string;
  } | null;
  if (!body?.citySlug || !body.cityDisplay) {
    return NextResponse.json({ error: "citySlug + cityDisplay required" }, { status: 400 });
  }
  const before = await loadCityLaunch(body.citySlug);
  const res    = await upsertCityLaunch(body as never);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
  const after    = await loadCityLaunch(body.citySlug);
  const identity = await getAdminIdentity();

  void writeAuditLog({
    ...extractRequestContext(req),
    actorAdminId: identity?.adminId ?? null,
    actorEmail:   identity?.email   ?? null,
    actorKind:    identity?.role    ?? "admin",
    action:       before ? "city_launch.updated" : "city_launch.created",
    targetType:   "city_launch",
    targetId:     body.citySlug,
    beforeState:  before as unknown as Record<string, unknown> | null,
    afterState:   after  as unknown as Record<string, unknown> | null
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const auth = await assertAdminRole(["admin", "analyst"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json().catch(() => null) as {
    citySlug?: string; status?: CityLaunchStatus;
  } | null;
  if (!body?.citySlug || !body.status) {
    return NextResponse.json({ error: "citySlug + status required" }, { status: 400 });
  }
  const before = await loadCityLaunch(body.citySlug);
  if (!before) return NextResponse.json({ error: "city not found" }, { status: 404 });
  const ok = await setStatus(body.citySlug, body.status);
  if (!ok) return NextResponse.json({ error: "status update failed" }, { status: 500 });
  const after    = await loadCityLaunch(body.citySlug);
  const identity = await getAdminIdentity();

  void writeAuditLog({
    ...extractRequestContext(req),
    actorAdminId: identity?.adminId ?? null,
    actorEmail:   identity?.email   ?? null,
    actorKind:    identity?.role    ?? "admin",
    action:       "city_launch.status_changed",
    targetType:   "city_launch",
    targetId:     body.citySlug,
    beforeState:  before as unknown as Record<string, unknown> | null,
    afterState:   after  as unknown as Record<string, unknown> | null
  });
  return NextResponse.json({ ok: true });
}
