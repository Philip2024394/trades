"use client";

// Lobby + join handler. Routes the viewer by link kind + role:
//   · 1:1 link           → consume + redirect to peer chat with ?start_call
//   · Group link, creator → openGroupLinkCallAction → /call/g/{sessionId}
//   · Group link, guest, session exists → consume + join + /call/g/{sessionId}
//   · Group link, guest, session not yet open → "Waiting for host" state.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { consumeCallLinkAction } from "./_consume-call-link-action";
import { openGroupLinkCallAction } from "./_open-group-link-action";

interface JoinCallLinkClientProps {
  slug: string;
  creatorId: string;
  creatorName: string;
  creatorAvatarUrl: string | null;
  mediaType: "audio" | "video";
  maxUses: number;
  expiresAt: string | null;
  selfIsCreator: boolean;
}

const PAL = {
  bg: "#06091A",
  bg2: "#0B1024",
  card: "#121737",
  text: "#F2F5FA",
  textDim: "#A6ADC2",
  textMuted: "#6B7490",
  orange: "#FF8A2A",
  green: "#22C55E",
  greenSoft: "rgba(34,197,94,0.18)",
  blue: "#3B82F6",
  blueSoft: "rgba(59,130,246,0.18)",
  cardBorder: "rgba(255,255,255,0.08)",
};

export function JoinCallLinkClient(props: JoinCallLinkClientProps): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [waitingNotice, setWaitingNotice] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const isGroup = props.maxUses > 1;
  const tint = props.mediaType === "video" ? PAL.blue : PAL.green;
  const tintSoft = props.mediaType === "video" ? PAL.blueSoft : PAL.greenSoft;

  async function onJoin(): Promise<void> {
    if (busy) return;
    setErr(null);
    setWaitingNotice(null);

    // Creator of a group link opens the room directly.
    if (isGroup && props.selfIsCreator) {
      setBusy(true);
      const r = await openGroupLinkCallAction(props.slug);
      if (!r.ok) {
        setBusy(false);
        setErr(r.reason);
        return;
      }
      router.push(`/nex-native/call/g/${r.sessionId}`);
      return;
    }

    // Creator of a 1:1 link lands back on Calls.
    if (!isGroup && props.selfIsCreator) {
      router.push("/nex-native/calls");
      return;
    }

    setBusy(true);
    const result = await consumeCallLinkAction(props.slug);
    if (!result.ok) {
      setBusy(false);
      setErr(result.reason);
      return;
    }

    if (result.kind === "1:1") {
      router.push(
        `/nex-native/chat/peer/${result.creatorId}?start_call=${result.mediaType}`,
      );
      return;
    }
    if (result.kind === "group") {
      router.push(`/nex-native/call/g/${result.sessionId}`);
      return;
    }
    // group-waiting: creator hasn't opened the room yet.
    setBusy(false);
    setWaitingNotice(
      `${props.creatorName} hasn't opened the room yet. Refresh in a moment.`,
    );
  }

  const primaryLabel = (() => {
    if (busy) return "Opening…";
    if (props.selfIsCreator && isGroup) return "Open group call";
    if (props.selfIsCreator && !isGroup) return "Back to Calls";
    if (isGroup) return props.mediaType === "video" ? "Join group video call" : "Join group voice call";
    return props.mediaType === "video" ? "Join video call" : "Join voice call";
  })();

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: `linear-gradient(180deg, ${PAL.bg} 0%, ${PAL.bg2} 100%)`,
        color: PAL.text,
        display: "grid",
        placeItems: "center",
        padding: 24,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          padding: "28px 24px",
          borderRadius: 24,
          background: PAL.card,
          border: `1px solid ${PAL.cardBorder}`,
          textAlign: "center",
          boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
        }}
      >
        <div
          aria-hidden
          style={{
            margin: "0 auto 10px",
            fontSize: 10.5,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: PAL.orange,
            fontWeight: 700,
          }}
        >
          NEX · {isGroup ? "Group call link" : "Call link"}
        </div>
        <Avatar
          name={props.creatorName}
          avatarUrl={props.creatorAvatarUrl}
          tint={tint}
        />
        <h1
          style={{
            margin: "16px 0 4px",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "-0.005em",
          }}
        >
          {props.creatorName}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: PAL.textDim,
          }}
        >
          {isGroup
            ? props.selfIsCreator
              ? "This is your group call link"
              : `invites you to a group ${props.mediaType === "video" ? "video" : "voice"} call`
            : `wants to ${props.mediaType === "video" ? "video-call" : "voice-call"} you`}
        </p>
        {isGroup && (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 11.5,
              color: PAL.textMuted,
            }}
          >
            Up to {props.maxUses + 1} participants · mesh WebRTC
          </p>
        )}
        {props.expiresAt && (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 11,
              color: PAL.textMuted,
            }}
          >
            Link expires {formatExpiry(props.expiresAt)}
          </p>
        )}
        {waitingNotice && (
          <p
            style={{
              marginTop: 16,
              fontSize: 13,
              color: PAL.orange,
              lineHeight: 1.5,
            }}
          >
            {waitingNotice}
          </p>
        )}
        {err && (
          <p
            style={{
              marginTop: 16,
              fontSize: 13,
              color: "#FFB199",
              lineHeight: 1.5,
            }}
          >
            {err}
          </p>
        )}
        <div
          style={{
            marginTop: 22,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <button
            type="button"
            disabled={busy}
            onClick={() => void onJoin()}
            style={{
              padding: "14px 20px",
              borderRadius: 999,
              background: tintSoft,
              border: `1px solid ${tint}`,
              color: tint,
              fontSize: 15,
              fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.55 : 1,
              fontFamily: "inherit",
            }}
          >
            {primaryLabel}
          </button>
          {waitingNotice && (
            <button
              type="button"
              onClick={() => router.refresh()}
              style={{
                padding: "10px 20px",
                borderRadius: 999,
                background: "transparent",
                border: `1px solid ${PAL.orange}66`,
                color: PAL.orange,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Refresh
            </button>
          )}
          <Link
            href="/nex-native/calls"
            style={{
              padding: "12px 20px",
              borderRadius: 999,
              background: "transparent",
              border: `1px solid ${PAL.cardBorder}`,
              color: PAL.textDim,
              fontSize: 13.5,
              fontWeight: 600,
              textDecoration: "none",
              textAlign: "center",
              fontFamily: "inherit",
            }}
          >
            Not now
          </Link>
        </div>
      </div>
    </main>
  );
}

function Avatar({
  name,
  avatarUrl,
  tint,
}: {
  name: string;
  avatarUrl: string | null;
  tint: string;
}): React.JSX.Element {
  return (
    <div
      aria-hidden
      style={{
        margin: "0 auto",
        width: 92,
        height: 92,
        borderRadius: 999,
        background: avatarUrl ? "#000" : `linear-gradient(145deg, ${PAL.orange}66, ${tint}66)`,
        display: "grid",
        placeItems: "center",
        fontSize: 28,
        fontWeight: 800,
        color: PAL.text,
        overflow: "hidden",
        border: `3px solid ${tint}`,
        boxShadow: `0 0 24px ${tint}55`,
      }}
    >
      {avatarUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={avatarUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        initialsOf(name)
      )}
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "·";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function formatExpiry(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "soon";
  const h = Math.floor(diff / 3_600_000);
  if (h >= 24) return `in ${Math.floor(h / 24)}d`;
  if (h >= 1) return `in ${h}h`;
  const m = Math.floor(diff / 60_000);
  return `in ${Math.max(1, m)}m`;
}
