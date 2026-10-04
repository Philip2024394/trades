"use client";

// Lobby + join handler. 1:1 (max_uses=1) → consume + redirect to the
// creator's peer chat with ?start_call. Group (max_uses > 1) still
// shows a honest "group calls land in phase 3" notice.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { consumeCallLinkAction } from "./_consume-call-link-action";

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
  const [err, setErr] = React.useState<string | null>(null);

  const isGroup = props.maxUses > 1;
  const tint = props.mediaType === "video" ? PAL.blue : PAL.green;
  const tintSoft = props.mediaType === "video" ? PAL.blueSoft : PAL.greenSoft;

  async function onJoin(): Promise<void> {
    if (busy) return;
    setErr(null);
    if (props.selfIsCreator) {
      // Creator opened their own link · just send them to Calls hub.
      router.push("/nex-native/calls");
      return;
    }
    if (isGroup) {
      // Group link flow lands in phase 3 · intentional guard here.
      setErr(
        "Group calls are still being built. Ask the creator to send a 1:1 link, or try again soon.",
      );
      return;
    }
    setBusy(true);
    const result = await consumeCallLinkAction(props.slug);
    if (!result.ok) {
      setBusy(false);
      setErr(result.reason);
      return;
    }
    // Redirect into the real peer chat · the ?start_call deep-link
    // is picked up by _call-launcher.tsx and dials the creator.
    router.push(
      `/nex-native/chat/peer/${props.creatorId}?start_call=${props.mediaType}`,
    );
  }

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
          NEX · Call link
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
          wants to {props.mediaType === "video" ? "video-call" : "voice-call"} you
        </p>
        {props.selfIsCreator && (
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 12,
              color: PAL.textMuted,
              fontStyle: "italic",
            }}
          >
            You created this link. Send it to someone to call you.
          </p>
        )}
        {isGroup && !props.selfIsCreator && (
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 12,
              color: PAL.textMuted,
              lineHeight: 1.5,
            }}
          >
            Group call · up to {props.maxUses} participants (coming later).
          </p>
        )}
        {props.expiresAt && !props.selfIsCreator && (
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
            disabled={busy || (isGroup && !props.selfIsCreator)}
            onClick={() => void onJoin()}
            style={{
              padding: "14px 20px",
              borderRadius: 999,
              background: tintSoft,
              border: `1px solid ${tint}`,
              color: tint,
              fontSize: 15,
              fontWeight: 700,
              cursor:
                busy || (isGroup && !props.selfIsCreator)
                  ? "not-allowed"
                  : "pointer",
              opacity: busy || (isGroup && !props.selfIsCreator) ? 0.55 : 1,
              fontFamily: "inherit",
            }}
          >
            {busy
              ? "Joining…"
              : props.selfIsCreator
                ? "Back to Calls"
                : props.mediaType === "video"
                  ? "Join video call"
                  : "Join voice call"}
          </button>
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
