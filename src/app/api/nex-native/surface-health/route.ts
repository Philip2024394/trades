// src/app/api/nex-native/surface-health/route.ts
//
// POST ingestion endpoint for client-side surface-health boundary
// telemetry · §12 Item 2 of the Chat Surfaces × Visual Themes × HQ
// Diagnostics doctrine (sealed 2026-10-03).
//
// This route is a THIN wrapper around the Item 1 service:
//   src/lib/nex-native/surface-health-service.ts#recordFailure
//
// It does NOT create a parallel observability stack. All validation is
// strict · the request body shape must match the sealed closed-set
// enums, lengths are bounded, and no raw-error-text channel exists in
// either direction. The service's own type system prevents raw error
// text from being persisted even if the route were bypassed.
//
// Correlation IDs are established via runFromRequest · trustInbound
// defaults to false for a public-facing route.

import { NextResponse, type NextRequest } from "next/server";
import { runFromRequest } from "@/lib/nex/observability/correlation";
import { recordFailure } from "@/lib/nex-native/surface-health-service";
import {
  ERROR_CLASSIFICATIONS,
  RECOVERY_ACTIONS,
  isErrorClassification,
  isRecoveryAction,
  type ClientEnvironment,
} from "@/lib/nex-native/surface-health/classification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SURFACE_MAX = 64;
const THEME_MAX = 64;
const MODULE_MAX = 64;
const VERSION_MAX = 64;
const LOCALE_MAX = 16;
const BROWSER_MAX = 24;
const OS_MAX = 24;

interface IngestBody {
  tier?: unknown;
  surface?: unknown;
  visual_theme?: unknown;
  component_module?: unknown;
  error_classification?: unknown;
  recovery_action?: unknown;
  app_version?: unknown;
  theme_version?: unknown;
  client_environment?: unknown;
}

function badRequest(error: string, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ ok: false, error, ...(extra ?? {}) }, { status: 400 });
}

function stringAtMost(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length === 0 || t.length > max) return null;
  return t;
}

function parseClientEnvironment(v: unknown): ClientEnvironment | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const browser = stringAtMost(o.browser, BROWSER_MAX);
  const os = stringAtMost(o.os, OS_MAX);
  if (!browser || !os) return null;
  const device_class =
    o.device_class === "mobile" ||
    o.device_class === "tablet" ||
    o.device_class === "desktop" ||
    o.device_class === "unknown"
      ? o.device_class
      : "unknown";
  const runtime =
    o.runtime === "web" || o.runtime === "pwa" || o.runtime === "unknown"
      ? o.runtime
      : "unknown";
  const locale = typeof o.locale === "string" ? stringAtMost(o.locale, LOCALE_MAX) ?? undefined : undefined;
  return { browser, os, device_class, runtime, ...(locale ? { locale } : {}) };
}

export async function POST(req: NextRequest) {
  return runFromRequest(req, async () => {
    let body: IngestBody;
    try {
      body = (await req.json()) as IngestBody;
    } catch {
      return badRequest("invalid_json");
    }

    const surface = stringAtMost(body.surface, SURFACE_MAX);
    const visual_theme = stringAtMost(body.visual_theme, THEME_MAX);
    const component_module = stringAtMost(body.component_module, MODULE_MAX);
    if (!surface || !visual_theme || !component_module) {
      return badRequest("surface, visual_theme and component_module are required and must be short strings");
    }

    if (!isErrorClassification(body.error_classification)) {
      return badRequest("error_classification not in closed set", {
        allowed: ERROR_CLASSIFICATIONS,
      });
    }
    if (!isRecoveryAction(body.recovery_action)) {
      return badRequest("recovery_action not in closed set", {
        allowed: RECOVERY_ACTIONS,
      });
    }

    const app_version = stringAtMost(body.app_version, VERSION_MAX);
    const theme_version = stringAtMost(body.theme_version, VERSION_MAX);
    const client_environment = parseClientEnvironment(body.client_environment);

    try {
      const row = await recordFailure({
        surface,
        visual_theme,
        component_module,
        error_classification: body.error_classification,
        recovery_action: body.recovery_action,
        app_version: app_version ?? null,
        theme_version: theme_version ?? null,
        client_environment,
      });
      return NextResponse.json(
        {
          ok: true,
          id: row.id,
          failure_signature: row.failure_signature,
          lifecycle_state: row.lifecycle_state,
          occurrence_count: row.occurrence_count,
        },
        { status: 202 },
      );
    } catch (e) {
      // We never surface internal error text. Log via logger (which is
      // already in use inside recordFailure); respond with a generic
      // code so the client can retry if it wants.
      return NextResponse.json(
        { ok: false, error: "surface_health_service_error" },
        { status: 500 },
      );
    }
  });
}
