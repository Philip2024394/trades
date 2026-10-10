"use client";

// src/app/nex-native/family-safety/invite/_invite-client.tsx
//
// Invite flow · 3-step state machine · WebAuthn-gated.

import * as React from "react";
import { useRouter } from "next/navigation";
import { FAMILY_SAFETY_PALETTE as P } from "@/components/nex-native/family-safety/_palette";
import {
  createInvitationAction,
  type CreateInvitationActionArgs,
} from "@/lib/nex-native/family-links/_server-actions";
import type { FamilyRole } from "@/lib/nex-native/family-links/types";

type Step =
  | "collecting_identity"
  | "selecting_role"
  | "confirming"
  | "submitting"
  | "sent"
  | "error";

export interface InviteClientProps {
  readonly actorAccountId: string;
  readonly hasWebAuthn: boolean;
}

const ROLES: { value: FamilyRole; label: string; help: string }[] = [
  {
    value: "guardian_primary",
    label: "Primary guardian",
    help: "One active primary per child. Revocation goes through a 72-hour cooldown.",
  },
  {
    value: "guardian_secondary",
    label: "Secondary guardian",
    help: "A second trusted guardian. May be revoked at any time by either side.",
  },
  {
    value: "trusted_adult",
    label: "Trusted adult",
    help: "Non-guardian trusted connection. No special permissions in this pilot.",
  },
  {
    value: "mentor",
    label: "Mentor",
    help: "A non-family mentor. Reserved · no special permissions in this pilot.",
  },
];

