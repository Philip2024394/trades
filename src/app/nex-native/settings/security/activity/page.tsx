// src/app/nex-native/settings/security/activity/page.tsx
//
// NEX Phase 1.0 Security · Activity page.
// Sealed 2026-10-06 · chronological sign-in audit log for the viewer.
//
// Universal Rule Enforcement discipline (5 artefacts):
//   · Doctrine comment in-source.
//   · Mounts SecurityPageShell.
//   · Registered in _security-routes.ts (key = "activity").
//   · Parity test asserts shell mount + Dashboard snippet.
//   · Playwright screenshots at 320/375/390/430/1280.
//
// Privacy posture: the consumer UI shows the approximate city/country
// derived from GeoLite2 (see /rights for attribution). The raw IP is
// NEVER displayed in this surface · it stays in the DB for ops/audit.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  loadSecurityHealthSnapshot,
  listSignInEventsForAccount,
} from "@/lib/nex-native/security-service";
import { listCredentialsForAccount } from "@/lib/nex-native/webauthn-service";
import { formatApproxLocation } from "@/lib/nex-native/geo/geoip-lookup";
import { SecurityPageShell } from "../_security-page-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  cyan: "#00AFFF",
  green: "#16D66B",
  orange: "#FF7800",
  rose: "#FF6B8A",
  panel: "rgba(16,30,52,0.72)",
  panelAccent: "rgba(0,175,255,0.26)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
};

export default async function SecurityActivityPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const [snapshot, events, credentials] = await Promise.all([
    loadSecurityHealthSnapshot(session.account.id),
    listSignInEventsForAccount(session.account.id, { limit: 30 }),
    listCredentialsForAccount(session.account.id),
  ]);
  const faceEnrolled = credentials.length > 0;

  return (
    <SecurityPageShell
      activeRouteKey="activity"
      title="Activity"
      subtitle="The last 30 events on your account"
      snapshot={snapshot}
      faceEnrolled={faceEnrolled}
    >
      <section data-nex-activity-list>
        {events.length === 0 ? (
          <div
            style={{
              padding: "20px 16px",
              borderRadius: 12,
              background: "rgba(16,30,52,0.4)",
              border: "1px dashed rgba(139,169,209,0.26)",
              fontSize: 13,
              color: NEX.textDim,
              lineHeight: 1.5,
            }}
          >
            No recent sign-in events yet. Signing in from this or another
            device will add rows here.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {events.map((event) => {
              const location =
                event.approx_city || event.approx_country
                  ? formatApproxLocation({
                      city: event.approx_city,
                      country: event.approx_country,
                      resolved: true,
                    })
                  : "Unknown location";
              const typeLabel = labelForEvent(event.event_type, event.success);
              const toneColor = toneColorFor(event.event_type, event.success);
              return (
                <article
                  key={event.id}
                  data-nex-activity-event={event.event_type}
                  data-nex-activity-success={event.success ? "true" : "false"}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: NEX.panel,
                    border: `1px solid ${NEX.panelAccent}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        fontWeight: 800,
                        padding: "2px 7px",
                        borderRadius: 999,
                        background: `rgba(${hexToRgb(toneColor)}, 0.14)`,
                        color: toneColor,
                        border: `1px solid ${toneColor}`,
                      }}
                    >
                      {typeLabel}
                    </span>
                    <span
                      style={{ fontSize: 12, color: NEX.textDim }}
                    >
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: NEX.text }}>
                    {event.device_label ?? "Unknown device"} · {location}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </SecurityPageShell>
  );
}

function labelForEvent(type: string, success: boolean): string {
  if (!success) return "Failed";
  switch (type) {
    case "password":
      return "Password sign-in";
    case "webauthn":
      return "Face sign-in";
    case "magic_link":
      return "Magic link";
    case "remote_sign_out":
      return "Remote sign-out";
    case "password_change":
      return "Password changed";
    default:
      return type;
  }
}

function toneColorFor(type: string, success: boolean): string {
  if (!success) return NEX.rose;
  if (type === "password_change") return NEX.cyan;
  if (type === "remote_sign_out") return NEX.orange;
  return NEX.green;
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "0,175,255";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
