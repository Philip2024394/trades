// src/app/nex-native/settings/security/devices/page.tsx
//
// NEX Phase 1.0 Security · Devices page.
// Sealed 2026-10-06 · active sessions + face sign-in credentials.
//
// Universal Rule Enforcement discipline (5 artefacts):
//   · Doctrine comment in-source.
//   · Mounts SecurityPageShell.
//   · Registered in _security-routes.ts (key = "devices").
//   · Parity test asserts shell mount + Dashboard snippet.
//   · Playwright screenshots at 320/375/390/430/1280.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  loadSecurityHealthSnapshot,
  listSessionsForAccount,
  sessionKeyFromAccessToken,
  deriveDeviceLabel,
} from "@/lib/nex-native/security-service";
import { listCredentialsForAccount } from "@/lib/nex-native/webauthn-service";
import { lookupApproxLocation, formatApproxLocation } from "@/lib/nex-native/geo/geoip-lookup";
import { SecurityPageShell } from "../_security-page-shell";
import { DevicesClient, type SessionView, type CredentialView } from "./_devices-client";
import { headers as nextHeaders, cookies as nextCookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SecurityDevicesPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const [snapshot, rawSessions, rawCredentials] = await Promise.all([
    loadSecurityHealthSnapshot(session.account.id),
    listSessionsForAccount(session.account.id),
    listCredentialsForAccount(session.account.id),
  ]);
  const faceEnrolled = rawCredentials.length > 0;

  // Derive the current session key so the client can highlight the
  // "this is you" row.
  const currentSessionKey = await deriveCurrentSessionKey();

  // Shape sessions into the client view. Rows with revoked_at are kept
  // (so the user sees them disappear) but labeled.
  const sessions: SessionView[] = await Promise.all(
    rawSessions.map(async (s) => {
      const isCurrent =
        currentSessionKey !== null && s.supabase_session_key === currentSessionKey;
      let device = s.device_label;
      if (!device) device = deriveDeviceLabel(s.user_agent);
      const revoked = !!s.revoked_at;
      let approxLocation = "Unknown location";
      if (s.approx_city || s.approx_country) {
        approxLocation = formatApproxLocation({
          city: s.approx_city,
          country: s.approx_country,
          resolved: true,
        });
      } else if (s.ip_address) {
        // Fallback · attempt a lookup if the DB didn't persist one.
        const loc = await lookupApproxLocation(s.ip_address);
        approxLocation = formatApproxLocation(loc);
      }
      return {
        id: s.id,
        device_label: device,
        approx_location: approxLocation,
        user_agent: s.user_agent,
        last_seen_iso: s.last_seen_at,
        created_iso: s.created_at,
        trusted: s.trusted,
        is_current: isCurrent,
        revoked,
      };
    }),
  );

  const credentials: CredentialView[] = rawCredentials.map((c) => ({
    credential_id: c.credential_id,
    label: c.device_label ?? "Face sign-in",
    created_iso: c.created_at,
    last_used_iso: c.last_used_at,
  }));

  return (
    <SecurityPageShell
      activeRouteKey="devices"
      title="Devices"
      subtitle="Active sessions and face sign-in credentials"
      snapshot={snapshot}
      faceEnrolled={faceEnrolled}
    >
      <DevicesClient sessions={sessions} credentials={credentials} />
    </SecurityPageShell>
  );
}

// ---------------------------------------------------------------------------
// Internal · derive sessionKey from the current request so we can tag
// the "this is you" row in the UI.
// ---------------------------------------------------------------------------

async function deriveCurrentSessionKey(): Promise<string | null> {
  try {
    const h = await nextHeaders();
    const auth = h.get("authorization");
    if (auth && /^Bearer\s+/i.test(auth)) {
      const token = auth.replace(/^Bearer\s+/i, "").trim();
      if (token) return sessionKeyFromAccessToken(token);
    }
    const cookieStore = await nextCookies();
    const header = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const token = extractAccessTokenFromCookieHeader(header);
    return token ? sessionKeyFromAccessToken(token) : null;
  } catch {
    return null;
  }
}

function extractAccessTokenFromCookieHeader(cookieHeader: string): string | null {
  if (!cookieHeader) return null;
  const cookies: Record<string, string> = Object.fromEntries(
    cookieHeader.split(";").map((p) => {
      const idx = p.indexOf("=");
      if (idx < 0) return [p.trim(), ""];
      return [p.slice(0, idx).trim(), decodeURIComponent(p.slice(idx + 1).trim())];
    }),
  );
  for (const [k, v] of Object.entries(cookies)) {
    if (!/^sb-.*-auth-token$/.test(k)) continue;
    const parsed = tryParseSupabaseCookie(v);
    if (parsed) return parsed;
  }
  const chunkKeys = Object.keys(cookies)
    .filter((k) => /^sb-.*-auth-token\.\d+$/.test(k))
    .sort();
  if (chunkKeys.length > 0) {
    const joined = chunkKeys.map((k) => cookies[k]!).join("");
    const parsed = tryParseSupabaseCookie(joined);
    if (parsed) return parsed;
  }
  return null;
}

function tryParseSupabaseCookie(raw: string): string | null {
  if (!raw) return null;
  let payload = raw;
  if (payload.startsWith("base64-")) payload = payload.slice(7);
  try {
    const decoded = Buffer.from(payload, "base64").toString("utf8");
    const obj = JSON.parse(decoded);
    if (obj && typeof obj === "object" && typeof obj.access_token === "string")
      return obj.access_token;
  } catch {
    /* fall through */
  }
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object" && typeof obj.access_token === "string")
      return obj.access_token;
  } catch {
    /* fall through */
  }
  return null;
}
