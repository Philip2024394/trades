// src/components/nex-native/emergency/IncidentAlertCard.tsx
//
// Responder-facing alert card · sealed 2026-10-10.
// -------------------------------------------------
// This card is the single screen a responder sees in v1. In later
// phases it will embed inside the chat timeline · for v1 it stands
// alone at `/nex-native/emergency-help/incident/[id]`. The two
// primary actions are:
//   · "I'm on my way" → ETA picker → acceptIncidentAction
//   · "Can't help"    → declineIncidentAction (no shame)
//
// Load-bearing anti-patterns:
//   · Do NOT auto-accept on open · the responder must consciously tap.
//   · Do NOT hide the safety reminder before acceptance.
//   · Do NOT leak explicit decline reasons back to the requester.

"use client";

import * as React from "react";
import { EMERGENCY_PALETTE } from "./_palette";
import { SimulatedBadge } from "./SimulatedBadge";
import { ReportToPolicePanel } from "./ReportToPolicePanel";
import type {
  EmergencyIncident,
  IncidentRecipient,
  ResponseStatus,
} from "./types";

// ---------------------------------------------------------------------
// Temporary type shim (L2 · 2026-10-10)
// ---------------------------------------------------------------------
// L1's sealed F4 contract at `@/lib/nex-native/emergency/types` already
// extends `IncidentState` with "pending_confirmation" and
// "revoked_within_window", but the UI component layer still imports
// from the parallel local `./types` copy (which flags itself as a
// transient scaffold to be deleted "once F4 is on disk"). Until the UI
// swaps its imports to the sealed F4 types.ts, we widen the local
// state union here so this file can speak the new state names honestly.
// DELETE this shim when the components-level `./types` carries the full
// union (or when imports swap to `@/lib/nex-native/emergency/types`).
type ExtendedIncidentState =
  | EmergencyIncident["state"]
  | "pending_confirmation"
  | "revoked_within_window";

function extState(s: EmergencyIncident["state"]): ExtendedIncidentState {
  return s as ExtendedIncidentState;
}

const PENDING_CONFIRMATION_WINDOW_MS = 10_000;

export interface IncidentAlertCardProps {
  incident: EmergencyIncident;
  myRecipient: IncidentRecipient;
  services: {
    accept: (
      incidentId: string,
      etaMinutes: number,
    ) => Promise<{ incidentId: string; status: ResponseStatus; etaMinutes: number }>;
    decline: (
      incidentId: string,
    ) => Promise<{ incidentId: string; status: ResponseStatus }>;
    withdraw: (
      incidentId: string,
    ) => Promise<{ incidentId: string; status: ResponseStatus }>;
  };
  /** Optional override of the ETA options. Default [3, 5, 10, 15]. */
  etaOptions?: readonly number[];
  /** Simulated flag · defaults to true. */
  simulated?: boolean;
  /** Requester display name · optional (defaults to opaque label). */
  requesterLabel?: string;
  /**
   * Requester country code (ISO 3166-1 alpha-2) · drives the local
   * emergency-number lookup inside the Report-to-Police panel. v1
   * passes the requester-side value; later phases may switch to the
   * responder's locale. Null → international 112 fallback.
   */
  requesterCountryCode?: string | null;
}

