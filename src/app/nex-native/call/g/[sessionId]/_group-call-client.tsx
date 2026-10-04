"use client";

// Group-call grid UI. Spins up the mesh engine, renders a 1-2-3-4
// tile grid of participants + a local PIP, exposes mute/camera/leave
// controls. Reuses the colour language of the Calls page.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GroupCallEngine, type GroupPresenceMember, type GroupRemoteStream } from "@/lib/nex-native/calls/group-call-engine";
import {
  joinGroupCallAction,
  leaveGroupCallAction,
  endGroupCallAction,
} from "./_group-actions";

interface Participant {
  accountId: string;
  displayName: string;
  avatarUrl: string | null;
}

interface GroupCallClientProps {
  sessionId: string;
  selfAccountId: string;
  selfDisplayName: string;
  mediaType: "audio" | "video";
  isHost: boolean;
  hostName: string;
  hostAvatarUrl: string | null;
  participantAccounts: Participant[];
}

const PAL = {
  bg: "#06091A",
  bg2: "#0B1024",
  card: "#121737",
  cardBorder: "rgba(255,255,255,0.08)",
  text: "#F2F5FA",
  textDim: "#A6ADC2",
  textMuted: "#6B7490",
  orange: "#FF8A2A",
  green: "#22C55E",
  greenSoft: "rgba(34,197,94,0.18)",
  blue: "#3B82F6",
  blueSoft: "rgba(59,130,246,0.18)",
  red: "#EF4444",
  redSoft: "rgba(239,68,68,0.18)",
};

export function GroupCallClient(props: GroupCallClientProps): React.JSX.Element {
  const router = useRouter();
  const engineRef = React.useRef<GroupCallEngine | null>(null);
  const [status, setStatus] = React.useState<string>("Connecting…");
  const [localStream, setLocalStream] = React.useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = React.useState<GroupRemoteStream[]>([]);
  const [members, setMembers] = React.useState<GroupPresenceMember[]>([]);
  const [muted, setMuted] = React.useState(false);
  const [cameraOff, setCameraOff] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [joined, setJoined] = React.useState(false);

  // Enrich members with display/avatar from server props.
  const participantMap = React.useMemo(() => {
    const map = new Map<string, Participant>();
    for (const p of props.participantAccounts) map.set(p.accountId, p);
    return map;
  }, [props.participantAccounts]);

  const nameOf = React.useCallback(
    (id: string): string => {
      if (id === props.selfAccountId) return props.selfDisplayName;
      return participantMap.get(id)?.displayName ?? "NEX user";
    },
    [participantMap, props.selfAccountId, props.selfDisplayName],
  );
  const avatarOf = React.useCallback(
    (id: string): string | null => participantMap.get(id)?.avatarUrl ?? null,
    [participantMap],
  );

  // Join session (DB) → start engine (presence + media).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await joinGroupCallAction(props.sessionId);
      if (cancelled) return;
      if (!r.ok) {
        setErr(r.reason);
        return;
      }
      setJoined(true);
      const engine = new GroupCallEngine({
        sessionId: props.sessionId,
        selfAccountId: props.selfAccountId,
        selfDisplayName: props.selfDisplayName,
        mediaType: props.mediaType,
        handlers: {
          onStateChange: (s) => {
            if (s === "requesting-media") setStatus("Requesting camera & mic…");
            if (s === "connecting") setStatus("Waiting for others…");
            if (s === "live") setStatus("Live");
            if (s === "ended") setStatus("Ended");
          },
          onLocalStream: (stream) => setLocalStream(stream),
          onRemoteStreams: (streams) => setRemoteStreams(streams),
          onPresenceChange: (m) => setMembers(m),
          onError: (msg) => setErr(msg),
        },
      });
      engineRef.current = engine;
      await engine.start();
    })();
    return () => {
      cancelled = true;
      const e = engineRef.current;
      engineRef.current = null;
      if (e) void e.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sessionId]);

  async function onLeave(): Promise<void> {
    const e = engineRef.current;
    engineRef.current = null;
    if (e) await e.leave();
    await leaveGroupCallAction(props.sessionId);
    router.push("/nex-native/calls");
  }

  async function onEndForAll(): Promise<void> {
    const e = engineRef.current;
    engineRef.current = null;
    if (e) await e.leave();
    await endGroupCallAction(props.sessionId);
    router.push("/nex-native/calls");
  }

  function onToggleMute(): void {
    const next = !muted;
    setMuted(next);
    engineRef.current?.setMuted(next);
  }
  function onToggleCamera(): void {
    const next = !cameraOff;
    setCameraOff(next);
    engineRef.current?.setCameraOff(next);
  }

  // Tiles: local PIP (self) + one per remote peer with a stream.
  // Participants who are in the roster but haven't attached video yet
  // show a static avatar tile.
  const otherAccountIds = Array.from(new Set([
    ...members.filter((m) => m.accountId !== props.selfAccountId).map((m) => m.accountId),
    ...remoteStreams.map((rs) => rs.accountId),
  ]));
  const streamByAccount = new Map<string, MediaStream>();
  for (const rs of remoteStreams) streamByAccount.set(rs.accountId, rs.stream);

  if (err) {
    return (
      <main style={rootStyle}>
        <div style={errorCardStyle}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Call unavailable</h1>
          <p style={{ margin: "10px 0 20px", fontSize: 13.5, color: PAL.textDim }}>
            {err}
          </p>
          <Link href="/nex-native/calls" style={backBtnStyle}>
            Back to Calls
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={rootStyle}>
      <TopBar
        title={props.mediaType === "video" ? "Group video call" : "Group voice call"}
        status={status}
        participantCount={1 + otherAccountIds.length}
      />
      <Grid
        tiles={[
          <SelfTile
            key="self"
            name={props.selfDisplayName}
            avatarUrl={avatarOf(props.selfAccountId) ?? props.hostAvatarUrl}
            stream={localStream}
            cameraOff={cameraOff}
            mediaType={props.mediaType}
            muted={muted}
          />,
          ...otherAccountIds.map((id) => (
            <RemoteTile
              key={id}
              name={nameOf(id)}
              avatarUrl={avatarOf(id)}
              stream={streamByAccount.get(id) ?? null}
              mediaType={props.mediaType}
            />
          )),
        ]}
      />
      <Controls
        mediaType={props.mediaType}
        muted={muted}
        cameraOff={cameraOff}
        isHost={props.isHost}
        onMute={onToggleMute}
        onCamera={onToggleCamera}
        onLeave={() => void onLeave()}
        onEndForAll={() => void onEndForAll()}
        joined={joined}
      />
    </main>
  );
}

