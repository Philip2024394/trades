// src/components/nex-native/family-safety/ChildIdentityForm.tsx
//
// NEX Family Safety · wizard step 1 form · authored 2026-10-10.
// -------------------------------------------------------------
// Client component. Collects:
//   · Child display name (3-60 chars · trimmed)
//   · Child date of birth (yyyy-mm-dd · ≥ 1 day ago AND ≤ 16 years ago)
//
// Submits to a server action passed in via `onSubmit`. The parent page
// awaits the result + routes to step 2.
//
// Load-bearing anti-patterns:
//   · Do NOT echo the child's name back in a validation error · we
//     report the field name only, not the value, so error logs don't
//     leak PII.
//   · Do NOT persist the form state to localStorage · if the parent
//     refreshes mid-wizard they re-enter. This is intentional for a
//     safety product.

"use client";

import * as React from "react";
import { FAMILY_SAFETY_PALETTE } from "./_palette";

export interface ChildIdentityFormValue {
  readonly childDisplayName: string;
  readonly childDeclaredDateOfBirth: string;
}

export interface ChildIdentityFormProps {
  readonly onSubmit: (value: ChildIdentityFormValue) => Promise<void>;
  readonly disabled?: boolean;
}

function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 3) return "Name must be at least 3 characters.";
  if (trimmed.length > 60) return "Name must be 60 characters or fewer.";
  return null;
}

function validateDob(dob: string): string | null {
  if (!dob) return "Please enter a date of birth.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    return "Please use the yyyy-mm-dd date format.";
  }
  const d = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "Please enter a valid date.";
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (d.getTime() > oneDayAgo.getTime()) {
    return "Date of birth must be in the past.";
  }
  const sixteenYearsAgo = new Date(now.getTime());
  sixteenYearsAgo.setUTCFullYear(now.getUTCFullYear() - 16);
  if (d.getTime() < sixteenYearsAgo.getTime()) {
    return "Family Safety is for children under 16. Please check the date.";
  }
  return null;
}

export function ChildIdentityForm({
  onSubmit,
  disabled,
}: ChildIdentityFormProps): React.JSX.Element {
  const [name, setName] = React.useState("");
  const [dob, setDob] = React.useState("");
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [dobError, setDobError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const n = validateName(name);
    const d = validateDob(dob);
    setNameError(n);
    setDobError(d);
    if (n || d) return;
    setBusy(true);
    try {
      await onSubmit({
        childDisplayName: name.trim(),
        childDeclaredDateOfBirth: dob,
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : "Unknown";
      // Honest, non-echoing error.
      setSubmitError(
        code === "INVALID_CHILD_DISPLAY_NAME"
          ? "Please check the name field and try again."
          : code === "INVALID_CHILD_DATE_OF_BIRTH"
          ? "Please check the date of birth and try again."
          : "Could not save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: FAMILY_SAFETY_PALETTE.textSecondary,
    marginBottom: 6,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    background: FAMILY_SAFETY_PALETTE.surface,
    border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
    borderRadius: 10,
    color: FAMILY_SAFETY_PALETTE.textPrimary,
    fontSize: 14,
    outline: "none",
  };
  const errorStyle: React.CSSProperties = {
    marginTop: 6,
    color: FAMILY_SAFETY_PALETTE.emergency,
    fontSize: 12,
    fontWeight: 600,
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-nex-family-safety-child-identity-form="true"
      aria-label="Child identity details"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: 16,
        background: FAMILY_SAFETY_PALETTE.surfaceMuted,
        border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
        borderRadius: 14,
      }}
    >
      <div>
        <label htmlFor="nex-fs-child-name" style={labelStyle}>
          Child's display name
        </label>
        <input
          id="nex-fs-child-name"
          type="text"
          autoComplete="off"
          required
          minLength={3}
          maxLength={60}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(null);
          }}
          disabled={disabled || busy}
          aria-invalid={nameError ? "true" : "false"}
          aria-describedby={nameError ? "nex-fs-child-name-error" : undefined}
          data-testid="nex-fs-child-name-input"
          style={inputStyle}
        />
        {nameError ? (
          <div id="nex-fs-child-name-error" role="alert" style={errorStyle}>
            {nameError}
          </div>
        ) : null}
        <p
          style={{
            fontSize: 11,
            color: FAMILY_SAFETY_PALETTE.textDim,
            marginTop: 6,
          }}
        >
          Shown on the child's NEX account. 3-60 characters.
        </p>
      </div>

      <div>
        <label htmlFor="nex-fs-child-dob" style={labelStyle}>
          Child's date of birth
        </label>
        <input
          id="nex-fs-child-dob"
          type="date"
          required
          value={dob}
          onChange={(e) => {
            setDob(e.target.value);
            setDobError(null);
          }}
          disabled={disabled || busy}
          aria-invalid={dobError ? "true" : "false"}
          aria-describedby={dobError ? "nex-fs-child-dob-error" : undefined}
          data-testid="nex-fs-child-dob-input"
          style={inputStyle}
        />
        {dobError ? (
          <div id="nex-fs-child-dob-error" role="alert" style={errorStyle}>
            {dobError}
          </div>
        ) : null}
        <p
          style={{
            fontSize: 11,
            color: FAMILY_SAFETY_PALETTE.textDim,
            marginTop: 6,
          }}
        >
          Must be under 16 years old. NEX will confirm using the government ID
          in the next step.
        </p>
      </div>

      {submitError ? (
        <div role="alert" style={errorStyle}>
          {submitError}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="submit"
          disabled={disabled || busy}
          data-testid="nex-fs-child-identity-submit"
          style={{
            padding: "10px 16px",
            background: FAMILY_SAFETY_PALETTE.familyGreen,
            color: "#02141F",
            fontWeight: 700,
            borderRadius: 10,
            border: "none",
            fontSize: 14,
            cursor: busy ? "wait" : "pointer",
            opacity: disabled || busy ? 0.7 : 1,
          }}
        >
          {busy ? "Saving…" : "Continue → Document"}
        </button>
      </div>
    </form>
  );
}
