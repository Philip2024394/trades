// src/components/nex-native/emergency/EmergencyConfirmationScreen.tsx
//
// "Do you need help?" · pending-alert + early-location client ·
// re-architected 2026-10-10 (L1).
// --------------------------------------------------------------------
// Load-bearing invariants (sealed by L1 pending-confirmation seal):
//   · Safety-warning acknowledgment gate (phase="acknowledging-policy")
//     is the FIRST interactive step. Enforcement policy summarised in
//     docs/doctrine/nex-emergency-help-abuse-policy-2026-10-10.md.
//     Acknowledgment is remembered via sessionStorage for the current
//     session so repeat use is not slowed down · never persisted beyond
//     the session · the warning text stays reachable via the Settings
//     entry.
//   · Geolocation is requested ONLY on the first tap of "I NEED HELP".
//     Never request on mount, never request from the entry card, never
//     before the policy ack.
//   · Tapping "I NEED HELP" after a category pick now:
//       1. Captures a location snapshot (as today),
//       2. IMMEDIATELY calls createPendingAlert · the alert row is
//          REAL and the fan-out hook fires on the server at T=0,
//       3. Enters phase="counting-down" with a 10-second window,
//       4. Starts watchPosition streaming updates to the server via
//          updateIncidentLocation (debounced to ≥2 s client-side ·
//          server-side 10 s rate limit still protects the service).
//   · The 10-second window is a REVOCATION window, not a submission
//     delay. If the user does nothing, the countdown hits 0 and
//     confirmPendingAlert flips the state pending_confirmation →
//     active · the viewer navigates to the active page. If the user
//     taps CANCEL, revokePendingAlert flips the state to
//     revoked_within_window · the viewer returns to idle with an
//     honest "Alert revoked within safety window" message.
//   · Component unmount during the countdown fires revokePendingAlert
//     fire-and-forget to avoid orphan pending incidents.
//   · The Skip countdown link calls confirmPendingAlert immediately.
//   · Honest failure states for: offline, geolocation denied / errored,
//     no-eligible-responders. Never fabricate "success" when the stack
//     refused.
//   · SIMULATED · v1 badge visible at the top of every state.
//
// Anti-patterns:
//   · Do NOT create the pending alert row before the countdown enters.
//     The server-side effect fires at T=0 (start of counting-down)
//     and the countdown REMAINS the revocation window.
//   · Do NOT leave a running interval or watchPosition if the phase
//     leaves counting-down. Cleanup is mandatory on both.
//   · Do NOT silently proceed when geolocation is denied · surface the
//     explicit "we cannot share your location" message and let the user
//     decide whether to proceed with location unset.
//   · Do NOT persist the policy acknowledgment beyond sessionStorage.
//     A new session re-shows the warning. Deliberately brief enough not
//     to deter a genuine emergency.

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EMERGENCY_PALETTE } from "./_palette";
import { SimulatedBadge } from "./SimulatedBadge";
import type { IncidentCategory } from "./types";

type Phase =
  | "acknowledging-policy"
  | "idle"
  | "awaiting-geolocation"
  | "counting-down"
  | "submitting"
  | "revoked"
  | "error"
  | "no-responders";

const POLICY_ACK_SESSION_KEY = "nex-emergency-policy-ack-v1";
const COUNTDOWN_SECONDS = 10;
/** Client-side debounce for watchPosition updates during the safety
 *  window. Faster than the active-view 15 s because every second of
 *  the safety window is load-bearing. The server-side service also
 *  enforces a 10 s rate limit so bursts never land. */
const LOCATION_STREAM_MIN_INTERVAL_MS = 2000;

export interface EmergencyServiceResult {
  readonly ok: true;
  readonly incidentId?: string;
  readonly state?: string;
}
export interface EmergencyServiceFailure {
  readonly ok: false;
  readonly reason: string;
}

