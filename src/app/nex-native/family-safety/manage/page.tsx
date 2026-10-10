// src/app/nex-native/family-safety/manage/page.tsx
//
// Family Safety · manage · list all my family links (pending, active,
// recently revoked). Server shell renders honest state.

import * as React from "react";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  listLinksForChild,
  listLinksForGuardian,
} from "@/lib/nex-native/family-links/family-link-service";
import type { FamilyLinkRow } from "@/lib/nex-native/family-links/types";
import {
  LocalEmptyState,
  LocalFamilySafetyShell,
  LocalStatusChip,
} from "../_fs-shell-stub";
import { FAMILY_SAFETY_PALETTE as P } from "@/components/nex-native/family-safety/_palette";

export const dynamic = "force-dynamic";

export default async function FamilyManagePage(): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return (
      <LocalFamilySafetyShell title="Family Safety · Manage" activeNav="dashboard">
        <LocalEmptyState
          title="Sign in to continue"
          body="Family Safety is tied to your NEX account."
        />
      </LocalFamilySafetyShell>
    );
  }

  let asGuardian: readonly FamilyLinkRow[] = [];
  let asChild: readonly FamilyLinkRow[] = [];
  let dbUnavailable = false;
  try {
    [asGuardian, asChild] = await Promise.all([
      listLinksForGuardian(session.account.id),
      listLinksForChild(session.account.id),
    ]);
  } catch {
    dbUnavailable = true;
  }

  if (dbUnavailable) {
    return (
      <LocalFamilySafetyShell title="Family Safety · Manage" activeNav="dashboard">
        <LocalEmptyState
          title="Family Links is temporarily unavailable"
          body="Try again shortly."
        />
      </LocalFamilySafetyShell>
    );
  }

  const all = [
    ...asGuardian.map((l) => ({
      link: l,
      viewerIsGuardianSide: true,
    })),
    ...asChild.map((l) => ({
      link: l,
      viewerIsGuardianSide: false,
    })),
  ];

  const pending = all.filter((e) => e.link.state === "pending");
  const active = all.filter((e) => e.link.state === "active");
  const terminal = all.filter(
    (e) => e.link.state === "revoked" || e.link.state === "expired",
  );

  return (
    <LocalFamilySafetyShell
      title="Manage guardian partners"
      activeNav="dashboard"
      subtitle="Guardian-to-guardian links. To manage child accounts under 16, use Custody."
    >
      <div
        role="status"
        data-nex-family-safety-manage-disambiguation="true"
        data-testid="nex-fs-manage-disambiguation"
        style={{
          padding: "10px 12px",
          background: P.cyanMuted,
          border: `1px solid ${P.cyanBorder}`,
          borderRadius: 10,
          color: P.textPrimary,
          fontSize: 13,
          lineHeight: 1.5,
          marginBottom: 12,
        }}
      >
        <strong>Guardian-to-guardian links only.</strong> Child accounts under
        16 you created live under{" "}
        <a
          href="/nex-native/family-safety/custody"
          style={{ color: P.cyan }}
        >
          Custody
        </a>
        .
      </div>
      {all.length === 0 ? (
        <LocalEmptyState
          title="No guardian partners yet"
          body="To add a secondary guardian, send a guardian-to-guardian invitation. To create a NEX account for a child under 16, use Create a child account."
          actions={
            <a
              href="/nex-native/family-safety/invite"
              style={{
                padding: "10px 16px",
                background: P.orange,
                color: "#1A1300",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Invite a secondary guardian
            </a>
          }
        />
      ) : (
        <>
          <LinkGroup
            testId="nex-fs-manage-pending"
            title="Pending"
            tone="pending"
            entries={pending}
          />
          <LinkGroup
            testId="nex-fs-manage-active"
            title="Active"
            tone="active"
            entries={active}
          />
          <LinkGroup
            testId="nex-fs-manage-terminal"
            title="Recently closed"
            tone="revoked"
            entries={terminal}
          />
        </>
      )}
    </LocalFamilySafetyShell>
  );
}

function LinkGroup({
  testId,
  title,
  tone,
  entries,
}: {
  readonly testId: string;
  readonly title: string;
  readonly tone: "pending" | "active" | "revoked";
  readonly entries: readonly {
    link: FamilyLinkRow;
    viewerIsGuardianSide: boolean;
  }[];
}): React.JSX.Element | null {
  if (entries.length === 0) return null;
  return (
    <section
      data-testid={testId}
      style={{
        padding: 16,
        background: P.surface,
        border: `1px solid ${P.divider}`,
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
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
        {entries.map(({ link, viewerIsGuardianSide }) => {
          const requiresAction =
            link.state === "pending" &&
            ((link.initiatedBy === "guardian_invite" &&
              !viewerIsGuardianSide) ||
              (link.initiatedBy === "child_invite" && viewerIsGuardianSide));
          const href = requiresAction
            ? `/nex-native/family-safety/accept/${link.linkId}`
            : `/nex-native/family-safety/link/${link.linkId}`;
          return (
            <li key={link.linkId}>
              <a
                href={href}
                data-nex-fs-manage-row={link.linkId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
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
                  {link.role.replace("_", " ")} ·{" "}
                  {viewerIsGuardianSide ? "you are the guardian" : "you are the ward"}
                </span>
                <LocalStatusChip tone={tone} label={link.state} />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
