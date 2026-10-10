// src/app/nex-native/family-safety/setup/page.tsx
//
// Family Safety · setup entry · "No family yet · create one or accept
// an invitation" router page. Routes to /invite OR /accept depending
// on what the viewer already has.

import * as React from "react";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  listLinksForChild,
  listLinksForGuardian,
} from "@/lib/nex-native/family-links/family-link-service";
import {
  LocalEmptyState,
  LocalFamilySafetyShell,
  LocalStatusChip,
} from "../_fs-shell-stub";
import { FAMILY_SAFETY_PALETTE as P } from "@/components/nex-native/family-safety/_palette";

export const dynamic = "force-dynamic";

export default async function FamilySetupPage(): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();

  if (!session) {
    return (
      <LocalFamilySafetyShell
        title="Family Safety · Setup"
        activeNav="setup"
        subtitle="You need a NEX account to use Family Safety."
      >
        <LocalEmptyState
          title="Sign in to continue"
          body="Family Safety is tied to your NEX account. Create or sign in to continue."
          actions={
            <a
              href="/nex-native/create-account"
              style={{
                padding: "10px 16px",
                background: P.orange,
                color: "#1A1300",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Create or sign in
            </a>
          }
        />
      </LocalFamilySafetyShell>
    );
  }

  const [asGuardian, asChild] = await Promise.all([
    listLinksForGuardian(session.account.id),
    listLinksForChild(session.account.id),
  ]);

  const pendingInvitationsToMe = asGuardian
    .filter((l) => l.state === "pending" && l.initiatedBy === "child_invite")
    .concat(
      asChild.filter(
        (l) => l.state === "pending" && l.initiatedBy === "guardian_invite",
      ),
    );
  const pendingInvitationsFromMe = asGuardian
    .filter((l) => l.state === "pending" && l.initiatedBy === "guardian_invite")
    .concat(
      asChild.filter(
        (l) => l.state === "pending" && l.initiatedBy === "child_invite",
      ),
    );
  const activeLinks = asGuardian
    .filter((l) => l.state === "active")
    .concat(asChild.filter((l) => l.state === "active"));

  return (
    <LocalFamilySafetyShell
      title="Family Safety · Setup"
      activeNav="setup"
      subtitle="Create a family link or accept an invitation you've received."
    >
      {activeLinks.length === 0 &&
      pendingInvitationsToMe.length === 0 &&
      pendingInvitationsFromMe.length === 0 ? (
        <LocalEmptyState
          title="No family yet"
          body="You can invite someone to be your family member, or accept an invitation you've received. Family Safety never grants anyone access to your messages or location in this pilot."
          actions={
            <>
              <a
                href="/nex-native/family-safety/invite"
                data-testid="nex-fs-setup-cta-invite"
                style={{
                  padding: "10px 16px",
                  background: P.orange,
                  color: "#1A1300",
                  borderRadius: 10,
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Send an invitation
              </a>
              <a
                href="/nex-native/family-safety/manage"
                data-testid="nex-fs-setup-cta-manage"
                style={{
                  padding: "10px 16px",
                  background: P.surface,
                  color: P.textPrimary,
                  borderRadius: 10,
                  textDecoration: "none",
                  fontWeight: 600,
                  border: `1px solid ${P.divider}`,
                }}
              >
                Manage links
              </a>
            </>
          }
        />
      ) : (
        <>
          {pendingInvitationsToMe.length > 0 && (
            <section
              aria-labelledby="pending-to-me-h2"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: 16,
                background: P.surface,
                border: `1px solid ${P.cyanBorder}`,
                borderRadius: 14,
              }}
            >
              <h2 id="pending-to-me-h2" style={{ margin: 0, fontSize: 16 }}>
                You have invitations waiting
              </h2>
              <p style={{ margin: 0, color: P.textSecondary, fontSize: 14 }}>
                Review each invitation before accepting. You can decline or
                report pressure at any time.
              </p>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {pendingInvitationsToMe.map((l) => (
                  <li key={l.linkId}>
                    <a
                      href={`/nex-native/family-safety/accept/${l.linkId}`}
                      data-testid={`nex-fs-pending-to-me-${l.linkId}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "10px 12px",
                        background: P.surfaceMuted,
                        border: `1px solid ${P.divider}`,
                        borderRadius: 10,
                        color: P.textPrimary,
                        textDecoration: "none",
                      }}
                    >
                      <span>
                        Review invitation ({l.role.replace("_", " ")})
                      </span>
                      <LocalStatusChip tone="pending" label="pending" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {activeLinks.length > 0 && (
            <section
              aria-labelledby="active-h2"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: 16,
                background: P.surface,
                border: `1px solid ${P.familyGreenBorder}`,
                borderRadius: 14,
              }}
            >
              <h2 id="active-h2" style={{ margin: 0, fontSize: 16 }}>
                Your active family links
              </h2>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {activeLinks.map((l) => (
                  <li key={l.linkId}>
                    <a
                      href={`/nex-native/family-safety/link/${l.linkId}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "10px 12px",
                        background: P.surfaceMuted,
                        border: `1px solid ${P.divider}`,
                        borderRadius: 10,
                        color: P.textPrimary,
                        textDecoration: "none",
                      }}
                    >
                      <span>{l.role.replace("_", " ")}</span>
                      <LocalStatusChip tone="active" label="active" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <a
            href="/nex-native/family-safety/invite"
            data-testid="nex-fs-setup-cta-invite"
            style={{
              padding: "10px 16px",
              background: P.orange,
              color: "#1A1300",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 600,
              alignSelf: "flex-start",
            }}
          >
            Send another invitation
          </a>
        </>
      )}
    </LocalFamilySafetyShell>
  );
}
