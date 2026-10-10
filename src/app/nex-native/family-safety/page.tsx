// src/app/nex-native/family-safety/page.tsx
//
// NEX Family Safety · HOME page · authored 2026-10-10.
// ----------------------------------------------------
// The hub for the Family Safety product. Renders:
//
//   · Hero · title + one-paragraph explanation
//   · SIMULATED · PILOT banner (via the shell)
//   · "Your family" status panel (reflects the viewer's
//     FamilyMembershipState)
//   · CTA grid · Setup / Dashboard / SafeChat / Subscription
//   · "What this does / What this doesn't do" transparency section
//
// Server Component. Reads the sealed session + home snapshot server-
// side and never leaks counterparty data.
//
// Scope boundary: FS-1. The CTAs route into FS-2 / FS-3 / FS-4
// surfaces · if those routes don't exist yet, the HTTP response for
// the target is their concern. This home page's job is to tell the
// viewer honestly where to go.

import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getFamilyHomeSnapshot } from "@/lib/nex-native/family-safety/home-service";
import { FAMILY_SAFETY_PALETTE } from "@/components/nex-native/family-safety/_palette";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { StatusChip } from "@/components/nex-native/family-safety/StatusChip";
import { EmptyState } from "@/components/nex-native/family-safety/EmptyState";
import type {
  FamilyHomeSnapshot,
  FamilyMembershipState,
  StatusChipTone,
} from "@/components/nex-native/family-safety/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────
// Copy maps · membership state → user-facing label + tone
// ─────────────────────────────────────────────────────────────────────

interface MembershipPresentation {
  readonly tone: StatusChipTone;
  readonly chipLabel: string;
  readonly panelTitle: string;
  readonly panelBody: string;
}

const MEMBERSHIP_PRESENTATION: Readonly<
  Record<FamilyMembershipState, MembershipPresentation>
> = {
  none: {
    tone: "neutral",
    chipLabel: "No family yet",
    panelTitle: "No family set up yet",
    panelBody:
      "You haven't linked anyone yet. When you're ready, start Setup to invite a parent, child, or trusted adult.",
  },
  pending_invitation: {
    tone: "pending",
    chipLabel: "Invitation waiting",
    panelTitle: "An invitation is waiting for you",
    panelBody:
      "Someone has invited you into a family link. Open Setup to review it. You can accept, decline, or report pressure · nothing happens automatically.",
  },
  active_guardian: {
    tone: "active",
    chipLabel: "Guardian",
    panelTitle: "You're an active guardian",
    panelBody:
      "You can view your family dashboard, configure SafeChat defaults, and manage your subscription. SafeChat remains SIMULATED in this build · nothing is logged.",
  },
  active_child: {
    tone: "active",
    chipLabel: "Linked child",
    panelTitle: "You're an active ward",
    panelBody:
      "A guardian is linked to your account. You can view the dashboard to see what's shared · which stays nothing in Phase 1 beyond the sealed emergency-alert primitive. You can revoke a link at any time.",
  },
  suspended: {
    tone: "suspended",
    chipLabel: "Suspended",
    panelTitle: "Your links are paused",
    panelBody:
      "All family links on this account are temporarily paused. This state is reserved for Phase 2 · if you're seeing it now please contact NEX support.",
  },
  revoked: {
    tone: "revoked",
    chipLabel: "Previously linked",
    panelTitle: "No active links",
    panelBody:
      "You had a family link that was revoked. The history is kept per the retention policy. You can start a new link at any time via Setup.",
  },
};

// ─────────────────────────────────────────────────────────────────────
// CTA grid
// ─────────────────────────────────────────────────────────────────────

interface CtaDef {
  readonly key: string;
  readonly href: string;
  readonly glyph: string;
  readonly title: string;
  readonly body: string;
  readonly enabled: boolean;
}

