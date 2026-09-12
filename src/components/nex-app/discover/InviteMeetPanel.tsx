"use client";

// src/components/nex-app/discover/InviteMeetPanel.tsx
//
// NEX Social · invite-to-meet panel · Phase Social §15-§18 §22 §29
// Philip 2026-09-07
//
// Modal panel that opens when the user taps "Invite to Meet" on the
// Social Card. Three sequential states inside one component:
//
//   PICK   → user chooses one meeting type from the recipient's list
//   PENDING → invitation persisted · NEX mediates · shows simulated
//             Accept / Decline (§16 · until server persistence ships,
//             the recipient is simulated locally for the demo)
//   RESULT → shows "accepted → open Friends Chat" or "declined ·
//             closed silently"
//
// Truth discipline (§34):
//   · If the profile has no meeting_preferences, we surface an honest
//     "no meeting types shared" state instead of inventing choices
//   · Simulated recipient response is clearly labeled as such via a
//     "SIMULATED · v1" line so no reviewer thinks it's real backend
//
// Rights preserved:
//   · Save is done elsewhere (Social Card) · this panel is Invite only
//   · Chat only opens on Accept via onOpenFriendsChat callback

import { useMemo, useState } from "react";
import { X, Send, Check, MessageSquare } from "lucide-react";
import {
  findMeetingPreference,
  normaliseMeetingPreferences,
  type MeetingPreferenceId,
} from "@/lib/nex/social/meeting-preferences";
import {
  sendInvite,
  resolveInvite,
  type SocialProfileRef,
} from "@/lib/nex/social/social-store";

type Phase = "pick" | "pending" | "accepted" | "declined";

export type InviteMeetPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  profileRef: SocialProfileRef;
  /** Meeting types the recipient has declared they are open to. Empty
   *  = honest empty state (no invented options). */
  recipientMeetingPrefs: MeetingPreferenceId[];
  /** Fires only when the (simulated) recipient accepts. Parent should
   *  navigate to Friends Chat. */
  onOpenFriendsChat?: (friendId: string) => void;
};