export function IncidentAlertCard({
  incident,
  myRecipient,
  services,
  etaOptions = [3, 5, 10, 15],
  simulated = true,
  requesterLabel,
  requesterCountryCode = null,
}: IncidentAlertCardProps): React.JSX.Element {
  const [phase, setPhase] = React.useState<
    "idle" | "picking-eta" | "submitting"
  >("idle");
  const [status, setStatus] = React.useState<ResponseStatus>(
    myRecipient.responseStatus,
  );
  const [etaMinutes, setEtaMinutes] = React.useState<number | null>(
    myRecipient.etaMinutes,
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [policePanelOpen, setPolicePanelOpen] = React.useState<boolean>(false);

  const handleAccept = React.useCallback(
    async (eta: number) => {
      setPhase("submitting");
      setErrorMessage(null);
      try {
        const result = await services.accept(incident.incidentId, eta);
        setStatus(result.status);
        setEtaMinutes(result.etaMinutes);
        setPhase("idle");
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Could not record acceptance.",
        );
        setPhase("picking-eta");
      }
    },
    [services, incident.incidentId],
  );

  const handleDecline = React.useCallback(async () => {
    setPhase("submitting");
    setErrorMessage(null);
    try {
      const result = await services.decline(incident.incidentId);
      setStatus(result.status);
      setPhase("idle");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not record decline.",
      );
      setPhase("idle");
    }
  }, [services, incident.incidentId]);

  const handleWithdraw = React.useCallback(async () => {
    setPhase("submitting");
    setErrorMessage(null);
    try {
      const result = await services.withdraw(incident.incidentId);
      setStatus(result.status);
      setEtaMinutes(null);
      setPhase("idle");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not withdraw acceptance.",
      );
      setPhase("idle");
    }
  }, [services, incident.incidentId]);

  const currentState = extState(incident.state);
  const isPendingConfirmation = currentState === "pending_confirmation";
  const isRevokedWithinWindow = currentState === "revoked_within_window";
  const terminal =
    incident.state === "resolved" ||
    incident.state === "cancelled" ||
    incident.state === "expired" ||
    isRevokedWithinWindow;

  // Pending-confirmation countdown · updates once per second so the
  // responder sees the window close in real time. Clock bound to
  // incident.createdAt + 10s · never fabricates seconds past zero.
  const createdAtMs = React.useMemo(() => {
    const t = Date.parse(incident.createdAt);
    return Number.isNaN(t) ? Date.now() : t;
  }, [incident.createdAt]);
  const [nowMs, setNowMs] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    if (!isPendingConfirmation) return;
    const tick = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(tick);
  }, [isPendingConfirmation]);
  const pendingRemainingSec = Math.max(
    0,
    Math.ceil(
      (createdAtMs + PENDING_CONFIRMATION_WINDOW_MS - nowMs) / 1000,
    ),
  );

  return (
    <article
      data-testid="nex-emergency-incident-alert"
      data-nex-emergency-incident-id={incident.incidentId}
      style={{
        background: EMERGENCY_PALETTE.surface,
        border: `2px solid ${EMERGENCY_PALETTE.emergency}`,
        borderRadius: 14,
        padding: "18px",
        color: EMERGENCY_PALETTE.textPrimary,
        boxShadow: "0 10px 24px rgba(220,38,38,0.22)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <SimulatedBadge live={!simulated} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: EMERGENCY_PALETTE.textDim,
          }}
        >
          {incident.state}
        </span>
      </div>

      <h2
        style={{
          margin: "14px 0 4px",
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: "0.03em",
          color: EMERGENCY_PALETTE.emergency,
        }}
      >
        EMERGENCY — HELP NEEDED
      </h2>

      <div
        style={{
          marginTop: 6,
          fontSize: 14,
          color: EMERGENCY_PALETTE.textPrimary,
        }}
      >
        <strong>{requesterLabel ?? "A nearby NEX member"}</strong>
        {myRecipient.distanceMeters != null ? (
          <>
            {" "}·{" "}
            <span style={{ color: EMERGENCY_PALETTE.cyan }}>
              {Math.round(myRecipient.distanceMeters)} m away
            </span>
          </>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          color: EMERGENCY_PALETTE.textDim,
        }}
      >
        Location shared · Alert sent {relativeTime(incident.activatedAt ?? incident.createdAt)}
      </div>

      <section
        aria-label="location directions"
        style={{
          marginTop: 14,
          padding: 12,
          background: EMERGENCY_PALETTE.surfaceMuted,
          border: `1px solid ${EMERGENCY_PALETTE.divider}`,
          borderRadius: 10,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: EMERGENCY_PALETTE.textDim,
          }}
        >
          Location &amp; directions
        </div>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 12.5,
            color: EMERGENCY_PALETTE.textSecondary,
            lineHeight: 1.5,
          }}
        >
          Open the shared location to view the route and the reported
          position. A map embed is not available in this pilot build.
        </p>
      </section>

      {isPendingConfirmation ? (
        <div
          data-testid="nex-emergency-pending-banner"
          data-nex-emergency-pending-remaining-sec={String(pendingRemainingSec)}
          role="status"
          aria-live="polite"
          style={{
            marginTop: 14,
            padding: "12px 14px",
            background: EMERGENCY_PALETTE.cyanMuted,
            border: `2px solid ${EMERGENCY_PALETTE.cyan}`,
            borderRadius: 12,
            color: EMERGENCY_PALETTE.textPrimary,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: EMERGENCY_PALETTE.cyan,
              letterSpacing: "0.02em",
            }}
          >
            ⏳ Alert in 10-second safety confirmation window
          </div>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 12.5,
              color: EMERGENCY_PALETTE.textSecondary,
              lineHeight: 1.5,
            }}
          >
            This alert is in a 10-second safety confirmation window. Please
            WAIT until it is confirmed. The person who raised this alert can
            cancel it within 10 seconds.
          </p>
          <div
            data-testid="nex-emergency-pending-countdown"
            style={{
              marginTop: 8,
              fontSize: 12,
              fontWeight: 700,
              color: EMERGENCY_PALETTE.cyan,
              letterSpacing: "0.08em",
            }}
          >
            {pendingRemainingSec > 0
              ? `${pendingRemainingSec}s remaining`
              : "Confirming…"}
          </div>
        </div>
      ) : null}

      {isRevokedWithinWindow ? (
        <div
          data-testid="nex-emergency-revoked-banner"
          role="status"
          style={{
            marginTop: 14,
            padding: "12px 14px",
            background: EMERGENCY_PALETTE.surfaceMuted,
            border: `1px solid ${EMERGENCY_PALETTE.divider}`,
            borderRadius: 12,
            color: EMERGENCY_PALETTE.textSecondary,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          This alert was cancelled by the requester within the 10-second
          safety window. No action is required.
        </div>
      ) : null}

      {isPendingConfirmation ? (
        <>
          <p
            data-testid="nex-emergency-safety-reminder"
            style={{
              marginTop: 14,
              padding: "10px 12px",
              background: EMERGENCY_PALETTE.cyanMuted,
              border: `1px solid rgba(0,175,255,0.35)`,
              borderRadius: 10,
              fontSize: 12.5,
              color: EMERGENCY_PALETTE.textPrimary,
              lineHeight: 1.5,
            }}
          >
            Help only if it is safe. Your location will be shared with
            the person who requested help for the duration of this
            emergency.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button
              type="button"
              data-testid="nex-emergency-accept"
              data-testid-pending="nex-emergency-accept-disabled"
              data-nex-emergency-accept-disabled-reason="pending_confirmation"
              aria-disabled="true"
              disabled
              onClick={(e) => e.preventDefault()}
              style={{
                ...primaryButtonStyle,
                opacity: 0.55,
                cursor: "not-allowed",
              }}
            >
              I&apos;m on my way
            </button>
            <button
              type="button"
              data-testid="nex-emergency-decline"
              data-nex-emergency-decline-disabled-reason="pending_confirmation"
              aria-disabled="true"
              disabled
              onClick={(e) => e.preventDefault()}
              style={{
                ...ghostButtonStyle,
                opacity: 0.55,
                cursor: "not-allowed",
              }}
            >
              Can&apos;t help
            </button>
          </div>
        </>
      ) : null}

      {status === "pending" && !terminal && !isPendingConfirmation ? (
        <>
          <p
            data-testid="nex-emergency-safety-reminder"
            style={{
              marginTop: 14,
              padding: "10px 12px",
              background: EMERGENCY_PALETTE.cyanMuted,
              border: `1px solid rgba(0,175,255,0.35)`,
              borderRadius: 10,
              fontSize: 12.5,
              color: EMERGENCY_PALETTE.textPrimary,
              lineHeight: 1.5,
            }}
          >
            Help only if it is safe. Your location will be shared with
            the person who requested help for the duration of this
            emergency.
          </p>

          {phase !== "picking-eta" ? (
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                data-testid="nex-emergency-accept"
                onClick={() => setPhase("picking-eta")}
                style={primaryButtonStyle}
              >
                I&apos;m on my way
              </button>
              <button
                type="button"
                data-testid="nex-emergency-decline"
                onClick={handleDecline}
                style={ghostButtonStyle}
              >
                Can&apos;t help
              </button>
            </div>
          ) : (
            <div
              data-testid="nex-emergency-eta-picker"
              style={{
                marginTop: 14,
                padding: 12,
                background: EMERGENCY_PALETTE.surfaceMuted,
                border: `1px solid ${EMERGENCY_PALETTE.divider}`,
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: EMERGENCY_PALETTE.textDim,
                }}
              >
                How many minutes away?
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 10,
                  flexWrap: "wrap",
                }}
              >
                {etaOptions.map((eta) => (
                  <button
                    key={eta}
                    type="button"
                    data-testid={`nex-emergency-eta-${eta}`}
                    onClick={() => handleAccept(eta)}
                    style={{
                      padding: "10px 14px",
                      background: EMERGENCY_PALETTE.emergency,
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: 999,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {eta} min
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPhase("idle")}
                style={{
                  marginTop: 10,
                  background: "transparent",
                  border: "none",
                  color: EMERGENCY_PALETTE.textDim,
                  fontSize: 12,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Back
              </button>
            </div>
          )}
        </>
      ) : null}

      {status === "accepted" && !terminal ? (
        <div
          data-testid="nex-emergency-accepted-state"
          style={{
            marginTop: 16,
            padding: 12,
            background: EMERGENCY_PALETTE.cyanMuted,
            border: `1px solid rgba(0,175,255,0.4)`,
            borderRadius: 10,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: EMERGENCY_PALETTE.cyan,
            }}
          >
            You accepted · ETA {etaMinutes ?? "—"} min
          </div>
          <button
            type="button"
            data-testid="nex-emergency-withdraw"
            onClick={handleWithdraw}
            style={{
              marginTop: 10,
              background: "transparent",
              color: EMERGENCY_PALETTE.textPrimary,
              border: `1px solid ${EMERGENCY_PALETTE.divider}`,
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Withdraw
          </button>
        </div>
      ) : null}

      {status === "declined" ? (
        <p
          data-testid="nex-emergency-declined-state"
          style={{
            marginTop: 14,
            padding: 10,
            background: EMERGENCY_PALETTE.surfaceMuted,
            border: `1px solid ${EMERGENCY_PALETTE.divider}`,
            borderRadius: 10,
            fontSize: 13,
            color: EMERGENCY_PALETTE.textSecondary,
          }}
        >
          You chose not to respond. The requester has not been told why.
        </p>
      ) : null}

      {status === "withdrawn" ? (
        <p
          data-testid="nex-emergency-withdrawn-state"
          style={{
            marginTop: 14,
            padding: 10,
            background: EMERGENCY_PALETTE.surfaceMuted,
            border: `1px solid ${EMERGENCY_PALETTE.divider}`,
            borderRadius: 10,
            fontSize: 13,
            color: EMERGENCY_PALETTE.textSecondary,
          }}
        >
          You withdrew your acceptance. The requester has been informed.
        </p>
      ) : null}

      {terminal && !isRevokedWithinWindow ? (
        <p
          data-testid="nex-emergency-incident-terminal"
          style={{
            marginTop: 14,
            padding: 10,
            background: EMERGENCY_PALETTE.surfaceMuted,
            border: `1px solid ${EMERGENCY_PALETTE.divider}`,
            borderRadius: 10,
            fontSize: 13,
            color: EMERGENCY_PALETTE.textDim,
          }}
        >
          This incident is {incident.state}.
        </p>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          data-testid="nex-emergency-alert-error"
          style={{
            marginTop: 14,
            padding: 10,
            background: EMERGENCY_PALETTE.emergencyMuted,
            border: `1px solid ${EMERGENCY_PALETTE.emergencyBorder}`,
            borderRadius: 10,
            fontSize: 13,
            color: EMERGENCY_PALETTE.textPrimary,
          }}
        >
          {errorMessage}
        </p>
      ) : null}

      {/*
        Report-to-Police hand-off · always visible on non-terminal
        incidents regardless of accept/decline/pending state. The
        compact entry button opens the panel inline. The panel itself
        is "always rendered" when open — no modal, so it never traps
        focus during an active emergency.
      */}
      {!terminal || isRevokedWithinWindow ? (
        <section
          aria-label="Report to police hand-off"
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: `1px solid ${EMERGENCY_PALETTE.divider}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: EMERGENCY_PALETTE.textDim,
              marginBottom: 8,
            }}
          >
            Too far to help in person?
          </div>
          <button
            type="button"
            data-testid="nex-emergency-report-police"
            data-nex-emergency-report-police-open={policePanelOpen ? "true" : "false"}
            onClick={() => setPolicePanelOpen((o) => !o)}
            aria-expanded={policePanelOpen}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              background: "transparent",
              color: EMERGENCY_PALETTE.emergency,
              border: `1px solid ${EMERGENCY_PALETTE.emergencyBorder}`,
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.02em",
              cursor: "pointer",
            }}
          >
            {policePanelOpen ? "Hide report to police" : "Report to police"}
          </button>
          {isRevokedWithinWindow ? (
            <p
              data-testid="nex-emergency-report-police-revoked-note"
              style={{
                marginTop: 8,
                fontSize: 12,
                color: EMERGENCY_PALETTE.textDim,
                lineHeight: 1.5,
              }}
            >
              This alert was cancelled by the requester. Only call if you
              have independent reason to be concerned.
            </p>
          ) : null}
          {policePanelOpen ? (
            <div style={{ marginTop: 12 }}>
              <ReportToPolicePanel
                requesterLat={incident.locationLat}
                requesterLng={incident.locationLng}
                requesterCountryCode={requesterCountryCode}
                simulated={simulated}
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return "just now";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "just now";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

const primaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "14px 16px",
  background: EMERGENCY_PALETTE.emergency,
  color: "#FFFFFF",
  border: "none",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "0.03em",
  cursor: "pointer",
};

const ghostButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "14px 16px",
  background: "transparent",
  color: EMERGENCY_PALETTE.textPrimary,
  border: `1px solid ${EMERGENCY_PALETTE.divider}`,
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};
