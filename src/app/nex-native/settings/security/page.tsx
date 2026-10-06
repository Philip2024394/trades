// src/app/nex-native/settings/security/page.tsx
//
// NEX Phase 1.0 Security · landing + Privacy Audit Dashboard.
// Sealed 2026-10-06 · founder-authorised. Replaces the previous
// "Coming soon" placeholder with the live surface.
//
// Universal Rule Enforcement discipline (5 artefacts):
//   · Doctrine comment in-source (this block).
//   · Mounts the shared `SecurityPageShell` (single implementation).
//   · Appears in `_security-routes.ts` with key = "landing".
//   · Parity test `_security-pages.test.ts` asserts every registered
//     route has a page file + mounts the shell + exposes the Dashboard
//     snippet.
//   · Playwright screenshots at 320/375/390/430/1280 serve as visual
//     proof.

import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { loadSecurityHealthSnapshot } from "@/lib/nex-native/security-service";
import { listCredentialsForAccount } from "@/lib/nex-native/webauthn-service";
import { SECURITY_ROUTES } from "./_security-routes";
import { SecurityPageShell } from "./_security-page-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  cyan: "#00AFFF",
  panel: "rgba(16,30,52,0.72)",
  panelAccent: "rgba(0,175,255,0.26)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
};

export default async function SecurityLandingPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const [snapshot, credentials] = await Promise.all([
    loadSecurityHealthSnapshot(session.account.id),
    listCredentialsForAccount(session.account.id),
  ]);
  const faceEnrolled = credentials.length > 0;

  // Deeper-route tiles · exclude the landing itself from the "jump to"
  // list below the dashboard · the dashboard rows already link to each
  // deep route individually, this is a scannable grid alternative.
  const deepRoutes = SECURITY_ROUTES.filter((r) => r.key !== "landing");

  return (
    <SecurityPageShell
      activeRouteKey="landing"
      title="Security"
      subtitle="Dashboard · health check · everything in one place"
      snapshot={snapshot}
      faceEnrolled={faceEnrolled}
    >
      <div
        data-nex-security-landing
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: NEX.panel,
            border: `1px solid ${NEX.panelAccent}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 800,
              marginBottom: 6,
            }}
          >
            Privacy audit
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: NEX.text,
              lineHeight: 1.55,
            }}
          >
            We never claim encryption or privacy guarantees that NEX
            doesn&apos;t actually provide. Everything the Dashboard shows
            above is real · fetched from the live tables. If a row looks
            wrong, tap it to open the detail page and fix it.
          </p>
        </div>

        <div
          data-nex-security-landing-grid
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 10,
          }}
        >
          {deepRoutes.map((route) => (
            <Link
              key={route.key}
              href={route.href}
              prefetch={false}
              data-nex-security-landing-tile={route.key}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: "14px 16px",
                borderRadius: 12,
                background: NEX.panel,
                border: `1px solid ${NEX.panelAccent}`,
                textDecoration: "none",
                color: NEX.text,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: NEX.text,
                }}
              >
                {route.title}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: NEX.textDim,
                  lineHeight: 1.45,
                }}
              >
                {route.subtitle}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </SecurityPageShell>
  );
}