export function InviteMeetPanel({
  isOpen, onClose, profileRef, recipientMeetingPrefs, onOpenFriendsChat,
}: InviteMeetPanelProps) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [choice, setChoice] = useState<MeetingPreferenceId | null>(null);

  const validPrefs = useMemo(
    () => normaliseMeetingPreferences(recipientMeetingPrefs).map((id) => findMeetingPreference(id)).filter((m): m is NonNullable<typeof m> => m !== null),
    [recipientMeetingPrefs],
  );

  if (!isOpen) return null;

  const send = () => {
    if (!choice) return;
    sendInvite(profileRef, choice);
    setPhase("pending");
  };

  // Simulated recipient response · clearly labeled as simulated in the
  // UI so it's never mistaken for real backend acceptance/decline.
  const simulateAccept = () => {
    const friend = resolveInvite(profileRef.id, "accepted");
    if (friend) setPhase("accepted");
  };
  const simulateDecline = () => {
    resolveInvite(profileRef.id, "declined");
    setPhase("declined");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Invite ${profileRef.first_name} to meet`}
      data-testid="nex-social-invite-panel"
      data-phase={phase}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 12,
      }}
      onClick={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          maxHeight: "92%",
          overflowY: "auto",
          background: "#0d0d13",
          borderRadius: 18,
          border: "1px solid rgba(150,180,220,0.14)",
          boxShadow: "0 24px 60px -12px rgba(0,0,0,0.65)",
          color: "#ffffff",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>Invite</div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.2, marginTop: 2 }}>
              {phase === "pick"     ? `Invite ${profileRef.first_name} to meet` :
               phase === "pending"  ? "Invitation sent" :
               phase === "accepted" ? `${profileRef.first_name} accepted` :
                                      "Invitation closed"}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              appearance: "none", background: "rgba(255,255,255,0.08)", border: "none",
              borderRadius: 999, width: 34, height: 34,
              display: "grid", placeItems: "center", color: "#fff", cursor: "pointer",
            }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* PICK phase · choose meeting type */}
        {phase === "pick" && (
          <div style={{ padding: "14px 16px 18px" }}>
            <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)", margin: "0 0 12px 0", lineHeight: 1.4 }}>
              Pick a meeting type. NEX will privately ask {profileRef.first_name} · they choose whether to accept.
            </p>
            {validPrefs.length === 0 ? (
              <div
                data-testid="nex-social-invite-empty-prefs"
                style={{
                  padding: "16px",
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 12,
                  fontSize: 12.5,
                  color: "rgba(255,255,255,0.55)",
                  textAlign: "center",
                }}
              >
                {profileRef.first_name} hasn&apos;t shared any first-meeting preferences yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {validPrefs.map((m) => {
                  const selected = choice === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setChoice(m.id)}
                      aria-pressed={selected}
                      data-testid={`nex-social-invite-choice-${m.id}`}
                      style={{
                        appearance: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        background: selected ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${selected ? "rgba(249,115,22,0.5)" : "rgba(255,255,255,0.08)"}`,
                        borderRadius: 10,
                        color: "#fff",
                        fontSize: 14,
                        fontWeight: 600,
                        letterSpacing: -0.1,
                        cursor: "pointer",
                        transition: "background 180ms ease, border-color 180ms ease",
                      }}
                    >
                      <span aria-hidden style={{ fontSize: 18 }}>{m.emoji}</span>
                      <span style={{ flex: 1, textAlign: "left" }}>{m.label}</span>
                      {selected && <Check size={16} strokeWidth={2.4} style={{ color: "#F97316" }} />}
                    </button>
                  );
                })}
              </div>
            )}

            {validPrefs.length > 0 && (
              <button
                type="button"
                onClick={send}
                disabled={!choice}
                data-testid="nex-social-invite-send"
                style={{
                  marginTop: 14,
                  width: "100%",
                  padding: "12px",
                  borderRadius: 12,
                  border: "none",
                  background: choice ? "linear-gradient(135deg,#F97316,#EA580C)" : "rgba(255,255,255,0.06)",
                  color: choice ? "#fff" : "rgba(255,255,255,0.35)",
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: 0.2,
                  cursor: choice ? "pointer" : "not-allowed",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: choice ? "0 8px 20px -6px rgba(249,115,22,0.5)" : "none",
                  transition: "background 180ms ease",
                }}
              >
                <Send size={14} strokeWidth={2.2} />
                Send invitation
              </button>
            )}
          </div>
        )}

        {/* PENDING phase · NEX mediates · v1 simulated recipient */}
        {phase === "pending" && (
          <div style={{ padding: "18px 16px" }}>
            <div style={{ padding: 14, background: "rgba(150,180,220,0.06)", borderRadius: 12, border: "1px solid rgba(150,180,220,0.14)", fontSize: 13, lineHeight: 1.5 }}>
              <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: "rgba(150,180,220,0.7)", fontWeight: 700, marginBottom: 6 }}>NEX</div>
              Your invitation to {profileRef.first_name} has been sent. When they respond, NEX will let you know.
            </div>
            <div style={{ marginTop: 14, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.4, color: "rgba(255,255,255,0.35)", fontWeight: 700 }}>
              Simulated · v1
            </div>
            <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)", margin: "4px 0 12px 0", lineHeight: 1.5 }}>
              Server persistence + real notifications ship in a later authorised slice. For this demo you can simulate the recipient&apos;s decision below.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                type="button"
                onClick={simulateAccept}
                data-testid="nex-social-invite-simulate-accept"
                style={{
                  padding: 10, borderRadius: 10, border: "1px solid rgba(34,197,94,0.35)",
                  background: "rgba(34,197,94,0.10)", color: "#4ade80",
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}
              >
                Simulate accept
              </button>
              <button
                type="button"
                onClick={simulateDecline}
                data-testid="nex-social-invite-simulate-decline"
                style={{
                  padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.75)",
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}
              >
                Simulate decline
              </button>
            </div>
          </div>
        )}

        {/* ACCEPTED phase · opens Friends Chat */}
        {phase === "accepted" && (
          <div style={{ padding: "18px 16px" }}>
            <div style={{ padding: 14, background: "rgba(34,197,94,0.08)", borderRadius: 12, border: "1px solid rgba(34,197,94,0.28)", fontSize: 13, lineHeight: 1.5 }}>
              <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: "rgba(74,222,128,0.9)", fontWeight: 700, marginBottom: 6 }}>NEX</div>
              {profileRef.first_name} accepted your invitation. Your Friends Chat is ready.
            </div>
            <button
              type="button"
              onClick={() => { onOpenFriendsChat?.(profileRef.id); onClose(); }}
              data-testid="nex-social-invite-open-chat"
              style={{
                marginTop: 14, width: "100%", padding: 12, borderRadius: 12,
                border: "none", background: "linear-gradient(135deg,#F97316,#EA580C)",
                color: "#fff", fontSize: 14, fontWeight: 700,
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                cursor: "pointer",
                boxShadow: "0 8px 20px -6px rgba(249,115,22,0.5)",
              }}
            >
              <MessageSquare size={14} strokeWidth={2.2} />
              Open Friends Chat
            </button>
          </div>
        )}

        {/* DECLINED phase · silent close */}
        {phase === "declined" && (
          <div style={{ padding: "18px 16px" }}>
            <div style={{ padding: 14, background: "rgba(255,255,255,0.04)", borderRadius: 12, fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.6)" }}>
              Invitation closed. No connection was created.
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                marginTop: 14, width: "100%", padding: 12, borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)",
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              Back to discover
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
