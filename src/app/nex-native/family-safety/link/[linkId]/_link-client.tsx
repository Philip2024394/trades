"use client";

// src/app/nex-native/family-safety/link/[linkId]/_link-client.tsx

import * as React from "react";
import { useRouter } from "next/navigation";
import { FAMILY_SAFETY_PALETTE as P } from "@/components/nex-native/family-safety/_palette";
import { LocalStatusChip } from "../../_fs-shell-stub";
import {
  cancelCooldownAction,
  confirmCooldownBypassAction,
  issuePressureSignalAction,
  revokeInvitationAction,
} from "@/lib/nex-native/family-links/_server-actions";
import type {
  FamilyLinkInitiatedBy,
  FamilyLinkState,
  FamilyRole,
} from "@/lib/nex-native/family-links/types";
import type { RevocationCooldownRow } from "@/lib/nex-native/family-links/cooldown-service";
import type { PressureReasonCode } from "@/lib/nex-native/family-links/pressure-signal-service";

export interface LinkDetailClientLink {
  readonly linkId: string;
  readonly role: FamilyRole;
  readonly state: FamilyLinkState;
  readonly initiatedBy: FamilyLinkInitiatedBy;
  readonly initiatedAt: string;
  readonly confirmedAt: string | null;
  readonly revokedAt: string | null;
  readonly revokedReason: string | null;
  readonly canSeeEmergencyAlerts: boolean;
  readonly canSeeSafetySummaries: boolean;
  readonly canSeeLocationWhenShared: boolean;
  readonly guardianAccountId: string;
  readonly childAccountId: string;
}

export interface LinkDetailClientProps {
  readonly link: LinkDetailClientLink;
  readonly cooldown: RevocationCooldownRow | null;
  readonly viewerAccountId: string;
  readonly viewerIsGuardianSide: boolean;
}

type Phase = "idle" | "working" | "error" | "revoked" | "cooldown_started";

