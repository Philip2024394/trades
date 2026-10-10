"use client";

// src/app/nex-native/family-safety/accept/[linkId]/_accept-client.tsx
//
// Accept panel · accept / decline / report pressure.

import * as React from "react";
import { useRouter } from "next/navigation";
import { FAMILY_SAFETY_PALETTE as P } from "@/components/nex-native/family-safety/_palette";
import {
  confirmInvitationAction,
  issuePressureSignalAction,
  revokeInvitationAction,
} from "@/lib/nex-native/family-links/_server-actions";
import type {
  FamilyLinkInitiatedBy,
  FamilyLinkState,
  FamilyRole,
} from "@/lib/nex-native/family-links/types";
import type { PressureReasonCode } from "@/lib/nex-native/family-links/pressure-signal-service";

export interface AcceptClientLink {
  readonly linkId: string;
  readonly role: FamilyRole;
  readonly state: FamilyLinkState;
  readonly initiatedBy: FamilyLinkInitiatedBy;
  readonly guardianAccountId: string;
  readonly childAccountId: string;
}

export interface AcceptClientProps {
  readonly link: AcceptClientLink;
  readonly viewerAccountId: string;
}

type Phase = "idle" | "working" | "accepted" | "declined" | "reported" | "error";

export function AcceptClient({
  link,
  viewerAccountId,
}: AcceptClientProps): React.JSX.Element {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [pressureOpen, setPressureOpen] = React.useState(false);
  const [pressureReason, setPressureReason] =
    React.useState<PressureReasonCode>("coerced");
  const [pressureNotes, setPressureNotes] = React.useState("");
  const pressureDialogRef = React.useRef<HTMLDivElement>(null);
  const pressureFirstBtnRef = React.useRef<HTMLButtonElement>(null);

  const terminal =
    link.state === "revoked" || link.state === "expired" || link.state === "active";

  React.useEffect(() => {
    if (!pressureOpen) return;
    const t = window.setTimeout(() => pressureFirstBtnRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [pressureOpen]);

  async function handleAccept() {
    setPhase("working");
    setErrorMsg(null);
    const r = await confirmInvitationAction({ linkId: link.linkId });
    if ("ok" in r && r.ok) {
      setPhase("accepted");
      // Return to Manage · the link now shows as active.
      router.refresh();
      return;
    }
    if ("ok" in r && !r.ok) {
      setErrorMsg(r.reason);
    }
    setPhase("error");
  }

  async function handleDecline() {
    setPhase("working");
    setErrorMsg(null);
    const r = await revokeInvitationAction({
      linkId: link.linkId,
      reason: "declined_by_recipient",
    });
    if ("ok" in r && r.ok) {
      setPhase("declined");
      router.refresh();
      return;
    }
    if ("ok" in r && !r.ok) {
      setErrorMsg(r.reason);
    }
    setPhase("error");
  }

  async function handlePressureSubmit() {
    setPhase("working");
    setErrorMsg(null);
    const r = await issuePressureSignalAction({
      linkId: link.linkId,
      reasonCode: pressureReason,
      reasonNotes: pressureNotes.trim() === "" ? undefined : pressureNotes.trim(),
    });
    setPressureOpen(false);
    if ("ok" in r && r.ok) {
      setPhase("reported");
      router.refresh();
      return;
    }
    if ("ok" in r && !r.ok) {
      setErrorMsg(r.reason);
    }
    setPhase("error");
  }

  // Honest terminal state render — accepted/declined/reported/revoked/active.
  if (phase === "accepted") {
    return (
      <SuccessPanel
        testId="nex-fs-accept-accepted"
        title="You accepted the invitation"
        body="The link is now active. Either side can revoke it later."
        href={`/nex-native/family-safety/link/${link.linkId}`}
        hrefLabel="Open link"
      />
    );
  }
  if (phase === "declined") {
    return (
      <SuccessPanel
        testId="nex-fs-accept-declined"
        title="You declined the invitation"
        body="The invitation is closed. Nobody else was told."
        href="/nex-native/family-safety"
        hrefLabel="Back to Family Safety"
        tone="neutral"
      />
    );
  }
  if (phase === "reported") {
    return (
      <SuccessPanel
        testId="nex-fs-accept-reported"
        title="We've marked this invitation and ended it"
        body="A report was sent to NEX Safety Operations. The other party was not told."
        href="/nex-native/family-safety"
        hrefLabel="Back to Family Safety"
        tone="neutral"
      />
    );
  }

  // Review panel.
  const inviterIsGuardian = link.initiatedBy === "guardian_invite";
  const inviterRoleCopy = inviterIsGuardian ? "guardian" : "ward";
  const viewerRoleCopy = inviterIsGuardian ? "ward" : "guardian";

  return (
    <>
      <section
        role="region"
        aria-labelledby="accept-h2"
        data-testid="nex-fs-accept-panel"
        data-nex-fs-link-state={link.state}
        style={{
          padding: 20,
          background: P.surface,
          border: `1px solid ${P.cyanBorder}`,
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h2 id="accept-h2" style={{ margin: 0, fontSize: 18 }}>
          Review this invitation
        </h2>
        <p style={{ margin: 0, color: P.textSecondary, lineHeight: 1.5 }}>
          This person is asking to be your {inviterRoleCopy}. You would be
          their {viewerRoleCopy} on this link. The role is{" "}
          <strong>{link.role.replace("_", " ")}</strong>. No permissions grant
          access to your messages or location in this pilot.
        </p>
        {terminal && (
          <div
            role="alert"
            data-testid="nex-fs-accept-terminal"
            style={{
              padding: 12,
              background: P.surfaceMuted,
              border: `1px solid ${P.divider}`,
              borderRadius: 10,
              color: P.textSecondary,
            }}
          >
            This invitation has already been handled (state: {link.state}).
          </div>
        )}
        {!terminal && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void handleAccept()}
              disabled={phase === "working"}
              data-testid="nex-fs-accept-accept"
              style={primaryBtn(phase === "working", P.familyGreen, "#02200F")}
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => void handleDecline()}
              disabled={phase === "working"}
              data-testid="nex-fs-accept-decline"
              style={{
                padding: "10px 16px",
                background: P.surfaceHi,
                color: P.textPrimary,
                borderRadius: 10,
                border: `1px solid ${P.divider}`,
                fontWeight: 600,
                cursor: phase === "working" ? "not-allowed" : "pointer",
                opacity: phase === "working" ? 0.7 : 1,
              }}
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => setPressureOpen(true)}
              disabled={phase === "working"}
              data-testid="nex-fs-accept-pressure"
              style={{
                padding: "10px 16px",
                background: "transparent",
                color: P.emergency,
                borderRadius: 10,
                border: `1px solid ${P.emergencyBorder}`,
                fontWeight: 600,
                cursor: phase === "working" ? "not-allowed" : "pointer",
                opacity: phase === "working" ? 0.7 : 1,
                marginLeft: "auto",
              }}
            >
              I feel pressured
            </button>
          </div>
        )}
        {phase === "error" && (
          <div
            role="alert"
            data-testid="nex-fs-accept-error"
            data-nex-fs-accept-error-reason={errorMsg ?? "unknown"}
            style={{
              padding: 12,
              background: P.surfaceMuted,
              border: `1px solid ${P.emergencyBorder}`,
              borderRadius: 10,
              color: P.emergency,
            }}
          >
            {mapError(errorMsg ?? "unknown")}
          </div>
        )}
      </section>

      {pressureOpen && (
        <div
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPressureOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            ref={pressureDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pressure-h2"
            data-testid="nex-fs-accept-pressure-dialog"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setPressureOpen(false);
              }
            }}
            style={{
              width: "100%",
              maxWidth: 460,
              padding: 20,
              background: P.surface,
              border: `1px solid ${P.emergencyBorder}`,
              borderRadius: 14,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              color: P.textPrimary,
            }}
          >
            <h2 id="pressure-h2" style={{ margin: 0, fontSize: 18 }}>
              Report pressure
            </h2>
            <p style={{ margin: 0, color: P.textSecondary, lineHeight: 1.5 }}>
              Filing this signal ends this invitation and sends an opaque case
              to NEX Safety Operations. The other party will not be told.
            </p>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, color: P.textSecondary }}>
                Reason
              </span>
              <select
                value={pressureReason}
                onChange={(e) =>
                  setPressureReason(e.target.value as PressureReasonCode)
                }
                data-testid="nex-fs-accept-pressure-reason"
                style={{
                  padding: "10px 12px",
                  background: P.surfaceMuted,
                  border: `1px solid ${P.divider}`,
                  borderRadius: 10,
                  color: P.textPrimary,
                }}
              >
                <option value="coerced">I was coerced to accept</option>
                <option value="threatened">I feel threatened</option>
                <option value="unknown_inviter">I don't know this person</option>
                <option value="not_my_family">
                  They're pretending to be family
                </option>
                <option value="other">Something else</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, color: P.textSecondary }}>
                Optional notes (max 500 chars)
              </span>
              <textarea
                value={pressureNotes}
                onChange={(e) => setPressureNotes(e.target.value.slice(0, 500))}
                data-testid="nex-fs-accept-pressure-notes"
                maxLength={500}
                rows={3}
                style={{
                  padding: "10px 12px",
                  background: P.surfaceMuted,
                  border: `1px solid ${P.divider}`,
                  borderRadius: 10,
                  color: P.textPrimary,
                  resize: "vertical",
                }}
              />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                ref={pressureFirstBtnRef}
                onClick={() => void handlePressureSubmit()}
                data-testid="nex-fs-accept-pressure-submit"
                style={primaryBtn(false, P.emergency, "#FFF")}
              >
                Send report
              </button>
              <button
                type="button"
                onClick={() => setPressureOpen(false)}
                style={{
                  padding: "10px 16px",
                  background: "transparent",
                  color: P.textPrimary,
                  borderRadius: 10,
                  border: `1px solid ${P.divider}`,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SuccessPanel({
  testId,
  title,
  body,
  href,
  hrefLabel,
  tone = "success",
}: {
  readonly testId: string;
  readonly title: string;
  readonly body: string;
  readonly href: string;
  readonly hrefLabel: string;
  readonly tone?: "success" | "neutral";
}): React.JSX.Element {
  const border = tone === "success" ? P.familyGreenBorder : P.divider;
  const btnBg = tone === "success" ? P.familyGreen : P.surfaceHi;
  const btnFg = tone === "success" ? "#02200F" : P.textPrimary;
  return (
    <section
      role="region"
      aria-labelledby={`${testId}-h2`}
      data-testid={testId}
      style={{
        padding: 20,
        background: P.surface,
        border: `1px solid ${border}`,
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <h2 id={`${testId}-h2`} style={{ margin: 0, fontSize: 18 }}>
        {title}
      </h2>
      <p style={{ margin: 0, color: P.textSecondary, lineHeight: 1.5 }}>
        {body}
      </p>
      <a
        href={href}
        style={{
          padding: "10px 16px",
          background: btnBg,
          color: btnFg,
          borderRadius: 10,
          fontWeight: 600,
          textDecoration: "none",
          alignSelf: "flex-start",
        }}
      >
        {hrefLabel}
      </a>
    </section>
  );
}

function primaryBtn(
  disabled: boolean,
  bg: string,
  fg: string,
): React.CSSProperties {
  return {
    padding: "10px 16px",
    background: disabled ? P.divider : bg,
    color: disabled ? P.textDim : fg,
    borderRadius: 10,
    border: "none",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
  };
}

function mapError(reason: string): string {
  switch (reason) {
    case "wrong_confirming_party":
      return "This invitation is not for you.";
    case "already_confirmed":
      return "This invitation was already accepted.";
    case "already_revoked":
      return "This invitation was already closed.";
    case "link_not_found":
      return "This invitation no longer exists.";
    case "db_unavailable":
      return "Family Links is temporarily unavailable. Try again shortly.";
    default:
      return "Something went wrong. Please try again.";
  }
}