export interface EmergencyConfirmationScreenProps {
  /** Server actions · ONE object so tests can swap all seven at once.
   *  Legacy createDraft/activate stay for backward compat during the
   *  migration wave (never called by the pending-confirmation flow). */
  services: {
    createDraft: (args: {
      category: IncidentCategory;
      locationLat: number | null;
      locationLng: number | null;
      locationAccuracyMeters: number | null;
    }) => Promise<{ incidentId: string }>;
    activate: (
      incidentId: string,
    ) => Promise<{ incidentId: string; state: string }>;
    createPending: (args: {
      category: IncidentCategory;
      locationLat: number | null;
      locationLng: number | null;
      locationAccuracyMeters: number | null;
    }) => Promise<{ ok: true; incidentId: string } | { ok: false; reason: string }>;
    confirmPending: (args: {
      incidentId: string;
    }) => Promise<{ ok: true; state: string } | { ok: false; reason: string }>;
    revokePending: (args: {
      incidentId: string;
      reason?: string;
    }) => Promise<{ ok: true; state: string } | { ok: false; reason: string }>;
    updateLocation: (args: {
      incidentId: string;
      lat: number;
      lng: number;
      accuracyMeters: number | null;
      capturedAt: string;
    }) => Promise<{ ok: true } | { ok: false; reason: string }>;
  };
  /** Optional override for `navigator.geolocation` · tests inject a stub. */
  geolocation?: {
    getCurrentPosition: (
      success: (position: {
        coords: {
          latitude: number;
          longitude: number;
          accuracy: number;
        };
      }) => void,
      error: (err: { code: number; message: string }) => void,
      options?: unknown,
    ) => void;
    watchPosition?: (
      success: (position: {
        coords: {
          latitude: number;
          longitude: number;
          accuracy: number;
        };
        timestamp: number;
      }) => void,
      error?: (err: { code: number; message: string }) => void,
      options?: unknown,
    ) => number;
    clearWatch?: (watchId: number) => void;
  } | null;
  /** Online flag · defaults to `navigator.onLine`. Tests may override. */
  isOnline?: boolean;
  /** Simulated · v1 flag. Defaults to true (live mode is off in v1). */
  simulated?: boolean;
  /**
   * TEST-ONLY · forces an initial phase so unit tests can snapshot the
   * countdown block via renderToStaticMarkup without a DOM event loop.
   * Never set this from production code paths.
   */
  __testInitialPhase?: Phase;
  /**
   * TEST-ONLY · initial category used only when `__testInitialPhase` is
   * also provided. Allows countdown-phase snapshots to exist for a
   * selected category without a full interaction sequence.
   */
  __testInitialCategory?: IncidentCategory;
  /**
   * TEST-ONLY · initial incident id used only when `__testInitialPhase`
   * is also provided. Lets a snapshot test surface the pending-id
   * data attribute without walking the full flow.
   */
  __testInitialIncidentId?: string;
}