export function InviteClient({
  actorAccountId,
  hasWebAuthn,
}: InviteClientProps): React.JSX.Element {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("collecting_identity");
  const [otherParty, setOtherParty] = React.useState("");
  const [role, setRole] = React.useState<FamilyRole>("guardian_secondary");
  const [intent, setIntent] = React.useState<"guardian_invite" | "child_invite">(
    "guardian_invite",
  );
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [sentLinkId, setSentLinkId] = React.useState<string | null>(null);

  // WebAuthn-missing block (decision D3 · 3A) · verbatim sealed copy.
  if (!hasWebAuthn) {
    return (
      <section
        role="region"
        aria-labelledby="webauthn-required-h2"
        data-testid="nex-fs-invite-webauthn-required"
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
        <h2
          id="webauthn-required-h2"
          style={{ margin: 0, fontSize: 18, color: P.textPrimary }}
        >
          A security key is required to invite a family member.
        </h2>
        <p style={{ margin: 0, color: P.textSecondary, lineHeight: 1.5 }}>
          We require a hardware or platform security key before any family link
          can be created. This protects the people you want to link to from
          impersonation.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            href="/nex-native/settings/security"
            data-testid="nex-fs-invite-add-security-key"
            style={{
              padding: "10px 16px",
              background: P.cyan,
              color: "#01121D",
              borderRadius: 10,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Add a security key in Settings
          </a>
          <button
            type="button"
            onClick={() => router.back()}
            data-testid="nex-fs-invite-cancel"
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
      </section>
    );
  }

  const otherTrimmed = otherParty.trim();
  const isSelf = otherTrimmed === actorAccountId;

  const canAdvanceToRole =
    otherTrimmed.length > 0 && !isSelf && step === "collecting_identity";

  const canSubmit =
    step === "confirming" && otherTrimmed.length > 0 && !isSelf;

  async function handleSubmit() {
    setStep("submitting");
    setErrorMsg(null);
    const args: CreateInvitationActionArgs = {
      otherPartyAccountId: otherTrimmed,
      role,
      initiatedBy: intent,
    };
    try {
      const result = await createInvitationAction(args);
      if (!result.ok) {
        setErrorMsg(result.reason ?? "unknown_error");
        setStep("error");
        return;
      }
      setSentLinkId(result.link.linkId);
      setStep("sent");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStep("error");
    }
  }

  // ─── sent ───────────────────────────────────────────────────────
  if (step === "sent" && sentLinkId) {
    return (
      <section
        role="region"
        aria-labelledby="sent-h2"
        data-testid="nex-fs-invite-sent"
        style={{
          padding: 20,
          background: P.surface,
          border: `1px solid ${P.familyGreenBorder}`,
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h2 id="sent-h2" style={{ margin: 0, fontSize: 18 }}>
          Invitation sent
        </h2>
        <p style={{ margin: 0, color: P.textSecondary, lineHeight: 1.5 }}>
          The other party has 72 hours to accept. They can accept, decline, or
          report pressure. No one else is notified.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            href={`/nex-native/family-safety/link/${sentLinkId}`}
            data-testid="nex-fs-invite-sent-view"
            style={{
              padding: "10px 16px",
              background: P.familyGreen,
              color: "#02200F",
              borderRadius: 10,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            View this link
          </a>
          <a
            href="/nex-native/family-safety/manage"
            style={{
              padding: "10px 16px",
              background: "transparent",
              color: P.textPrimary,
              borderRadius: 10,
              border: `1px solid ${P.divider}`,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Back to Manage
          </a>
        </div>
      </section>
    );
  }

  // ─── error ───────────────────────────────────────────────────────
  if (step === "error") {
    const copy = mapErrorReasonToCopy(errorMsg ?? "unknown_error");
    return (
      <section
        role="alert"
        data-testid="nex-fs-invite-error"
        data-nex-fs-invite-error-reason={errorMsg ?? "unknown_error"}
        style={{
          padding: 20,
          background: P.surface,
          border: `1px solid ${P.emergencyBorder}`,
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, color: P.emergency }}>
          {copy.title}
        </h2>
        <p style={{ margin: 0, color: P.textSecondary, lineHeight: 1.5 }}>
          {copy.body}
        </p>
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            setStep("confirming");
          }}
          style={{
            padding: "10px 16px",
            background: P.surfaceHi,
            color: P.textPrimary,
            borderRadius: 10,
            border: `1px solid ${P.divider}`,
            fontWeight: 600,
            cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          Try again
        </button>
      </section>
    );
  }

  // ─── wizard ──────────────────────────────────────────────────────
  return (
    <form
      aria-labelledby="invite-flow-h2"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === "collecting_identity" && canAdvanceToRole) {
          setStep("selecting_role");
        } else if (step === "selecting_role") {
          setStep("confirming");
        } else if (step === "confirming" && canSubmit) {
          void handleSubmit();
        }
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 20,
        background: P.surface,
        border: `1px solid ${P.divider}`,
        borderRadius: 14,
      }}
    >
      <h2 id="invite-flow-h2" style={{ margin: 0, fontSize: 18 }}>
        {stepTitle(step)}
      </h2>

      {step === "collecting_identity" && (
        <>
          <p style={{ margin: 0, color: P.textSecondary, lineHeight: 1.5 }}>
            Enter the NEX account id of the person you want to link with. We
            do not look up names or email · you need the account id (shown in
            Settings · Profile).
          </p>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, color: P.textSecondary }}>
              Who are you inviting?
            </span>
            <input
              type="text"
              value={otherParty}
              onChange={(e) => setOtherParty(e.target.value)}
              data-testid="nex-fs-invite-other-party"
              placeholder="account id"
              style={{
                padding: "10px 12px",
                background: P.surfaceMuted,
                border: `1px solid ${P.divider}`,
                borderRadius: 10,
                color: P.textPrimary,
                fontSize: 14,
              }}
            />
            {isSelf && (
              <span
                role="alert"
                data-testid="nex-fs-invite-self-error"
                style={{ color: P.emergency, fontSize: 13 }}
              >
                You cannot be your own guardian or ward.
              </span>
            )}
          </label>
          <fieldset
            style={{
              border: `1px solid ${P.divider}`,
              borderRadius: 10,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              margin: 0,
            }}
          >
            <legend style={{ padding: "0 6px", color: P.textSecondary, fontSize: 13 }}>
              Direction
            </legend>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="radio"
                name="intent"
                checked={intent === "guardian_invite"}
                onChange={() => setIntent("guardian_invite")}
                data-testid="nex-fs-invite-intent-guardian"
              />
              <span>I am the guardian · I am inviting the other person</span>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="radio"
                name="intent"
                checked={intent === "child_invite"}
                onChange={() => setIntent("child_invite")}
                data-testid="nex-fs-invite-intent-child"
              />
              <span>I am the ward · I am asking the other person to be my guardian</span>
            </label>
          </fieldset>
          <button
            type="submit"
            disabled={!canAdvanceToRole}
            data-testid="nex-fs-invite-step1-next"
            style={primaryBtn(!canAdvanceToRole)}
          >
            Next · pick a role
          </button>
        </>
      )}

      {step === "selecting_role" && (
        <>
          <p style={{ margin: 0, color: P.textSecondary, lineHeight: 1.5 }}>
            Pick the role that best fits this relationship. Permissions are
            default-closed in this pilot · roles mostly affect revocation
            rules.
          </p>
          <fieldset
            style={{
              border: `1px solid ${P.divider}`,
              borderRadius: 10,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              margin: 0,
            }}
          >
            <legend style={{ padding: "0 6px", color: P.textSecondary, fontSize: 13 }}>
              Role
            </legend>
            {ROLES.map((r) => (
              <label
                key={r.value}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  padding: 10,
                  borderRadius: 10,
                  background:
                    role === r.value ? P.cyanMuted : "transparent",
                  border: `1px solid ${role === r.value ? P.cyanBorder : "transparent"}`,
                }}
              >
                <input
                  type="radio"
                  name="role"
                  checked={role === r.value}
                  onChange={() => setRole(r.value)}
                  data-testid={`nex-fs-invite-role-${r.value}`}
                  style={{ marginTop: 2 }}
                />
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <strong style={{ color: P.textPrimary }}>{r.label}</strong>
                  <span style={{ color: P.textSecondary, fontSize: 13 }}>
                    {r.help}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setStep("collecting_identity")}
              style={secondaryBtn()}
            >
              Back
            </button>
            <button
              type="submit"
              data-testid="nex-fs-invite-step2-next"
              style={primaryBtn(false)}
            >
              Next · review
            </button>
          </div>
        </>
      )}

      {(step === "confirming" || step === "submitting") && (
        <>
          <p style={{ margin: 0, color: P.textSecondary, lineHeight: 1.5 }}>
            Review your invitation before sending. The other party must
            confirm with their own security key. You can revoke the invitation
            at any time.
          </p>
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
            <dt style={{ color: P.textSecondary }}>You are:</dt>
            <dd
              style={{ margin: 0 }}
              data-testid="nex-fs-invite-review-direction"
            >
              {intent === "guardian_invite" ? "guardian" : "ward"}
            </dd>
            <dt style={{ color: P.textSecondary }}>Other party:</dt>
            <dd style={{ margin: 0 }} data-testid="nex-fs-invite-review-other">
              {otherTrimmed}
            </dd>
            <dt style={{ color: P.textSecondary }}>Role on this link:</dt>
            <dd style={{ margin: 0 }} data-testid="nex-fs-invite-review-role">
              {role.replace("_", " ")}
            </dd>
          </dl>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setStep("selecting_role")}
              disabled={step === "submitting"}
              style={secondaryBtn()}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={step === "submitting"}
              data-testid="nex-fs-invite-submit"
              style={primaryBtn(step === "submitting")}
            >
              {step === "submitting" ? "Sending…" : "Send invitation"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

function stepTitle(step: Step): string {
  switch (step) {
    case "collecting_identity":
      return "Step 1 · who are you inviting?";
    case "selecting_role":
      return "Step 2 · which role?";
    case "confirming":
    case "submitting":
      return "Step 3 · review and send";
    default:
      return "";
  }
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 16px",
    background: disabled ? P.divider : P.orange,
    color: disabled ? P.textDim : "#1A1300",
    borderRadius: 10,
    border: "none",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
  };
}
function secondaryBtn(): React.CSSProperties {
  return {
    padding: "10px 16px",
    background: "transparent",
    color: P.textPrimary,
    borderRadius: 10,
    border: `1px solid ${P.divider}`,
    fontWeight: 600,
    cursor: "pointer",
  };
}

function mapErrorReasonToCopy(reason: string): {
  title: string;
  body: string;
} {
  switch (reason) {
    case "webauthn_required":
      return {
        title: "Security key required",
        body:
          "Add a security key in Settings before sending an invitation. This protects the person you are inviting from impersonation.",
      };
    case "primary_guardian_already_exists":
      return {
        title: "They already have a primary guardian",
        body:
          "Only one primary guardian per child at a time. Choose Secondary guardian instead, or ask the current primary to revoke their link first.",
      };
    case "self_link_forbidden":
      return {
        title: "You can't be your own guardian",
        body: "Enter a different account id.",
      };
    case "unauthorized_actor":
      return {
        title: "You are not permitted to send this invitation",
        body: "You can only initiate links where you are a party.",
      };
    case "db_unavailable":
      return {
        title: "Family Links is temporarily unavailable",
        body: "Try again shortly.",
      };
    default:
      return {
        title: "Something went wrong",
        body: "Please try again.",
      };
  }
}
