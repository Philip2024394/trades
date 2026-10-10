// src/components/nex-native/emergency/ActiveIncidentView.tsx
//
// Active incident view (requester-facing) · sealed 2026-10-10.
// -------------------------------------------------------------
// Polls the server every 15s for responder status · poll is simple
// and honest in v1 · no realtime subscription. Explicitly surfaces:
//   · N community members responding
//   · list of accepted responders + ETA
//   · expired state ("no one accepted in the window")
//   · cancel-with-confirmation
//
// Load-bearing anti-patterns:
//   · Do NOT fabricate responder data. "0 responding" is the correct
//     honest state when no fixtures exist.
//   · Do NOT embed a real map in v1 · the placeholder card is the
//     sealed design.
//   · Do NOT poll faster than 15s · bombards the DB and misleads the
//     requester.

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EMERGENCY_PALETTE } from "./_palette";
import { SimulatedBadge } from "./SimulatedBadge";
import type {
  EmergencyIncident,
  IncidentRecipient,
  IncidentState,
} from "./types";

// ---------------------------------------------------------------------
// Temporary type shim (L2 · 2026-10-10) · mirrors IncidentAlertCard.
// Delete when the components-level `./types` carries the full union
// OR when imports swap to `@/lib/nex-native/emergency/types`.
type ExtendedIncidentState =
  | IncidentState
  | "pending_confirmation"
  | "revoked_within_window";

function extState(s: IncidentState): ExtendedIncidentState {
  return s as ExtendedIncidentState;
}

const PENDING_CONFIRMATION_WINDOW_MS = 10_000;

export interface UpdateLocationArgs {
  readonly incidentId: string;
  readonly lat: number;
  readonly lng: number;
  readonly accuracyMeters?: number | null;
  readonly headingDegrees?: number | null;
  readonly speedMps?: number | null;
  readonly capturedAt: string;
}

export type UpdateLocationResult =
  | { ok: true; updateId: string; appliedAt: string }
  | { ok: false; reason: string };

export interface ActiveIncidentViewProps {
  services: {
    load: () => Promise<{
      incident: EmergencyIncident | null;
      recipients: IncidentRecipient[];
    }>;
    cancel: (
      incidentId: string,
    ) => Promise<{ incidentId: string; state: IncidentState | string }>;
    /** Live-location ingest · wired to updateIncidentLocationAction by
     *  the hosting page. Returns the server envelope. Optional so
     *  hermetic tests can omit it. */
    updateLocation?: (args: UpdateLocationArgs) => Promise<UpdateLocationResult>;
  };
  /** Poll interval ms · tests pass a small value. Defaults to 15000. */
  pollIntervalMs?: number;
  /** Minimum milliseconds between watchPosition pings sent to the
   *  server. Mirrors the service-layer 10s rate limit with a small
   *  safety margin (default 15s). Tests may pass a small value. */
  liveLocationMinIntervalMs?: number;
  /** Simulated flag · defaults to true. */
  simulated?: boolean;
}

/** Live-location UI state · surfaced in a chip + accuracy footnote. */
type LiveLocationUiState =
  | { kind: "idle" }
  | { kind: "unsupported" }
  | { kind: "requesting" }
  | { kind: "streaming"; accuracyMeters: number | null; capturedAt: string }
  | { kind: "denied" }
  | { kind: "error"; message: string };