/* ─── Pieces ────────────────────────────────────────────────────── */

function TopBar({
  title,
  status,
  participantCount,
}: {
  title: string;
  status: string;
  participantCount: number;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 18px",
      }}
    >
      <div>
        <div style={{ fontSize: 11, letterSpacing: "0.18em", color: PAL.orange, textTransform: "uppercase", fontWeight: 700 }}>
          NEX
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: PAL.text, marginTop: 2 }}>
          {title}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 11.5, color: PAL.textDim }}>{status}</div>
        <div style={{ fontSize: 11, color: PAL.textMuted, marginTop: 2 }}>
          {participantCount}/4 participants
        </div>
      </div>
    </div>
  );
}

function Grid({ tiles }: { tiles: React.ReactNode[] }): React.JSX.Element {
  const count = tiles.length;
  const cols = count <= 1 ? 1 : 2;
  const rows = count <= 2 ? 1 : 2;
  return (
    <div
      style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 6,
        padding: "0 10px 10px",
      }}
    >
      {tiles}
    </div>
  );
}

function SelfTile({
  name,
  avatarUrl,
  stream,
  cameraOff,
  mediaType,
  muted,
}: {
  name: string;
  avatarUrl: string | null;
  stream: MediaStream | null;
  cameraOff: boolean;
  mediaType: "audio" | "video";
  muted: boolean;
}): React.JSX.Element {
  const showVideo = mediaType === "video" && stream && !cameraOff;
  return (
    <TileShell>
      {showVideo ? (
        <VideoEl stream={stream!} muted />
      ) : (
        <AvatarFill name={name} avatarUrl={avatarUrl} />
      )}
      <TileLabel name={`${name} (you)`} muted={muted} />
    </TileShell>
  );
}

function RemoteTile({
  name,
  avatarUrl,
  stream,
  mediaType,
}: {
  name: string;
  avatarUrl: string | null;
  stream: MediaStream | null;
  mediaType: "audio" | "video";
}): React.JSX.Element {
  const showVideo = mediaType === "video" && stream;
  return (
    <TileShell>
      {showVideo ? (
        <VideoEl stream={stream!} />
      ) : (
        <AvatarFill name={name} avatarUrl={avatarUrl} />
      )}
      <TileLabel name={stream ? name : `${name} · connecting…`} />
    </TileShell>
  );
}

function TileShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        position: "relative",
        background: PAL.card,
        border: `1px solid ${PAL.cardBorder}`,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function TileLabel({ name, muted }: { name: string; muted?: boolean }): React.JSX.Element {
  return (
    <div
      style={{
        position: "absolute",
        left: 10,
        bottom: 10,
        padding: "4px 10px",
        borderRadius: 999,
        background: "rgba(6,9,26,0.72)",
        color: PAL.text,
        fontSize: 11.5,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {muted ? <MuteDot /> : null}
      <span>{name}</span>
    </div>
  );
}

function MuteDot(): React.JSX.Element {
  return (
    <span
      aria-hidden
      style={{
        width: 14,
        height: 14,
        borderRadius: 999,
        background: PAL.red,
        display: "grid",
        placeItems: "center",
        color: "#fff",
        fontSize: 9,
        fontWeight: 800,
      }}
    >
      /
    </span>
  );
}

function AvatarFill({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}): React.JSX.Element {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        background: avatarUrl ? "#000" : `linear-gradient(145deg, ${PAL.orange}44, ${PAL.blue}44)`,
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
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            color: PAL.text,
            display: "grid",
            placeItems: "center",
            fontSize: 24,
            fontWeight: 700,
            border: `2px solid ${PAL.cardBorder}`,
          }}
        >
          {initialsOf(name)}
        </div>
      )}
    </div>
  );
}

function VideoEl({ stream, muted }: { stream: MediaStream; muted?: boolean }): React.JSX.Element {
  const ref = React.useRef<HTMLVideoElement | null>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    el.play().catch(() => { /* autoplay restrictions · best-effort */ });
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        background: "#000",
      }}
    />
  );
}

function Controls({
  mediaType,
  muted,
  cameraOff,
  isHost,
  onMute,
  onCamera,
  onLeave,
  onEndForAll,
  joined,
}: {
  mediaType: "audio" | "video";
  muted: boolean;
  cameraOff: boolean;
  isHost: boolean;
  onMute: () => void;
  onCamera: () => void;
  onLeave: () => void;
  onEndForAll: () => void;
  joined: boolean;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "16px 10px calc(16px + env(safe-area-inset-bottom))",
        background: "rgba(6,9,26,0.72)",
        borderTop: `1px solid ${PAL.cardBorder}`,
      }}
    >
      <CtrlButton
        label={muted ? "Unmute" : "Mute"}
        active={muted}
        tint={muted ? PAL.red : PAL.text}
        onClick={onMute}
      >
        {muted ? "🔇" : "🎙️"}
      </CtrlButton>
      {mediaType === "video" && (
        <CtrlButton
          label={cameraOff ? "Camera on" : "Camera off"}
          active={cameraOff}
          tint={cameraOff ? PAL.red : PAL.text}
          onClick={onCamera}
        >
          {cameraOff ? "📷🚫" : "📷"}
        </CtrlButton>
      )}
      <CtrlButton
        label="Leave"
        active
        tint={PAL.red}
        onClick={onLeave}
      >
        ✕
      </CtrlButton>
      {isHost && joined && (
        <CtrlButton
          label="End for all"
          active
          tint={PAL.orange}
          onClick={onEndForAll}
        >
          ⏻
        </CtrlButton>
      )}
    </div>
  );
}

function CtrlButton({
  label,
  active,
  tint,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  tint: string;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "10px 14px",
        borderRadius: 14,
        background: active ? `${tint}22` : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? `${tint}66` : PAL.cardBorder}`,
        color: tint,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
        minWidth: 72,
      }}
    >
      <span style={{ fontSize: 18 }}>{children}</span>
      <span style={{ fontSize: 11, letterSpacing: "0.01em" }}>{label}</span>
    </button>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "·";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/* ─── Shared styles ─────────────────────────────────────────────── */

const rootStyle: React.CSSProperties = {
  minHeight: "100dvh",
  background: `linear-gradient(180deg, ${PAL.bg} 0%, ${PAL.bg2} 100%)`,
  color: PAL.text,
  display: "flex",
  flexDirection: "column",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

const errorCardStyle: React.CSSProperties = {
  margin: "auto",
  maxWidth: 400,
  width: "100%",
  padding: "28px 24px",
  borderRadius: 20,
  background: PAL.card,
  border: `1px solid ${PAL.cardBorder}`,
  textAlign: "center",
};

const backBtnStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 20px",
  borderRadius: 999,
  background: PAL.orange,
  color: "#0a0608",
  fontSize: 13.5,
  fontWeight: 700,
  textDecoration: "none",
};