export function EmergencyConfirmationScreen({
  services,
  geolocation,
  isOnline,
  simulated = true,
  __testInitialPhase,
  __testInitialCategory,
  __testInitialIncidentId,
}: EmergencyConfirmationScreenProps): React.JSX.Element {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>(
    __testInitialPhase ?? "acknowledging-policy",
  );
  const [category, setCategory] = React.useState<IncidentCategory | null>(
    __testInitialCategory ?? null,
  );
  const [geoError, setGeoError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [location, setLocation] = React.useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(null);
  const [secondsRemaining, setSecondsRemaining] =
    React.useState<number>(COUNTDOWN_SECONDS);
  const [incidentId, setIncidentId] = React.useState<string | null>(
    __testInitialIncidentId ?? null,
  );

  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const watchIdRef = React.useRef<number | null>(null);
  const lastStreamedAtRef = React.useRef<number>(0);
  // Guard against double-fire if the interval tick and an explicit
  // "Skip countdown" happen in the same frame.
  const firedRef = React.useRef<boolean>(false);
  // Ref-latched incident id so the countdown driver + unmount cleanup
  // can revoke without re-running on each incidentId state change.
  const incidentIdRef = React.useRef<string | null>(incidentId);
  React.useEffect(() => {
    incidentIdRef.current = incidentId;
  }, [incidentId]);

  const clearCountdownInterval = React.useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const clearLocationWatch = React.useCallback(() => {
    if (watchIdRef.current !== null) {
      const g =
        geolocation ??
        (typeof navigator !== "undefined" && "geolocation" in navigator
          ? (navigator.geolocation as EmergencyConfirmationScreenProps["geolocation"])
          : null);
      try {
        if (g && typeof g.clearWatch === "function") {
          g.clearWatch(watchIdRef.current);
        }
      } catch {
        /* non-fatal */
      }
      watchIdRef.current = null;
    }
  }, [geolocation]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (__testInitialPhase) return;
    try {
      const prior = window.sessionStorage.getItem(POLICY_ACK_SESSION_KEY);
      if (prior === "true") setPhase("idle");
    } catch {
      // sessionStorage disabled · stay on ack gate · still correct behaviour.
    }
  }, [__testInitialPhase]);

  const acknowledgePolicy = React.useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(POLICY_ACK_SESSION_KEY, "true");
      } catch {
        /* non-fatal */
      }
    }
    setPhase("idle");
  }, []);

  const online = React.useMemo(() => {
    if (typeof isOnline === "boolean") return isOnline;
    if (typeof navigator !== "undefined") return navigator.onLine;
    return true;
  }, [isOnline]);

  const geo =
    geolocation ??
    (typeof navigator !== "undefined" && "geolocation" in navigator
      ? (navigator.geolocation as unknown as EmergencyConfirmationScreenProps["geolocation"])
      : null);

  // Confirm the pending alert · reached by the natural T=0 tick or by
  // the explicit Skip countdown tap. Both paths flip the row's state
  // to active and navigate to /active.
  const confirmAlertFromCountdown = React.useCallback(async () => {
    if (firedRef.current) return;
    const id = incidentIdRef.current;
    if (id === null) {
      // Defensive · should never happen because createPending runs
      // before we enter counting-down. Surface an honest error.
      firedRef.current = false;
      clearCountdownInterval();
      clearLocationWatch();
      setSubmitError("Alert row missing · please try again.");
      setPhase("error");
      return;
    }
    firedRef.current = true;
    clearCountdownInterval();
    clearLocationWatch();
    setSubmitError(null);
    setPhase("submitting");
    try {
      const r = await services.confirmPending({ incidentId: id });
      if (!r.ok) {
        setSubmitError(`Could not confirm alert · ${r.reason}`);
        setPhase("error");
        firedRef.current = false;
        return;
      }
      router.push("/nex-native/emergency-help/active");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error confirming alert.";
      if (/no.?responders/i.test(message)) {
        setPhase("no-responders");
      } else {
        setSubmitError(message);
        setPhase("error");
      }
      firedRef.current = false;
    }
  }, [services, router, clearCountdownInterval, clearLocationWatch]);

  // Countdown driver · owns the single interval. Any transition OUT of
  // counting-down clears the interval. Component unmount clears via the
  // cleanup return. This is the ONLY place a setInterval is started.
  React.useEffect(() => {
    if (phase !== "counting-down") {
      clearCountdownInterval();
      return;
    }
    // Entering counting-down · (re)initialise.
    setSecondsRemaining(COUNTDOWN_SECONDS);
    firedRef.current = false;
    clearCountdownInterval();
    intervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearCountdownInterval();
          // Defer so the "0" paint can settle before state churn.
          void confirmAlertFromCountdown();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => {
      clearCountdownInterval();
    };
  }, [phase, clearCountdownInterval, confirmAlertFromCountdown]);

  // Belt-and-braces · hard unmount sweeps intervals + watchers and
  // fires revokePendingAlert fire-and-forget if we still hold a
  // pending incident id. This prevents orphan pending_confirmation
  // rows if the user closes the tab mid-countdown.
  React.useEffect(() => {
    return () => {
      clearCountdownInterval();
      clearLocationWatch();
      const id = incidentIdRef.current;
      // Only revoke if we never confirmed/revoked explicitly (firedRef
      // false means confirm was not called; the revoked phase sets
      // incidentIdRef.current to null before unmount).
      if (id !== null && !firedRef.current) {
        try {
          void services.revokePending({
            incidentId: id,
            reason: "component_unmounted_during_countdown",
          });
        } catch {
          /* best-effort fire-and-forget */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inject the heartbeat keyframes once per document. Self-contained so
  // the component has no global CSS dependency.
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "nex-emergency-countdown-heartbeat-keyframes";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      @keyframes nexEmergencyHeartbeat {
        0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgba(220,38,38,0.55); opacity: 1; }
        35%  { transform: scale(1.08); box-shadow: 0 0 0 18px rgba(220,38,38,0.00); opacity: 0.92; }
        70%  { transform: scale(1.00); box-shadow: 0 0 0 0 rgba(220,38,38,0.00); opacity: 1; }
        100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(220,38,38,0.00); opacity: 1; }
      }
      @keyframes nexEmergencyHeartbeatText {
        0%   { opacity: 1; }
        45%  { opacity: 0.55; }
        100% { opacity: 1; }
      }
    `;
    document.head.appendChild(el);
  }, []);

  const startLocationStreaming = React.useCallback(
    (idForStream: string) => {
      if (!geo || typeof geo.watchPosition !== "function") return;
      try {
        const watchId = geo.watchPosition(
          (pos) => {
            const now = Date.now();
            if (now - lastStreamedAtRef.current < LOCATION_STREAM_MIN_INTERVAL_MS) {
              return;
            }
            lastStreamedAtRef.current = now;
            const capturedAt = new Date(pos.timestamp ?? now).toISOString();
            try {
              void services.updateLocation({
                incidentId: idForStream,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracyMeters: pos.coords.accuracy,
                capturedAt,
              });
            } catch {
              /* streaming is best-effort during the safety window */
            }
          },
          () => {
            /* non-fatal · we already have the snapshot location */
          },
          { enableHighAccuracy: true, maximumAge: 0 },
        );
        if (typeof watchId === "number") {
          watchIdRef.current = watchId;
        }
      } catch {
        /* watchPosition unsupported · snapshot location still landed */
      }
    },
    [geo, services],
  );

  const requestLocationThenStart = React.useCallback(() => {
    setGeoError(null);
    setPhase("awaiting-geolocation");
    const beginPendingFlow = async (
      snapshot: { lat: number; lng: number; accuracy: number } | null,
    ) => {
      if (!category) {
        setSubmitError("No emergency category selected · please choose one.");
        setPhase("error");
        return;
      }
      try {
        const r = await services.createPending({
          category,
          locationLat: snapshot?.lat ?? null,
          locationLng: snapshot?.lng ?? null,
          locationAccuracyMeters: snapshot?.accuracy ?? null,
        });
        if (!r.ok) {
          setSubmitError(`Could not start alert · ${r.reason}`);
          setPhase("error");
          return;
        }
        setIncidentId(r.incidentId);
        incidentIdRef.current = r.incidentId;
        lastStreamedAtRef.current = 0;
        setPhase("counting-down");
        // Start the location stream · best-effort.
        startLocationStreaming(r.incidentId);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error starting alert.";
        setSubmitError(message);
        setPhase("error");
      }
    };
    if (!geo) {
      setGeoError("Your device does not expose geolocation. Alert can still be sent without a shared location.");
      void beginPendingFlow(null);
      return;
    }
    geo.getCurrentPosition(
      (pos) => {
        const snapshot = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setLocation(snapshot);
        void beginPendingFlow(snapshot);
      },
      (err) => {
        const reason =
          err.code === 1
            ? "Location permission denied. You can still send the alert · responders will not see your position."
            : `Location unavailable (${err.message}). You can still send the alert without a shared position.`;
        setGeoError(reason);
        void beginPendingFlow(null);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }, [geo, services, category, startLocationStreaming]);

  const cancelCountdown = React.useCallback(async () => {
    clearCountdownInterval();
    clearLocationWatch();
    firedRef.current = true; // suppress unmount revoke retry
    const id = incidentIdRef.current;
    setSecondsRemaining(COUNTDOWN_SECONDS);
    setPhase("submitting");
    if (id !== null) {
      try {
        await services.revokePending({ incidentId: id });
      } catch {
        /* best-effort · we still surface the revoked phase */
      }
    }
    setIncidentId(null);
    incidentIdRef.current = null;
    setPhase("revoked");
  }, [services, clearCountdownInterval, clearLocationWatch]);

  const skipCountdownAndFire = React.useCallback(() => {
    // Explicit opt-in · same destination as the natural 0 transition.
    void confirmAlertFromCountdown();
  }, [confirmAlertFromCountdown]);

  const returnToIdle = React.useCallback(() => {
    setSecondsRemaining(COUNTDOWN_SECONDS);
    setGeoError(null);
    setSubmitError(null);
    setLocation(null);
    setPhase("idle");
    firedRef.current = false;
  }, []);

  // Early guard · offline is honest, not a bug.
  if (!online) {
    return (
      <Shell>
        <SimulatedBadge live={!simulated} />
        <Header>You are offline</Header>
        <p
          style={{
            margin: "12px 0 0",
            color: EMERGENCY_PALETTE.textSecondary,
            lineHeight: 1.55,
          }}
        >
          NEX Emergency Help needs an internet connection to notify
          responders. Please reconnect and reopen this page. For a real
          emergency, call your local emergency services right away.
        </p>
        <SecondaryLink />
      </Shell>
    );
  }

  if (phase === "acknowledging-policy") {
    return (
      <Shell>
        <SimulatedBadge live={!simulated} />
        <Header>NEX Emergency Help</Header>
        <p
          style={{
            margin: "10px 0 16px",
            color: EMERGENCY_PALETTE.textSecondary,
            fontSize: 14,
            lineHeight: 1.55,
          }}
        >
          Before sending an emergency alert, please read the following.
        </p>
        <section
          data-testid="nex-emergency-safety-warning"
          aria-labelledby="nex-emergency-warning-title"
          style={{
            padding: "18px",
            background: EMERGENCY_PALETTE.emergencyMuted,
            border: `1px solid ${EMERGENCY_PALETTE.emergencyBorder}`,
            borderRadius: 12,
            margin: "0 0 20px",
          }}
        >
          <h2
            id="nex-emergency-warning-title"
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: EMERGENCY_PALETTE.textPrimary,
              letterSpacing: "0.01em",
            }}
          >
            Important Safety Warning
          </h2>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: EMERGENCY_PALETTE.textSecondary,
            }}
          >
            Emergency alerts are intended for genuine situations where
            you need urgent assistance.
          </p>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: EMERGENCY_PALETTE.textSecondary,
            }}
          >
            False, fabricated, or deliberately misleading emergency
            alerts are strictly prohibited. Users who misuse this
            feature may have their NEX accounts suspended or
            permanently removed from the NEX community.
          </p>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: EMERGENCY_PALETTE.textSecondary,
            }}
          >
            If you are genuinely in danger, do not hesitate to request
            help. If you activate an alert by mistake, cancel it
            immediately and notify the recipients.
          </p>
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: EMERGENCY_PALETTE.textPrimary,
              fontWeight: 600,
            }}
          >
            By continuing, you confirm that you understand and agree
            to use Emergency Help responsibly.
          </p>
        </section>
        <PrimaryButton
          onClick={acknowledgePolicy}
          data-testid="nex-emergency-policy-ack"
        >
          I Understand — Continue
        </PrimaryButton>
        <p
          style={{
            marginTop: 14,
            fontSize: 11.5,
            color: EMERGENCY_PALETTE.textDim,
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          Concept design · Not a working emergency service
        </p>
        <SecondaryLink />
      </Shell>
    );
  }

  if (phase === "no-responders") {
    return (
      <Shell>
        <SimulatedBadge live={!simulated} />
        <Header>No eligible responders nearby</Header>
        <p
          style={{
            margin: "12px 0 0",
            color: EMERGENCY_PALETTE.textSecondary,
            lineHeight: 1.55,
          }}
        >
          We could not find any trusted contacts or opted-in responders
          within range. Your alert was NOT sent. For a real emergency,
          call your local emergency services.
        </p>
        <PrimaryButton onClick={returnToIdle}>Try again</PrimaryButton>
        <SecondaryLink />
      </Shell>
    );
  }

  if (phase === "revoked") {
    return (
      <Shell>
        <SimulatedBadge live={!simulated} />
        <Header>Alert revoked</Header>
        <p
          data-testid="nex-emergency-revoked-copy"
          style={{
            margin: "12px 0 0",
            color: EMERGENCY_PALETTE.textSecondary,
            lineHeight: 1.55,
          }}
        >
          Alert revoked within the 10-second safety window. Recipients
          have been notified it was a cancellation.
        </p>
        <PrimaryButton
          onClick={returnToIdle}
          data-testid="nex-emergency-revoked-return"
        >
          Return
        </PrimaryButton>
        <SecondaryLink />
      </Shell>
    );
  }

  return (
    <Shell>
      <SimulatedBadge live={!simulated} />
      <Header>Do you need help?</Header>
      <p
        style={{
          margin: "10px 0 18px",
          color: EMERGENCY_PALETTE.textSecondary,
          fontSize: 14,
          lineHeight: 1.55,
        }}
      >
        Send an emergency alert with your current location to eligible
        NEX responders in your selected safety area.
      </p>

      <fieldset
        data-testid="nex-emergency-category"
        aria-label="Choose emergency type"
        style={{
          border: "none",
          padding: 0,
          margin: "0 0 20px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <CategoryIconButton
          value="medical_concern"
          label="Medical concern"
          imageSrc="/nex-emergency/medical-concern.png"
          selected={category === "medical_concern"}
          onSelect={() => setCategory("medical_concern")}
          disabled={phase === "counting-down" || phase === "submitting"}
        />
        <CategoryIconButton
          value="safety_concern"
          label="Safety concern"
          imageSrc="/nex-emergency/safety-concern.png"
          selected={category === "safety_concern"}
          onSelect={() => setCategory("safety_concern")}
          disabled={phase === "counting-down" || phase === "submitting"}
        />
      </fieldset>

      {phase === "idle" || phase === "awaiting-geolocation" ? (
        <PrimaryButton
          onClick={requestLocationThenStart}
          disabled={
            phase === "awaiting-geolocation" || category === null
          }
          data-testid="nex-emergency-primary-cta"
          data-nex-emergency-primary-ready={
            category !== null && phase !== "awaiting-geolocation"
              ? "true"
              : "false"
          }
        >
          {phase === "awaiting-geolocation"
            ? "Capturing location…"
            : "I NEED HELP"}
        </PrimaryButton>
      ) : null}
      {category === null &&
      (phase === "idle" || phase === "awaiting-geolocation") ? (
        <p
          data-testid="nex-emergency-pick-category-hint"
          style={{
            margin: "10px 0 0",
            fontSize: 12,
            color: EMERGENCY_PALETTE.textDim,
            textAlign: "center",
          }}
        >
          Choose the type of emergency to continue.
        </p>
      ) : null}

      {phase === "counting-down" ? (
        <div
          data-testid="nex-emergency-countdown"
          data-nex-emergency-seconds-remaining={secondsRemaining}
          data-nex-emergency-pending-incident-id={incidentId ?? ""}
          role="alert"
          aria-live="assertive"
          style={{
            marginTop: 4,
            padding: "22px 18px 20px",
            background: EMERGENCY_PALETTE.emergencyMuted,
            border: `1px solid ${EMERGENCY_PALETTE.emergencyBorder}`,
            borderRadius: 14,
            textAlign: "center",
          }}
        >
          {incidentId ? (
            <span
              data-testid="nex-emergency-pending-incident-id"
              data-nex-emergency-pending-incident-id={incidentId}
              style={{ display: "none" }}
            >
              {incidentId}
            </span>
          ) : null}
          <div
            aria-hidden="true"
            data-testid="nex-emergency-countdown-heartbeat"
            style={{
              width: 96,
              height: 96,
              margin: "0 auto 14px",
              borderRadius: "50%",
              background: EMERGENCY_PALETTE.emergency,
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: "0.02em",
              animation: "nexEmergencyHeartbeat 0.9s ease-in-out infinite",
              boxShadow: "0 0 0 0 rgba(220,38,38,0.55)",
            }}
          >
            {secondsRemaining}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: EMERGENCY_PALETTE.textPrimary,
              animation: "nexEmergencyHeartbeatText 0.9s ease-in-out infinite",
            }}
          >
            Sending alert in {secondsRemaining}
          </div>
          {geoError ? (
            <p
              data-testid="nex-emergency-geo-note"
              style={{
                margin: "10px 0 0",
                fontSize: 12.5,
                color: EMERGENCY_PALETTE.amber,
                lineHeight: 1.45,
              }}
            >
              {geoError}
            </p>
          ) : location ? (
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 12.5,
                color: EMERGENCY_PALETTE.textSecondary,
              }}
            >
              Location captured ({location.accuracy.toFixed(0)}m accuracy).
            </p>
          ) : null}
          <p
            style={{
              margin: "12px 0 16px",
              fontSize: 12.5,
              color: EMERGENCY_PALETTE.textSecondary,
              lineHeight: 1.5,
            }}
          >
            If this was a mistake, cancel now.
          </p>
          <button
            type="button"
            onClick={() => void cancelCountdown()}
            data-testid="nex-emergency-countdown-cancel"
            aria-label="Cancel emergency countdown"
            style={{
              display: "block",
              width: "100%",
              padding: "16px 18px",
              background: "transparent",
              color: EMERGENCY_PALETTE.textPrimary,
              border: `2px solid ${EMERGENCY_PALETTE.emergency}`,
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(220,38,38,0.25)",
            }}
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={skipCountdownAndFire}
            data-testid="nex-emergency-countdown-skip"
            style={{
              marginTop: 12,
              background: "transparent",
              border: "none",
              padding: "4px 8px",
              color: EMERGENCY_PALETTE.textDim,
              fontSize: 12,
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Skip countdown — send now
          </button>
        </div>
      ) : null}

      {phase === "submitting" ? (
        <p
          data-testid="nex-emergency-submitting"
          style={{
            marginTop: 14,
            color: EMERGENCY_PALETTE.textSecondary,
            fontSize: 13,
          }}
        >
          Sending alert…
        </p>
      ) : null}

      {phase === "error" && submitError ? (
        <p
          data-testid="nex-emergency-error"
          role="alert"
          style={{
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: 10,
            background: EMERGENCY_PALETTE.emergencyMuted,
            border: `1px solid ${EMERGENCY_PALETTE.emergencyBorder}`,
            color: EMERGENCY_PALETTE.textPrimary,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {submitError}
        </p>
      ) : null}

      <p
        style={{
          marginTop: 20,
          fontSize: 11.5,
          color: EMERGENCY_PALETTE.textDim,
          lineHeight: 1.5,
        }}
      >
        Share your location and emergency profile details with the
        recipients of this alert.
      </p>

      <SecondaryLink />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <main
      data-testid="nex-emergency-confirmation-screen"
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

function Header({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <h1
      style={{
        margin: "20px 0 0",
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: "0.005em",
      }}
    >
      {children}
    </h1>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  "data-testid": testId,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  "data-testid"?: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      style={{
        display: "block",
        width: "100%",
        padding: "16px 18px",
        marginTop: 4,
        background: disabled
          ? EMERGENCY_PALETTE.emergencyMuted
          : EMERGENCY_PALETTE.emergency,
        color: "#FFFFFF",
        border: `1px solid ${EMERGENCY_PALETTE.emergency}`,
        borderRadius: 12,
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        cursor: disabled ? "default" : "pointer",
        boxShadow: disabled
          ? undefined
          : "0 6px 18px rgba(220,38,38,0.35)",
      }}
    >
      {children}
    </button>
  );
}

function SecondaryLink(): React.JSX.Element {
  return (
    <Link
      href="/nex-native/settings"
      prefetch={false}
      style={{
        display: "inline-block",
        marginTop: 24,
        fontSize: 12,
        color: EMERGENCY_PALETTE.textDim,
        textDecoration: "underline",
      }}
    >
      Cancel · Return to safety settings
    </Link>
  );
}

function CategoryIconButton({
  value,
  label,
  imageSrc,
  selected,
  onSelect,
  disabled,
}: {
  value: IncidentCategory;
  label: string;
  imageSrc: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}): React.JSX.Element {
  // Flashing glow styles live inline as a keyframe + animation so the
  // component is self-contained · no global CSS needed. The glow sits
  // UNDER the card (box-shadow outside the border) and pulses between
  // cyan at low opacity and emergency red at higher opacity when the
  // card is selected. Unselected cards show a static muted border.
  const styleTagId = "nex-emergency-category-glow-keyframes";
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(styleTagId)) return;
    const el = document.createElement("style");
    el.id = styleTagId;
    el.textContent = `
      @keyframes nexEmergencyCategoryGlow {
        0%   { box-shadow: 0 0 0 1px ${EMERGENCY_PALETTE.emergency}, 0 10px 24px -4px rgba(0,175,255,0.35); }
        50%  { box-shadow: 0 0 0 1px ${EMERGENCY_PALETTE.emergency}, 0 18px 40px -4px rgba(220,38,38,0.70); }
        100% { box-shadow: 0 0 0 1px ${EMERGENCY_PALETTE.emergency}, 0 10px 24px -4px rgba(0,175,255,0.35); }
      }
    `;
    document.head.appendChild(el);
  }, []);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onSelect}
      disabled={disabled}
      data-testid={`nex-emergency-category-button-${value}`}
      data-nex-emergency-category-value={value}
      data-nex-emergency-category-selected={selected ? "true" : "false"}
      style={{
        position: "relative",
        padding: 10,
        background: EMERGENCY_PALETTE.surface,
        border: `1px solid ${
          selected
            ? EMERGENCY_PALETTE.emergency
            : "rgba(0, 175, 255, 0.25)"
        }`,
        borderRadius: 14,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !selected ? 0.6 : 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        transition: "transform 120ms ease",
        transform: selected ? "translateY(-2px)" : "translateY(0)",
        animation: selected
          ? "nexEmergencyCategoryGlow 1.4s ease-in-out infinite"
          : "none",
      }}
    >
      <img
        src={imageSrc}
        alt=""
        aria-hidden="true"
        width={120}
        height={120}
        style={{
          width: "100%",
          height: "auto",
          maxWidth: 160,
          display: "block",
          borderRadius: 10,
          imageRendering: "auto",
        }}
      />
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: selected
            ? EMERGENCY_PALETTE.textPrimary
            : EMERGENCY_PALETTE.textSecondary,
        }}
      >
        {label}
      </span>
    </button>
  );
}