export function LinkDetailClient({
  link,
  cooldown,
  viewerAccountId,
  viewerIsGuardianSide,
}: LinkDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [pressureOpen, setPressureOpen] = React.useState(false);
  const [pressureReason, setPressureReason] =
    React.useState<PressureReasonCode>("coerced");
  const [pressureNotes, setPressureNotes] = React.useState("");

  const [countdown, setCountdown] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!cooldown || cooldown.state !== "pending") {
      setCountdown(null);
      return;
    }
    const effective = Date.parse(cooldown.effectiveAt);
    const tick = () => {
      const remaining = effective - Date.now();
      if (remaining <= 0) {
        setCountdown("Cooldown elapsed · sweep job will finalise");
        return;
      }
      const h = Math.floor(remaining / 3_600_000);
      const m = Math.floor((remaining % 3_600_000) / 60_000);
      setCountdown(`${h}h ${m}m remaining`);
    };
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  async function handleRevoke() {
    setPhase("working");
    setErrorMsg(null);
    const r = await revokeInvitationAction({
      linkId: link.linkId,
      reason: "user_initiated",
    });
    if ("ok" in r && r.ok) {
      if (r.kind === "immediate_revoke") {
        setPhase("revoked");
      } else {
        setPhase("cooldown_started");
      }
      router.refresh();
      return;
    }
    if ("ok" in r && !r.ok) {
      setErrorMsg(r.reason);
    }
    setPhase("error");
  }

  async function handleBypass() {
    if (!cooldown) return;
    setPhase("working");
    const r = await confirmCooldownBypassAction({
      cooldownId: cooldown.cooldownId,
    });
    if ("ok" in r && r.ok) {
      setPhase("revoked");
      router.refresh();
      return;
    }
    if ("ok" in r && !r.ok) {
      setErrorMsg(r.reason);
    }
    setPhase("error");
  }

  async function handleCancelCooldown() {
    if (!cooldown) return;
    setPhase("working");
    const r = await cancelCooldownAction({
      cooldownId: cooldown.cooldownId,
    });
    if ("ok" in r && r.ok) {
      setPhase("idle");
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
    const r = await issuePressureSignalAction({
      linkId: link.linkId,
      reasonCode: pressureReason,
      reasonNotes: pressureNotes.trim() === "" ? undefined : pressureNotes.trim(),
    });
    setPressureOpen(false);
    if ("ok" in r && r.ok) {
      setPhase("idle");
      router.refresh();
      return;
    }
    if ("ok" in r && !r.ok) {
      setErrorMsg(r.reason);
    }
    setPhase("error");
  }

  const stateToTone = (): "pending" | "active" | "revoked" | "expired" => {
    switch (link.state) {
      case "pending":
        return "pending";
      case "active":
        return "active";
      case "revoked":
        return "revoked";
      default:
        return "expired";
    }
  };

  const canRevoke = link.state === "pending" || link.state === "active";
  const canBypass =
    cooldown !== null &&
    cooldown.state === "pending" &&
    cooldown.initiatedByAccountId !== viewerAccountId;
  const canCancelCooldown =
    cooldown !== null &&
    cooldown.state === "pending" &&
    cooldown.initiatedByAccountId === viewerAccountId;

  return (
    <>
      <section
        role="region"
        aria-labelledby="link-detail-h2"
        data-testid="nex-fs-link-detail"
        data-nex-fs-link-state={link.state}
        style={{
          padding: 20,
          background: P.surface,
          border: `1px solid ${P.divider}`,
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          gap: 14,
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
          <h2 id="link-detail-h2" style={{ margin: 0, fontSize: 18 }}>
            Family link detail
          </h2>
          <LocalStatusChip tone={stateToTone()} label={link.state} />
          {cooldown && cooldown.state === "pending" && (
            <LocalStatusChip
              tone="suspended"
              label={`Revocation pending · ${countdown ?? ""}`}
              testId="nex-fs-link-cooldown-chip"
            />
          )}
        </div>

        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: 8,
            margin: 0,
            padding: 12,
            background: P.surfaceMuted,
            borderRadius: 10,
          }}
        >
          <dt style={{ color: P.textSecondary }}>Role:</dt>
          <dd style={{ margin: 0 }}>{link.role.replace("_", " ")}</dd>
          <dt style={{ color: P.textSecondary }}>Your side:</dt>
          <dd style={{ margin: 0 }}>
            {viewerIsGuardianSide ? "guardian" : "ward"}
          </dd>
          <dt style={{ color: P.textSecondary }}>Started:</dt>
          <dd style={{ margin: 0 }}>{link.initiatedAt}</dd>
          {link.confirmedAt && (
            <>
              <dt style={{ color: P.textSecondary }}>Confirmed:</dt>
              <dd style={{ margin: 0 }}>{link.confirmedAt}</dd>
            </>
          )}
          {link.revokedAt && (
            <>
              <dt style={{ color: P.textSecondary }}>Revoked:</dt>
              <dd style={{ margin: 0 }}>{link.revokedAt}</dd>
              <dt style={{ color: P.textSecondary }}>Reason:</dt>
              <dd style={{ margin: 0 }}>{link.revokedReason ?? "—"}</dd>
            </>
          )}
        </dl>

        <section
          aria-label="Permissions"
          data-testid="nex-fs-link-permissions"
          style={{
            padding: 12,
            background: P.surfaceMuted,
            border: `1px solid ${P.divider}`,
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <strong style={{ color: P.textPrimary }}>
            Permissions (read-only · default-closed)
          </strong>
          <PermissionRow
            label="Can see emergency alerts"
            value={link.canSeeEmergencyAlerts}
          />
          <PermissionRow
            label="Can see safety summaries"
            value={link.canSeeSafetySummaries}
          />
          <PermissionRow
            label="Can see location when shared"
            value={link.canSeeLocationWhenShared}
          />
          <p style={{ margin: 0, color: P.textSecondary, fontSize: 12 }}>
            Permission changes require both parties to agree. This feature is
            not available yet.
          </p>
        </section>

        {phase === "revoked" && (
          <div
            role="status"
            data-testid="nex-fs-link-revoked-ok"
            style={{
              padding: 12,
              background: P.surfaceMuted,
              border: `1px solid ${P.emergencyBorder}`,
              borderRadius: 10,
              color: P.emergency,
            }}
          >
            This link is revoked.
          </div>
        )}
        {phase === "cooldown_started" && (
          <div
            role="status"
            data-testid="nex-fs-link-cooldown-started"
            style={{
              padding: 12,
              background: P.surfaceMuted,
              border: `1px solid ${P.cyanBorder}`,
              borderRadius: 10,
              color: P.textPrimary,
            }}
          >
            Revocation started. 72-hour cooldown is now running. Either party
            can confirm to bypass, or the initiator can cancel.
          </div>
        )}
        {phase === "error" && errorMsg && (
          <div
            role="alert"
            data-testid="nex-fs-link-error"
            data-nex-fs-link-error-reason={errorMsg}
            style={{
              padding: 12,
              background: P.surfaceMuted,
              border: `1px solid ${P.emergencyBorder}`,
              borderRadius: 10,
              color: P.emergency,
            }}
          >
            {mapError(errorMsg)}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canRevoke && (
            <button
              type="button"
              onClick={() => void handleRevoke()}
              disabled={phase === "working"}
              data-testid="nex-fs-link-revoke"
              style={{
                padding: "10px 16px",
                background: P.surfaceHi,
                color: P.emergency,
                borderRadius: 10,
                border: `1px solid ${P.emergencyBorder}`,
                fontWeight: 600,
                cursor: phase === "working" ? "not-allowed" : "pointer",
                opacity: phase === "working" ? 0.7 : 1,
              }}
            >
              Revoke
            </button>
          )}
          {canBypass && (
            <button
              type="button"
              onClick={() => void handleBypass()}
              disabled={phase === "working"}
              data-testid="nex-fs-link-bypass"
              style={{
                padding: "10px 16px",
                background: P.cyan,
                color: "#01121D",
                borderRadius: 10,
                border: "none",
                fontWeight: 600,
                cursor: phase === "working" ? "not-allowed" : "pointer",
                opacity: phase === "working" ? 0.7 : 1,
              }}
            >
              Confirm · bypass cooldown
            </button>
          )}
          {canCancelCooldown && (
            <button
              type="button"
              onClick={() => void handleCancelCooldown()}
              disabled={phase === "working"}
              data-testid="nex-fs-link-cancel-cooldown"
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
              Cancel revocation
            </button>
          )}
          {canRevoke && (
            <button
              type="button"
              onClick={() => setPressureOpen(true)}
              data-testid="nex-fs-link-pressure"
              style={{
                padding: "10px 16px",
                background: "transparent",
                color: P.emergency,
                borderRadius: 10,
                border: `1px solid ${P.emergencyBorder}`,
                fontWeight: 600,
                cursor: "pointer",
                marginLeft: "auto",
              }}
            >
              Report pressure
            </button>
          )}
        </div>
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="link-pressure-h2"
            data-testid="nex-fs-link-pressure-dialog"
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
            <h2 id="link-pressure-h2" style={{ margin: 0, fontSize: 18 }}>
              Report pressure
            </h2>
            <p style={{ margin: 0, color: P.textSecondary, lineHeight: 1.5 }}>
              Opens an opaque case with NEX Safety Operations. The other party
              is not notified. On a pending link this also ends the invitation.
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
                data-testid="nex-fs-link-pressure-reason"
                style={{
                  padding: "10px 12px",
                  background: P.surfaceMuted,
                  border: `1px solid ${P.divider}`,
                  borderRadius: 10,
                  color: P.textPrimary,
                }}
              >
                <option value="coerced">I was coerced</option>
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
                Optional notes
              </span>
              <textarea
                value={pressureNotes}
                onChange={(e) => setPressureNotes(e.target.value.slice(0, 500))}
                data-testid="nex-fs-link-pressure-notes"
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
                onClick={() => void handlePressureSubmit()}
                data-testid="nex-fs-link-pressure-submit"
                style={{
                  padding: "10px 16px",
                  background: P.emergency,
                  color: "#FFF",
                  borderRadius: 10,
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
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

function PermissionRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: boolean;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "4px 0",
        color: P.textSecondary,
      }}
    >
      <span>{label}</span>
      <LocalStatusChip
        tone={value ? "active" : "neutral"}
        label={value ? "on" : "off"}
      />
    </div>
  );
}

function mapError(reason: string): string {
  switch (reason) {
    case "unauthorized_actor":
      return "You are not permitted to perform this action.";
    case "already_revoked":
      return "This link is already revoked.";
    case "cooldown_already_pending":
      return "A revocation is already in progress for this link.";
    case "link_not_found":
      return "This link no longer exists.";
    case "db_unavailable":
      return "Family Links is temporarily unavailable. Try again shortly.";
    default:
      return "Something went wrong. Please try again.";
  }
}