export function ActiveIncidentView({
  services,
  pollIntervalMs = 15_000,
  liveLocationMinIntervalMs = 15_000,
  simulated = true,
}: ActiveIncidentViewProps): React.JSX.Element {
  const router = useRouter();
  const [state, setState] = React.useState<
    | { kind: "loading" }
    | { kind: "empty" }
    | {
        kind: "ready";
        incident: EmergencyIncident;
        recipients: IncidentRecipient[];
      }
  >({ kind: "loading" });
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const [liveLocation, setLiveLocation] = React.useState<LiveLocationUiState>({
    kind: "idle",
  });

  const refresh = React.useCallback(async () => {
    const { incident, recipients } = await services.load();
    if (!incident) {
      setState({ kind: "empty" });
      return;
    }
    setState({ kind: "ready", incident, recipients });
  }, [services]);

  React.useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [refresh, pollIntervalMs]);

  // ─────────────────────────────────────────────────────────────────
  // Service worker scaffold registration (H3)
  // ─────────────────────────────────────────────────────────────────
  // Honest degradation · if the browser doesn't support service
  // workers, we silently skip. The worker scope is limited to
  // /nex-native/emergency-help/ · see
  // docs/doctrine/nex-emergency-background-capability-2026-10-10.md.
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/nex-emergency-sw.js", { scope: "/nex-native/emergency-help/" })
      .catch(() => {
        // Silent · service worker is bonus plumbing, not critical to
        // the requester experience.
      });
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // Foreground watchPosition streaming (H3)
  // ─────────────────────────────────────────────────────────────────
  // Doctrine:
  //   · Only starts AFTER we've confirmed an active (non-terminal)
  //     incident exists for the viewer · never asks permission on
  //     a loading / empty / cancelled / resolved / expired view.
  //   · Debounces at liveLocationMinIntervalMs client-side so we
  //     don't flood the server · the service-layer rate limit (10s)
  //     is the hard guard.
  //   · On unmount: clearWatch · stream ends with the page.
  //   · Permission denied is terminal · no infinite auto-retry.
  const incidentId = state.kind === "ready" ? state.incident.incidentId : null;
  const liveStateIsLive =
    state.kind === "ready"
    && (state.incident.state === "active"
     || state.incident.state === "responders_assigned");
  const updateLocation = services.updateLocation;

  React.useEffect(() => {
    if (!incidentId || !liveStateIsLive) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLiveLocation({ kind: "unsupported" });
      return;
    }
    if (!updateLocation) {
      // No ingest wired · treat as idle · the UI remains honest
      // about the fact that location is not being streamed.
      return;
    }

    setLiveLocation({ kind: "requesting" });
    let lastSentMs = 0;
    let cancelled = false;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (cancelled) return;
        const nowMs = Date.now();
        if (nowMs - lastSentMs < liveLocationMinIntervalMs) {
          // Debounce · update the UI accuracy but don't ship to server.
          setLiveLocation({
            kind: "streaming",
            accuracyMeters:
              typeof position.coords.accuracy === "number"
                ? Math.round(position.coords.accuracy)
                : null,
            capturedAt: new Date(position.timestamp).toISOString(),
          });
          return;
        }
        lastSentMs = nowMs;
        const capturedAt = new Date(position.timestamp).toISOString();
        setLiveLocation({
          kind: "streaming",
          accuracyMeters:
            typeof position.coords.accuracy === "number"
              ? Math.round(position.coords.accuracy)
              : null,
          capturedAt,
        });
        void updateLocation({
          incidentId,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters:
            typeof position.coords.accuracy === "number"
              ? Math.round(position.coords.accuracy)
              : null,
          headingDegrees:
            typeof position.coords.heading === "number"
            && Number.isFinite(position.coords.heading)
              ? position.coords.heading
              : null,
          speedMps:
            typeof position.coords.speed === "number"
            && Number.isFinite(position.coords.speed)
            && position.coords.speed >= 0
              ? position.coords.speed
              : null,
          capturedAt,
        }).catch(() => {
          // Transport failures are silently swallowed · the next
          // watchPosition fire will retry naturally. The UI remains
          // "streaming" which is honest · the browser IS still
          // producing fixes.
        });
      },
      (err) => {
        if (cancelled) return;
        if (err.code === err.PERMISSION_DENIED) {
          setLiveLocation({ kind: "denied" });
        } else {
          setLiveLocation({
            kind: "error",
            message: err.message || "Could not read location",
          });
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 20_000,
      },
    );

    return () => {
      cancelled = true;
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch {
        // ignore
      }
    };
  }, [incidentId, liveStateIsLive, liveLocationMinIntervalMs, updateLocation]);

  const handleCancel = React.useCallback(async () => {
    if (state.kind !== "ready") return;
    setCancelling(true);
    try {
      await services.cancel(state.incident.incidentId);
      router.push("/nex-native/settings");
    } finally {
      setCancelling(false);
    }
  }, [services, state, router]);

  if (state.kind === "loading") {
    return (
      <Shell>
        <SimulatedBadge live={!simulated} />
        <p
          style={{
            marginTop: 20,
            color: EMERGENCY_PALETTE.textSecondary,
            fontSize: 14,
          }}
        >
          Loading your active emergency…
        </p>
      </Shell>
    );
  }

  if (state.kind === "empty") {
    return (
      <Shell>
        <SimulatedBadge live={!simulated} />
        <h1 style={headerStyle}>No active emergency</h1>
        <p
          style={{
            marginTop: 12,
            color: EMERGENCY_PALETTE.textSecondary,
            lineHeight: 1.55,
          }}
        >
          You have no active emergency right now. If you need help,
          return to Settings and tap the Emergency Help entry.
        </p>
        <Link
          href="/nex-native/settings"
          style={{
            display: "inline-block",
            marginTop: 20,
            color: EMERGENCY_PALETTE.cyan,
            textDecoration: "underline",
            fontSize: 13,
          }}
        >
          Return to settings
        </Link>
      </Shell>
    );
  }

  const { incident, recipients } = state;
  const accepted = recipients.filter((r) => r.responseStatus === "accepted");
  const extCurrent = extState(incident.state);
  const isPendingConfirmation = extCurrent === "pending_confirmation";

  if (incident.state === "expired") {
    return (
      <Shell>
        <SimulatedBadge live={!simulated} />
        <h1 style={headerStyle}>Alert expired</h1>
        <p
          style={{
            marginTop: 12,
            color: EMERGENCY_PALETTE.textSecondary,
            lineHeight: 1.55,
          }}
        >
          No one accepted in the window. You can re-raise an alert if
          you still need help · for a real emergency, please call your
          local emergency services.
        </p>
        <Link
          href="/nex-native/emergency-help"
          style={reraiseLinkStyle}
          data-testid="nex-emergency-reraise"
        >
          Re-raise alert
        </Link>
      </Shell>
    );
  }

  if (incident.state === "cancelled" || incident.state === "resolved") {
    return (
      <Shell>
        <SimulatedBadge live={!simulated} />
        <h1 style={headerStyle}>
          Alert {incident.state === "cancelled" ? "cancelled" : "resolved"}
        </h1>
        <Link
          href="/nex-native/settings"
          style={{
            display: "inline-block",
            marginTop: 20,
            color: EMERGENCY_PALETTE.cyan,
            textDecoration: "underline",
            fontSize: 13,
          }}
        >
          Return to settings
        </Link>
      </Shell>
    );
  }

  if (isPendingConfirmation) {
    return (
      <Shell>
        <SimulatedBadge live={!simulated} />
        <PendingConfirmationBanner
          createdAtIso={incident.createdAt}
          onRevoke={handleCancel}
          revoking={cancelling}
        />
        <p
          style={{
            marginTop: 16,
            color: EMERGENCY_PALETTE.textSecondary,
            lineHeight: 1.55,
            fontSize: 14,
          }}
        >
          Sending alert · responders will be notified at the end of the
          countdown.
        </p>
      </Shell>
    );
  }

  // When the incident is active (post-confirmation), surface a brief
  // success swap for the first ~15s after activatedAt. This keeps the
  // honest contract: no fabricated success banner if we never saw the
  // pending transition.
  const activatedMs = incident.activatedAt
    ? Date.parse(incident.activatedAt)
    : NaN;
  const activatedRecently =
    Number.isFinite(activatedMs) && Date.now() - activatedMs < 15_000;

  return (
    <Shell>
      <SimulatedBadge live={!simulated} />
      {activatedRecently ? (
        <div
          data-testid="nex-emergency-active-confirmed-banner"
          role="status"
          style={{
            marginTop: 14,
            padding: "10px 14px",
            background: "rgba(34,197,94,0.14)",
            border: `1px solid ${EMERGENCY_PALETTE.success}`,
            borderRadius: 12,
            color: EMERGENCY_PALETTE.textPrimary,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Alert confirmed · responders notified
        </div>
      ) : null}
      <h1 style={headerStyle}>Your emergency is active</h1>

      <LiveLocationChip liveLocation={liveLocation} />

      <p
        data-testid="nex-emergency-responder-count"
        style={{
          marginTop: 12,
          fontSize: 15,
          color: EMERGENCY_PALETTE.textPrimary,
        }}
      >
        <strong style={{ color: EMERGENCY_PALETTE.emergency }}>
          {accepted.length}
        </strong>{" "}
        community {accepted.length === 1 ? "member is" : "members are"}{" "}
        responding
      </p>

      <section
        aria-label="responders"
        data-testid="nex-emergency-responders-list"
        style={{
          marginTop: 16,
          display: "grid",
          gap: 8,
        }}
      >
        {accepted.length === 0 ? (
          <div
            style={{
              padding: "14px 16px",
              background: EMERGENCY_PALETTE.surfaceMuted,
              border: `1px dashed ${EMERGENCY_PALETTE.divider}`,
              borderRadius: 12,
              color: EMERGENCY_PALETTE.textSecondary,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            No one has accepted yet. The alert is still being delivered to
            your trusted contacts and nearby opted-in responders.
          </div>
        ) : (
          accepted.map((r) => (
            <div
              key={r.recipientId}
              data-nex-emergency-responder-id={r.recipientAccountId}
              style={{
                padding: "12px 14px",
                background: EMERGENCY_PALETTE.surface,
                border: `1px solid ${EMERGENCY_PALETTE.divider}`,
                borderRadius: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 14 }}>{r.recipientAccountId}</span>
              <span
                style={{
                  fontSize: 12,
                  color: EMERGENCY_PALETTE.cyan,
                  fontWeight: 600,
                }}
              >
                {r.etaMinutes != null ? `${r.etaMinutes} min away` : "ETA pending"}
              </span>
            </div>
          ))
        )}
      </section>

      <section
        aria-label="map placeholder"
        style={{
          marginTop: 20,
          padding: "16px",
          background: EMERGENCY_PALETTE.surfaceMuted,
          border: `1px solid ${EMERGENCY_PALETTE.divider}`,
          borderRadius: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: EMERGENCY_PALETTE.textDim,
          }}
        >
          Map · live routes
        </div>
        <p
          style={{
            marginTop: 6,
            fontSize: 12.5,
            color: EMERGENCY_PALETTE.textSecondary,
            lineHeight: 1.5,
          }}
        >
          Responder locations · live routes shown only to authorised
          participants. A full map renders in a future build.
        </p>
      </section>

      <div style={{ marginTop: 24 }}>
        {!confirmCancel ? (
          <button
            type="button"
            data-testid="nex-emergency-cancel-start"
            onClick={() => setConfirmCancel(true)}
            style={cancelButtonStyle}
          >
            CANCEL EMERGENCY
          </button>
        ) : (
          <div
            data-testid="nex-emergency-cancel-confirm"
            style={{
              padding: 14,
              background: EMERGENCY_PALETTE.emergencyMuted,
              border: `1px solid ${EMERGENCY_PALETTE.emergencyBorder}`,
              borderRadius: 12,
            }}
          >
            <div style={{ fontWeight: 600 }}>Cancel this emergency?</div>
            <p
              style={{
                margin: "6px 0 12px",
                fontSize: 12.5,
                color: EMERGENCY_PALETTE.textSecondary,
                lineHeight: 1.45,
              }}
            >
              Responders will be told your alert was cancelled.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                data-testid="nex-emergency-cancel-yes"
                style={{
                  ...cancelButtonStyle,
                  opacity: cancelling ? 0.6 : 1,
                }}
              >
                {cancelling ? "Cancelling…" : "Yes · cancel"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                data-testid="nex-emergency-cancel-no"
                style={{
                  padding: "12px 16px",
                  background: "transparent",
                  color: EMERGENCY_PALETTE.textPrimary,
                  border: `1px solid ${EMERGENCY_PALETTE.divider}`,
                  borderRadius: 12,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Keep alert active
              </button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <main
      data-testid="nex-emergency-active-view"
      style={{
        minHeight: "100dvh",
        background: EMERGENCY_PALETTE.bg,
        color: EMERGENCY_PALETTE.textPrimary,
        padding: "20px 20px 40px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>{children}</div>
    </main>
  );
}

const headerStyle: React.CSSProperties = {
  margin: "16px 0 0",
  fontSize: 22,
  fontWeight: 700,
};

const cancelButtonStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "14px 18px",
  background: EMERGENCY_PALETTE.emergency,
  color: "#FFFFFF",
  border: "none",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const reraiseLinkStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: 20,
  padding: "12px 18px",
  background: EMERGENCY_PALETTE.emergency,
  color: "#FFFFFF",
  textDecoration: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

// =====================================================================
// LiveLocationChip
// =====================================================================
//
// Doctrine-driven · copy MUST honestly state "while this page is open".
// NEVER claim ambient tracking · see
// docs/doctrine/nex-emergency-background-capability-2026-10-10.md.

function LiveLocationChip({
  liveLocation,
}: {
  liveLocation: LiveLocationUiState;
}): React.JSX.Element | null {
  const chipBase: React.CSSProperties = {
    marginTop: 14,
    padding: "10px 14px",
    borderRadius: 12,
    fontSize: 12.5,
    lineHeight: 1.45,
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
  };

  if (liveLocation.kind === "idle" || liveLocation.kind === "requesting") {
    return (
      <div
        data-testid="nex-emergency-live-location-chip"
        data-nex-live-location-state={liveLocation.kind}
        style={{
          ...chipBase,
          background: EMERGENCY_PALETTE.surfaceMuted,
          border: `1px solid ${EMERGENCY_PALETTE.divider}`,
          color: EMERGENCY_PALETTE.textSecondary,
        }}
      >
        <span aria-hidden style={{ color: EMERGENCY_PALETTE.cyan }}>●</span>
        <span>
          {liveLocation.kind === "requesting"
            ? "Requesting location permission…"
            : "Live location preparing…"}
        </span>
      </div>
    );
  }

  if (liveLocation.kind === "streaming") {
    const accuracyLine =
      liveLocation.accuracyMeters !== null
      && liveLocation.accuracyMeters > 100
        ? ` · accuracy ±${liveLocation.accuracyMeters} m`
        : "";
    return (
      <div
        data-testid="nex-emergency-live-location-chip"
        data-nex-live-location-state="streaming"
        style={{
          ...chipBase,
          background: EMERGENCY_PALETTE.surface,
          border: `1px solid ${EMERGENCY_PALETTE.cyan}`,
          color: EMERGENCY_PALETTE.textPrimary,
        }}
      >
        <span aria-hidden style={{ color: EMERGENCY_PALETTE.cyan }}>●</span>
        <span>
          Live location sharing · updates every ~15s while this page is open
          {accuracyLine}
        </span>
      </div>
    );
  }

  if (liveLocation.kind === "denied") {
    return (
      <div
        data-testid="nex-emergency-live-location-chip"
        data-nex-live-location-state="denied"
        style={{
          ...chipBase,
          background: EMERGENCY_PALETTE.emergencyMuted,
          border: `1px solid ${EMERGENCY_PALETTE.emergencyBorder}`,
          color: EMERGENCY_PALETTE.textPrimary,
        }}
      >
        <span aria-hidden>⚠</span>
        <span>
          Live location unavailable · responders will see your position from
          when the alert was sent.
        </span>
      </div>
    );
  }

  if (liveLocation.kind === "unsupported") {
    return (
      <div
        data-testid="nex-emergency-live-location-chip"
        data-nex-live-location-state="unsupported"
        style={{
          ...chipBase,
          background: EMERGENCY_PALETTE.surfaceMuted,
          border: `1px solid ${EMERGENCY_PALETTE.divider}`,
          color: EMERGENCY_PALETTE.textSecondary,
        }}
      >
        <span aria-hidden>·</span>
        <span>
          This browser doesn't support live location · responders will see your
          position from when the alert was sent.
        </span>
      </div>
    );
  }

  // kind === "error"
  return (
    <div
      data-testid="nex-emergency-live-location-chip"
      data-nex-live-location-state="error"
      style={{
        ...chipBase,
        background: EMERGENCY_PALETTE.surfaceMuted,
        border: `1px solid ${EMERGENCY_PALETTE.divider}`,
        color: EMERGENCY_PALETTE.textSecondary,
      }}
    >
      <span aria-hidden>·</span>
      <span>
        Live location paused · responders will see your position from when the
        alert was sent.
      </span>
    </div>
  );
}

// =====================================================================
// PendingConfirmationBanner (exported for structural tests)
// =====================================================================
//
// Rendered on the requester's own /active view when the incident is in
// `pending_confirmation`. Visual language: amber = requester-pending
// (urgent, counting down). Pairs with the cyan responder-side banner
// surfaced by IncidentAlertCard.
//
// Exported so the test file can prove its structure without needing a
// client runtime capable of resolving the useEffect-driven load().

export function PendingConfirmationBanner({
  createdAtIso,
  onRevoke,
  revoking,
}: {
  createdAtIso: string;
  onRevoke: () => void;
  revoking: boolean;
}): React.JSX.Element {
  const createdAtMs = React.useMemo(() => {
    const t = Date.parse(createdAtIso);
    return Number.isNaN(t) ? Date.now() : t;
  }, [createdAtIso]);
  const [nowMs, setNowMs] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    const tick = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(tick);
  }, []);
  const remainingSec = Math.max(
    0,
    Math.ceil((createdAtMs + PENDING_CONFIRMATION_WINDOW_MS - nowMs) / 1000),
  );

  return (
    <section
      data-testid="nex-emergency-active-pending-banner"
      data-nex-emergency-active-pending-remaining-sec={String(remainingSec)}
      role="status"
      aria-live="polite"
      style={{
        marginTop: 14,
        padding: "14px 16px",
        background: "rgba(245,158,11,0.14)",
        border: `2px solid ${EMERGENCY_PALETTE.amber}`,
        borderRadius: 12,
        color: EMERGENCY_PALETTE.textPrimary,
      }}
    >
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: EMERGENCY_PALETTE.amber,
          letterSpacing: "0.02em",
        }}
      >
        ⏳ Sending alert · responders will be notified when the countdown
        completes
      </div>
      <div
        data-testid="nex-emergency-active-pending-countdown"
        style={{
          marginTop: 8,
          fontSize: 13,
          fontWeight: 700,
          color: EMERGENCY_PALETTE.amber,
          letterSpacing: "0.08em",
        }}
      >
        {remainingSec > 0 ? `${remainingSec}s remaining` : "Confirming…"}
      </div>
      <button
        type="button"
        data-testid="nex-emergency-active-pending-revoke"
        onClick={onRevoke}
        disabled={revoking}
        style={{
          marginTop: 14,
          display: "inline-block",
          padding: "12px 18px",
          background: EMERGENCY_PALETTE.emergency,
          color: "#FFFFFF",
          border: "none",
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          cursor: revoking ? "not-allowed" : "pointer",
          opacity: revoking ? 0.6 : 1,
        }}
      >
        {revoking ? "Revoking…" : "Revoke"}
      </button>
    </section>
  );
}