function buildCtas(snapshot: FamilyHomeSnapshot): readonly CtaDef[] {
  return [
    {
      key: "create-child",
      href: "/nex-native/family-safety/create-child",
      glyph: "👶",
      title: "Create a child account",
      body: "Create a safe NEX account for your family member under 16.",
      enabled: true,
    },
    {
      key: "custody",
      href: "/nex-native/family-safety/custody",
      glyph: "🧷",
      title: "Custody",
      body: "View children in your custody · reset passwords · audit log.",
      enabled: true,
    },
    {
      key: "setup",
      href: "/nex-native/family-safety/invite",
      glyph: "🪪",
      title: "Guardian partner setup",
      body:
        snapshot.familyMembershipState === "pending_invitation"
          ? "Review your waiting invitation (secondary guardian)."
          : "Invite a secondary guardian or accept an invitation.",
      enabled: true,
    },
    {
      key: "dashboard",
      href: "/nex-native/family-safety/dashboard",
      glyph: "📊",
      title: "Dashboard",
      body: snapshot.canAccessDashboard
        ? "View your active links, status, and alerts."
        : "Available once you have an active link.",
      enabled: snapshot.canAccessDashboard,
    },
    {
      key: "safechat",
      href: "/nex-native/family-safety/safechat",
      glyph: "💬",
      title: "SafeChat",
      body: snapshot.canConfigureSafeChat
        ? "Configure SafeChat defaults for your family."
        : "Available to active guardians.",
      enabled: snapshot.canConfigureSafeChat,
    },
    {
      key: "subscription",
      href: "/nex-native/family-safety/subscription",
      glyph: "⚡",
      title: "Subscription",
      body: "Manage your Family Safety plan.",
      enabled: true,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────

export default async function FamilySafetyHomePage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const snapshot = await getFamilyHomeSnapshot({
    viewerAccountId: session.account.id,
  });
  const presentation = MEMBERSHIP_PRESENTATION[snapshot.familyMembershipState];
  const ctas = buildCtas(snapshot);

  return (
    <FamilySafetyShell
      activeNav="home"
      subtitle="A simple, honest safety layer for people you care about."
    >
      {/* Hero */}
      <section
        aria-label="Family Safety overview"
        data-nex-family-safety-home-hero="true"
        style={{
          padding: "20px",
          background: FAMILY_SAFETY_PALETTE.surfaceMuted,
          border: `1px solid ${FAMILY_SAFETY_PALETTE.familyGreenBorder}`,
          borderRadius: 14,
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            color: FAMILY_SAFETY_PALETTE.textPrimary,
          }}
        >
          NEX Family Safety
        </h2>
        <p
          style={{
            marginTop: 8,
            marginBottom: 0,
            fontSize: 13.5,
            color: FAMILY_SAFETY_PALETTE.textSecondary,
            lineHeight: 1.55,
          }}
        >
          Create a safe NEX account for your family member under 16. You
          enter their name, their age, and upload their government ID so NEX
          can confirm the account is for a minor. You stay in custody of the
          account until they turn 16.
        </p>
      </section>

      {/* Your family status */}
      <section
        aria-label="Your family status"
        data-nex-family-safety-home-status="true"
        style={{
          padding: "16px",
          background: FAMILY_SAFETY_PALETTE.surfaceMuted,
          border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
          borderRadius: 14,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 8,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: FAMILY_SAFETY_PALETTE.textPrimary,
            }}
          >
            Your family
          </h3>
          <StatusChip
            tone={presentation.tone}
            label={presentation.chipLabel}
            testId="nex-family-safety-home-membership-chip"
          />
          {snapshot.pendingInvitationCount > 0 ? (
            <StatusChip
              tone="pending"
              label={`${snapshot.pendingInvitationCount} pending`}
              testId="nex-family-safety-home-pending-chip"
            />
          ) : null}
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: FAMILY_SAFETY_PALETTE.textPrimary,
            marginBottom: 4,
          }}
        >
          {presentation.panelTitle}
        </div>
        <div
          style={{
            fontSize: 13,
            color: FAMILY_SAFETY_PALETTE.textSecondary,
            lineHeight: 1.55,
          }}
        >
          {presentation.panelBody}
        </div>
      </section>

      {/* CTA grid */}
      <section
        aria-label="Family Safety sections"
        data-nex-family-safety-home-ctas="true"
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 16,
        }}
      >
        {ctas.map((c) => (
          <Link
            key={c.key}
            href={c.href}
            prefetch={false}
            data-nex-family-safety-home-cta={c.key}
            data-nex-family-safety-home-cta-enabled={c.enabled ? "true" : "false"}
            style={{
              display: "flex",
              gap: 12,
              padding: "14px",
              background: FAMILY_SAFETY_PALETTE.surfaceMuted,
              border: `1px solid ${
                c.enabled
                  ? FAMILY_SAFETY_PALETTE.cyanBorder
                  : FAMILY_SAFETY_PALETTE.divider
              }`,
              borderRadius: 12,
              textDecoration: "none",
              color: FAMILY_SAFETY_PALETTE.textPrimary,
              opacity: c.enabled ? 1 : 0.75,
            }}
          >
            <div
              aria-hidden
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: 10,
                background: FAMILY_SAFETY_PALETTE.cyanMuted,
                color: FAMILY_SAFETY_PALETTE.cyan,
                display: "grid",
                placeItems: "center",
                fontSize: 20,
              }}
            >
              {c.glyph}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: FAMILY_SAFETY_PALETTE.textPrimary,
                }}
              >
                {c.title}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontSize: 12,
                  color: FAMILY_SAFETY_PALETTE.textSecondary,
                  lineHeight: 1.45,
                }}
              >
                {c.body}
              </div>
            </div>
            <div
              aria-hidden
              style={{
                color: c.enabled
                  ? FAMILY_SAFETY_PALETTE.cyan
                  : FAMILY_SAFETY_PALETTE.textDim,
                fontSize: 18,
                alignSelf: "center",
              }}
            >
              →
            </div>
          </Link>
        ))}
      </section>

      {/* Transparency · what this does / doesn't do */}
      <section
        aria-label="Family Safety transparency"
        data-nex-family-safety-home-transparency="true"
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            padding: "14px",
            background: FAMILY_SAFETY_PALETTE.surfaceMuted,
            border: `1px solid ${FAMILY_SAFETY_PALETTE.familyGreenBorder}`,
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: FAMILY_SAFETY_PALETTE.familyGreen,
              marginBottom: 8,
            }}
          >
            What this does
          </div>
          <ul
            data-nex-family-safety-promises="true"
            style={{
              margin: 0,
              padding: "0 0 0 18px",
              fontSize: 13,
              color: FAMILY_SAFETY_PALETTE.textSecondary,
              lineHeight: 1.55,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <li>Link a parent/guardian with a child, with consent on both sides.</li>
            <li>Let either party revoke the link at any time.</li>
            <li>Surface a "pressure signal" the child can raise privately to NEX.</li>
            <li>Keep SafeChat classification SIMULATED until a real-world launch is authorised.</li>
            <li>Default every new permission to OFF.</li>
          </ul>
        </div>
        <div
          style={{
            padding: "14px",
            background: FAMILY_SAFETY_PALETTE.surfaceMuted,
            border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: FAMILY_SAFETY_PALETTE.textPrimary,
              marginBottom: 8,
            }}
          >
            What this doesn't do
          </div>
          <ul
            data-nex-family-safety-ceiling="true"
            style={{
              margin: 0,
              padding: "0 0 0 18px",
              fontSize: 13,
              color: FAMILY_SAFETY_PALETTE.textSecondary,
              lineHeight: 1.55,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <li>No parent reads a child's messages.</li>
            <li>No ID documents, biometric capture, or KYC.</li>
            <li>No background location sharing or safety summaries in Phase 1.</li>
            <li>No automatic notifications of a parent on a child's actions.</li>
            <li>No marketing surface · this is a safety feature, not growth.</li>
          </ul>
        </div>
      </section>

      {snapshot.familyMembershipState === "none" ? (
        <EmptyState
          glyph="👨‍👩‍👧"
          title="Start when you're ready"
          description="Create a safe NEX account for your family member under 16. You can also invite a secondary guardian · nothing is sent until you confirm."
          ctaHref="/nex-native/family-safety/create-child"
          ctaLabel="Create a child account"
          testId="nex-family-safety-home-empty"
        />
      ) : null}
    </FamilySafetyShell>
  );
}
