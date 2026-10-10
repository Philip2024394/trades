// src/components/nex-native/emergency/ResponderOptInForm.tsx
//
// Responder opt-in management · sealed 2026-10-10.
// -------------------------------------------------
// Load-bearing invariants:
//   · Opt-in is EXPLICIT. The user must tick "I have read the safety
//     guidance" before the button becomes enabled. No implicit opt-in
//     from any other NEX flow.
//   · Opt-out always works · the "Opt out" button is never gated.
//   · Safety guidance is visible BEFORE the opt-in checkbox.

"use client";

import * as React from "react";
import { EMERGENCY_PALETTE } from "./_palette";
import { SimulatedBadge } from "./SimulatedBadge";
import type { EmergencyResponderOptIn } from "./types";

export interface ResponderOptInFormProps {
  initialOptIn: EmergencyResponderOptIn | null;
  services: {
    optIn: (args: { radiusKm: number }) => Promise<EmergencyResponderOptIn>;
    optOut: () => Promise<{ ok: true }>;
  };
  simulated?: boolean;
}

const DEFAULT_RADIUS = 5;
const MIN_RADIUS = 1;
const MAX_RADIUS = 25;

export function ResponderOptInForm({
  initialOptIn,
  services,
  simulated = true,
}: ResponderOptInFormProps): React.JSX.Element {
  const [optIn, setOptIn] = React.useState<EmergencyResponderOptIn | null>(
    initialOptIn,
  );
  const [acknowledged, setAcknowledged] = React.useState(!!initialOptIn);
  const [radiusKm, setRadiusKm] = React.useState<number>(
    initialOptIn?.radiusKm ?? DEFAULT_RADIUS,
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleOptIn = React.useCallback(async () => {
    if (!acknowledged) return;
    setBusy(true);
    setError(null);
    try {
      const result = await services.optIn({ radiusKm });
      setOptIn(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opt-in failed.");
    } finally {
      setBusy(false);
    }
  }, [acknowledged, services, radiusKm]);

  const handleOptOut = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await services.optOut();
      setOptIn(null);
      setAcknowledged(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opt-out failed.");
    } finally {
      setBusy(false);
    }
  }, [services]);

  return (
    <section
      data-testid="nex-emergency-responder-form"
      style={{
        padding: 20,
        background: EMERGENCY_PALETTE.surface,
        border: `1px solid ${EMERGENCY_PALETTE.divider}`,
        borderRadius: 14,
        color: EMERGENCY_PALETTE.textPrimary,
      }}
    >
      <SimulatedBadge live={!simulated} />
      <h2
        style={{
          margin: "14px 0 6px",
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        Become a NEX Emergency Responder
      </h2>

      <div
        aria-label="safety guidance"
        data-testid="nex-emergency-safety-guidance"
        style={{
          marginTop: 10,
          padding: 14,
          background: EMERGENCY_PALETTE.cyanMuted,
          border: `1px solid rgba(0,175,255,0.35)`,
          borderRadius: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: EMERGENCY_PALETTE.cyan,
          }}
        >
          Safety guidance
        </div>
        <ul
          style={{
            margin: "8px 0 0",
            paddingLeft: 18,
            fontSize: 13,
            color: EMERGENCY_PALETTE.textSecondary,
            lineHeight: 1.55,
          }}
        >
          <li>
            Only respond if you can safely reach the location. Your safety
            comes first.
          </li>
          <li>
            For medical, fire, violent-crime or severe emergencies call
            your local emergency number (112, 911, 119) · do not rely on
            NEX.
          </li>
          <li>
            NEX responders provide companionship, directions, and small
            help · not professional rescue.
          </li>
          <li>
            You can withdraw an acceptance at any time if the situation
            changes. "Can&apos;t help" is never judged.
          </li>
        </ul>
      </div>

      {optIn ? (
        <div
          data-testid="nex-emergency-opted-in-state"
          style={{
            marginTop: 16,
            padding: 14,
            background: EMERGENCY_PALETTE.cyanMuted,
            border: `1px solid rgba(0,175,255,0.35)`,
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: EMERGENCY_PALETTE.cyan,
            }}
          >
            You are opted in · radius {optIn.radiusKm} km
          </div>
          <label
            style={{
              display: "block",
              marginTop: 12,
              fontSize: 13,
              color: EMERGENCY_PALETTE.textSecondary,
            }}
          >
            Update radius
            <input
              type="range"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              step={1}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              data-testid="nex-emergency-radius-input"
              style={{ display: "block", width: "100%", marginTop: 8 }}
            />
            <span style={{ fontSize: 12, color: EMERGENCY_PALETTE.textPrimary }}>
              {radiusKm} km
            </span>
          </label>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button
              type="button"
              onClick={handleOptIn}
              disabled={busy}
              data-testid="nex-emergency-update-radius"
              style={cyanButton}
            >
              {busy ? "Saving…" : "Save radius"}
            </button>
            <button
              type="button"
              onClick={handleOptOut}
              disabled={busy}
              data-testid="nex-emergency-opt-out"
              style={ghostButton}
            >
              Opt out
            </button>
          </div>
        </div>
      ) : (
        <>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              marginTop: 16,
              fontSize: 13,
              color: EMERGENCY_PALETTE.textPrimary,
              lineHeight: 1.5,
            }}
          >
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              data-testid="nex-emergency-safety-ack"
            />
            <span>
              I have read the safety guidance and understand this is a
              volunteer safety-network role · not professional rescue.
            </span>
          </label>

          <label
            style={{
              display: "block",
              marginTop: 16,
              fontSize: 13,
              color: EMERGENCY_PALETTE.textSecondary,
            }}
          >
            Response radius ({MIN_RADIUS}–{MAX_RADIUS} km)
            <input
              type="range"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              step={1}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              data-testid="nex-emergency-radius-input"
              style={{ display: "block", width: "100%", marginTop: 8 }}
            />
            <span style={{ fontSize: 12, color: EMERGENCY_PALETTE.textPrimary }}>
              {radiusKm} km
            </span>
          </label>

          <button
            type="button"
            onClick={handleOptIn}
            disabled={!acknowledged || busy}
            data-testid="nex-emergency-opt-in"
            style={{
              ...cyanButton,
              marginTop: 18,
              opacity: !acknowledged || busy ? 0.5 : 1,
              cursor: !acknowledged || busy ? "default" : "pointer",
            }}
          >
            {busy ? "Enrolling…" : "Opt in"}
          </button>
        </>
      )}

      {error ? (
        <p
          role="alert"
          data-testid="nex-emergency-responder-error"
          style={{
            marginTop: 12,
            padding: 10,
            background: EMERGENCY_PALETTE.emergencyMuted,
            border: `1px solid ${EMERGENCY_PALETTE.emergencyBorder}`,
            borderRadius: 10,
            fontSize: 13,
            color: EMERGENCY_PALETTE.textPrimary,
          }}
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}

const cyanButton: React.CSSProperties = {
  padding: "12px 18px",
  background: EMERGENCY_PALETTE.cyan,
  color: EMERGENCY_PALETTE.bg,
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const ghostButton: React.CSSProperties = {
  padding: "12px 18px",
  background: "transparent",
  color: EMERGENCY_PALETTE.textPrimary,
  border: `1px solid ${EMERGENCY_PALETTE.divider}`,
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};
