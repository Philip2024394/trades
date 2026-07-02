// GET /api/platform/packs/list
//   ?industry=…
//
// Returns every registered Pack manifest, optionally filtered by
// industry, enriched with install state so the Pack browser can
// render "Install" / "Manage" in a single pass.

import { NextResponse } from "next/server";
import { packRegistry } from "@/platform/packs/registry";
import { runtime as platformRuntime } from "@/platform/runtime";
import { loadStudioSession } from "@/lib/studio/session";
import "@/platform/apps";
import "@/platform/packs";

export const runtime = "nodejs";
export const revalidate = 0;

type InstallState =
  | { kind: "not-installed" }
  | { kind: "installed"; version: string; installedAt: string }
  | { kind: "previously-installed"; version: string; uninstalledAt: string };

export async function GET(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const industry = url.searchParams.get("industry");

  let manifests = packRegistry.list();
  if (industry) {
    manifests = packRegistry.listByIndustry(industry);
  }

  const installs = await platformRuntime.listActivePackInstalls(
    session.merchant.id
  );
  const installsBySlug = new Map(installs.map((r) => [r.pack_slug, r]));

  const items = manifests.map((m) => {
    const install = installsBySlug.get(m.slug);
    let installState: InstallState;
    if (install && !install.uninstalled_at) {
      installState = {
        kind: "installed",
        version: install.version,
        installedAt: install.installed_at
      };
    } else if (install && install.uninstalled_at) {
      installState = {
        kind: "previously-installed",
        version: install.version,
        uninstalledAt: install.uninstalled_at
      };
    } else {
      installState = { kind: "not-installed" };
    }
    return { manifest: m, installState };
  });

  const industries = Array.from(
    new Set(packRegistry.list().map((p) => p.industry))
  ).sort();

  return NextResponse.json({
    ok: true,
    items,
    totalRegistered: packRegistry.size(),
    facets: { industries }
  });
}
