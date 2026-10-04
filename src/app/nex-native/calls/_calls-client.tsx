"use client";

// src/app/nex-native/calls/_calls-client.tsx
//
// Client surface for /nex-native/calls. Owns:
//   · search state
//   · the Call-type picker modal (Voice | Video → select a person →
//     navigate to /nex-native/chat/peer/{peerId}?start_call=…)
//
// Layout mirrors call center.png verbatim: header, search, two
// primary cards, three quick actions, People section (horizontal
// avatars), Recent calls with filter pills and an honest empty-state.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PresenceProvider,
  usePresence,
  presenceFor,
  type PresenceKind,
} from "./_presence-client";
import { createCallLinkAction } from "./_create-call-link-action";
import { startGroupCallAction } from "./_start-group-call-action";

export interface CallsPerson {
  id: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  profession: string | null;
  headline: string | null;
  locationLabel: string | null;
}

export interface RecentCallRow {
  id: string;
  peerId: string;
  peerName: string;
  peerAvatarUrl: string | null;
  direction: "incoming" | "outgoing";
  mediaType: "audio" | "video";
  outcome: "completed" | "missed" | "declined" | "failed";
  startedAt: string;
  durationSeconds: number | null;
}

interface CallsClientProps {
  viewerId: string;
  people: CallsPerson[];
  recentCalls: RecentCallRow[];
}

// Palette tuned to the reference image · deep navy base, rich card
// surfaces, orange brand accent, green voice, blue video, red missed.
const PAL = {
  // Call Center + call surface share the Create Account page's deep
  // navy canvas (#020914) + the same single cyan radial glow at the
  // top. If you change these, update CALL_SURFACE in _call-launcher
  // so the three surfaces stay aligned.
  bg: "#020914",
  bg2: "#020914",
  card: "#121737",
  cardBorder: "rgba(255,255,255,0.06)",
  cardBorderStrong: "rgba(255,255,255,0.10)",
  text: "#F2F5FA",
  textDim: "#A6ADC2",
  textMuted: "#6B7490",
  orange: "#FF8A2A",
  orangeSoft: "rgba(255,138,42,0.14)",
  green: "#22C55E",
  greenSoft: "rgba(34,197,94,0.18)",
  blue: "#3B82F6",
  blueSoft: "rgba(59,130,246,0.18)",
  red: "#EF4444",
  redSoft: "rgba(239,68,68,0.14)",
};

type CallKind = "voice" | "video";
type RecentsFilter = "missed" | "incoming" | "outgoing" | "voice" | "video";

export function CallsClient({
  viewerId,
  people,
  recentCalls,
}: CallsClientProps): React.JSX.Element {
  return (
    <PresenceProvider viewerId={viewerId}>
      <CallsClientInner people={people} recentCalls={recentCalls} />
    </PresenceProvider>
  );
}

function CallsClientInner({
  people,
  recentCalls,
}: {
  people: CallsPerson[];
  recentCalls: RecentCallRow[];
}): React.JSX.Element {
  const [pickerFor, setPickerFor] = React.useState<CallKind | null>(null);
  const [recentsFilter, setRecentsFilter] =
    React.useState<RecentsFilter>("missed");
  const [linkModalOpen, setLinkModalOpen] = React.useState(false);
  const [groupPickerOpen, setGroupPickerOpen] = React.useState(false);

  return (
    <>
      <style>{`
        html, body { background: ${PAL.bg} !important; }
        [data-nex-calls] * { box-sizing: border-box; }
        [data-nex-calls] a { text-decoration: none; color: inherit; }
        [data-nex-calls] button { font-family: inherit; cursor: pointer; }
        [data-nex-calls] input::placeholder { color: ${PAL.textMuted}; }
        /* Hide scrollbars globally on the Calls page · the People row
           and any dropdowns still scroll naturally, just without the
           bar visually. */
        [data-nex-calls] *::-webkit-scrollbar { width: 0; height: 0; display: none; }
        [data-nex-calls] * { scrollbar-width: none; -ms-overflow-style: none; }
        @keyframes nex-calls-dropdown-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        /* Presence ping · an outward pulse behind the green rim so
           online friends feel "live" on the People row. */
        @keyframes nex-presence-ping {
          0%   { transform: scale(1);    opacity: 0.75; }
          80%  { transform: scale(1.9);  opacity: 0; }
          100% { transform: scale(1.9);  opacity: 0; }
        }
      `}</style>
      <div
        data-nex-calls
        style={{
          minHeight: "100dvh",
          background: PAL.bg,
          color: PAL.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          paddingBottom: 32,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Create Account page's cyan atmosphere · single faint
            top-centre radial glow. Keeps the Calls hub and Create
            Account in visual lockstep. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(60% 40% at 50% 0%, rgba(0,175,255,0.09), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <main
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 480,
            margin: "0 auto",
            padding:
              "calc(env(safe-area-inset-top, 0) + 16px) 18px 24px",
          }}
        >
          <Header />
          <PrimaryCards onPick={(kind) => setPickerFor(kind)} />
          <QuickActions
            onCreateLink={() => setLinkModalOpen(true)}
            onGroupCall={() => setGroupPickerOpen(true)}
          />
          <PeopleRow people={people.slice(0, 10)} />
          <RecentCalls
            calls={recentCalls}
            filter={recentsFilter}
            onFilter={setRecentsFilter}
          />
        </main>

        {pickerFor && (
          <ContactPickerModal
            kind={pickerFor}
            people={people}
            onClose={() => setPickerFor(null)}
          />
        )}
        {linkModalOpen && (
          <CreateCallLinkModal onClose={() => setLinkModalOpen(false)} />
        )}
        {groupPickerOpen && (
          <GroupPickerModal
            people={people}
            onClose={() => setGroupPickerOpen(false)}
          />
        )}
      </div>
    </>
  );
}

/* ─── Header ────────────────────────────────────────────────────── */

function Header(): React.JSX.Element {
  return (
    <header
      data-nex-calls-header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "6px 0 18px",
      }}
    >
      <span
        aria-label="NEX"
        style={{
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: "0.14em",
          display: "inline-flex",
        }}
      >
        <span style={{ color: PAL.text }}>NE</span>
        <span style={{ color: PAL.orange }}>X</span>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: PAL.textDim,
          }}
        >
          Call Center
        </h1>
      </div>
      <IconButton ariaLabel="More options">
        <DotsIcon />
      </IconButton>
    </header>
  );
}

function IconButton({
  children,
  ariaLabel,
  onClick,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  onClick?: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        padding: 0,
        display: "grid",
        placeItems: "center",
        background: "transparent",
        border: "none",
        color: PAL.text,
      }}
    >
      {children}
    </button>
  );
}

/* Search bar removed 2026-10-04 per founder direction. The picker
   modal still receives the full People list; search inside the
   picker can be re-added if the friend list grows large. */

/* ─── Primary cards ─────────────────────────────────────────────── */

function PrimaryCards({
  onPick,
}: {
  onPick: (kind: CallKind) => void;
}): React.JSX.Element {
  return (
    <section
      aria-label="Start a call"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 12,
        marginBottom: 16,
      }}
    >
      <PrimaryCard
        tint={PAL.green}
        tintSoft={PAL.greenSoft}
        icon={<PhoneIcon size={24} />}
        title="Voice call"
        subtitle="Talk with someone"
        onClick={() => onPick("voice")}
      />
      <PrimaryCard
        tint={PAL.blue}
        tintSoft={PAL.blueSoft}
        icon={<VideoIcon size={24} />}
        title="Video call"
        subtitle="See someone face to face"
        onClick={() => onPick("video")}
      />
    </section>
  );
}

function PrimaryCard({
  tint,
  tintSoft,
  icon,
  title,
  subtitle,
  onClick,
}: {
  tint: string;
  tintSoft: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${title} · ${subtitle}`}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 10,
        padding: "16px 14px 14px",
        borderRadius: 20,
        background: PAL.card,
        border: `1px solid ${PAL.cardBorder}`,
        color: PAL.text,
        textAlign: "left",
        boxShadow:
          "0 1px 2px rgba(0,0,0,0.3), 0 10px 24px rgba(0,0,0,0.3)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 46,
          height: 46,
          borderRadius: 999,
          background: tintSoft,
          color: tint,
          display: "grid",
          placeItems: "center",
          border: `1px solid ${tint}44`,
        }}
      >
        {icon}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 15.5, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 11.5, color: PAL.textDim, lineHeight: 1.3 }}>
          {subtitle}
        </span>
      </div>
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          width: 22,
          height: 22,
          borderRadius: 999,
          background: PAL.orange,
          color: "#0a0608",
          display: "grid",
          placeItems: "center",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <PlusIcon size={12} />
      </span>
    </button>
  );
}

/* ─── Quick actions ─────────────────────────────────────────────── */

function QuickActions({
  onCreateLink,
  onGroupCall,
}: {
  onCreateLink: () => void;
  onGroupCall: () => void;
}): React.JSX.Element {
  return (
    <section
      aria-label="Quick actions"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 10,
        marginBottom: 22,
      }}
    >
      <QuickActionButton
        icon={<GroupIcon />}
        label="Group call"
        onClick={onGroupCall}
      />
      <QuickActionButton
        icon={<LinkIcon />}
        label="Call link"
        onClick={onCreateLink}
      />
      <QuickActionLink
        icon={<InviteIcon />}
        label="Invite"
        href="/nex-native/friends"
      />
    </section>
  );
}

function QuickActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "14px 8px",
        borderRadius: 16,
        background: PAL.card,
        border: `1px solid ${PAL.cardBorder}`,
        color: PAL.text,
      }}
    >
      <span aria-hidden style={{ color: PAL.orange }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
    </button>
  );
}

function QuickAction({
  icon,
  label,
  disabledReason,
}: {
  icon: React.ReactNode;
  label: string;
  disabledReason: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled
      aria-label={`${label} · ${disabledReason}`}
      title={disabledReason}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "14px 8px",
        borderRadius: 16,
        background: PAL.card,
        border: `1px solid ${PAL.cardBorder}`,
        color: PAL.textMuted,
        opacity: 0.55,
        cursor: "not-allowed",
      }}
    >
      <span aria-hidden style={{ color: PAL.textDim }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
    </button>
  );
}

function QuickActionLink({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "14px 8px",
        borderRadius: 16,
        background: PAL.card,
        border: `1px solid ${PAL.cardBorder}`,
        color: PAL.text,
      }}
    >
      <span aria-hidden style={{ color: PAL.orange }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
    </Link>
  );
}

/* ─── People (friends · reference calls it Favourites) ──────────── */

function PeopleRow({ people }: { people: CallsPerson[] }): React.JSX.Element {
  const presenceSets = usePresence();
  const router = useRouter();
  if (people.length === 0) {
    return (
      <section data-nex-calls-people-empty style={{ marginBottom: 22 }}>
        <SectionHeader title="People" linkLabel={null} />
        <div
          style={{
            padding: "18px 16px",
            borderRadius: 16,
            background: PAL.card,
            border: `1px solid ${PAL.cardBorder}`,
            color: PAL.textDim,
            fontSize: 13,
            lineHeight: 1.45,
            textAlign: "center",
          }}
        >
          Add friends on NEX to call them from here.{" "}
          <Link href="/nex-native/friends" style={{ color: PAL.orange, fontWeight: 600 }}>
            Open contacts →
          </Link>
        </div>
      </section>
    );
  }
  return (
    <section data-nex-calls-people style={{ marginBottom: 22 }}>
      <SectionHeader title="People" linkLabel={null} />
      <div
        role="list"
        aria-label="Your people"
        style={{
          display: "flex",
          gap: 14,
          overflowX: "auto",
          padding: "6px 2px 10px",
          scrollSnapType: "x mandatory",
        }}
      >
        {people.map((p) => {
          const presence = presenceFor(p.id, presenceSets);
          const busy = presence === "busy";
          return (
            <div
              key={p.id}
              role="listitem"
              aria-label={`${p.displayName}${presence === "online" ? " · online" : busy ? " · on a call" : ""}`}
              style={{
                flex: "0 0 auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                width: 72,
                scrollSnapAlign: "start",
              }}
            >
              <Link
                href={`/nex-native/chat/peer/${p.id}`}
                aria-label={`Open chat with ${p.displayName}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Avatar
                  name={p.displayName}
                  avatarUrl={p.avatarUrl}
                  size={56}
                  presence={presence}
                />
                <span
                  style={{
                    fontSize: 11.5,
                    color: PAL.text,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    width: "100%",
                  }}
                >
                  {firstName(p.displayName)}
                </span>
              </Link>
              <div style={{ display: "flex", gap: 6 }}>
                <PeopleActionButton
                  kind="voice"
                  busy={busy}
                  peerName={p.displayName}
                  onActivate={() =>
                    router.push(`/nex-native/chat/peer/${p.id}?start_call=voice`)
                  }
                />
                <PeopleActionButton
                  kind="video"
                  busy={busy}
                  peerName={p.displayName}
                  onActivate={() =>
                    router.push(`/nex-native/chat/peer/${p.id}?start_call=video`)
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PeopleActionButton({
  kind,
  busy,
  peerName,
  onActivate,
}: {
  kind: "voice" | "video";
  busy: boolean;
  peerName: string;
  onActivate: () => void;
}): React.JSX.Element {
  const color = kind === "voice" ? PAL.green : PAL.blue;
  const soft = kind === "voice" ? PAL.greenSoft : PAL.blueSoft;
  const label =
    kind === "voice" ? `Call ${peerName}` : `Video call ${peerName}`;
  const disabledLabel = `${peerName} is on a call`;
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={busy ? disabledLabel : label}
      title={busy ? disabledLabel : label}
      onClick={() => {
        if (busy) return;
        onActivate();
      }}
      style={{
        width: 26,
        height: 26,
        padding: 0,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        background: busy ? "rgba(255,255,255,0.04)" : soft,
        border: `1px solid ${busy ? PAL.cardBorder : color + "66"}`,
        color: busy ? PAL.textMuted : color,
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.55 : 1,
      }}
    >
      {kind === "voice" ? <PhoneIcon size={12} /> : <VideoIcon size={12} />}
    </button>
  );
}

/* ─── Recent calls (empty-state only · no call-log table yet) ──── */

function RecentCalls({
  calls,
  filter,
  onFilter,
}: {
  calls: RecentCallRow[];
  filter: RecentsFilter;
  onFilter: (f: RecentsFilter) => void;
}): React.JSX.Element {
  const filters: { key: RecentsFilter; label: string }[] = [
    { key: "missed", label: "Missed" },
    { key: "incoming", label: "Incoming" },
    { key: "outgoing", label: "Outgoing" },
    { key: "voice", label: "Voice" },
    { key: "video", label: "Video" },
  ];
  const filtered = React.useMemo(() => applyFilter(calls, filter), [calls, filter]);
  return (
    <section data-nex-calls-recent>
      <SectionHeader title="Recent calls" linkLabel={null} />
      <RecentsFilterDropdown
        value={filter}
        options={filters}
        onChange={onFilter}
      />
      {filtered.length === 0 ? (
        <RecentCallsEmpty hasAny={calls.length > 0} filter={filter} />
      ) : (
        <ul
          data-nex-calls-recent-list
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {filtered.map((c) => (
            <li key={c.id}>
              <RecentCallRowView row={c} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function applyFilter(
  rows: RecentCallRow[],
  filter: RecentsFilter,
): RecentCallRow[] {
  switch (filter) {
    case "missed":
      return rows.filter((r) => r.outcome === "missed");
    case "incoming":
      return rows.filter((r) => r.direction === "incoming");
    case "outgoing":
      return rows.filter((r) => r.direction === "outgoing");
    case "voice":
      return rows.filter((r) => r.mediaType === "audio");
    case "video":
      return rows.filter((r) => r.mediaType === "video");
  }
}

function RecentCallsEmpty({
  hasAny,
  filter,
}: {
  hasAny: boolean;
  filter: RecentsFilter;
}): React.JSX.Element {
  const label = (() => {
    if (!hasAny) return "Your recent calls will appear here";
    switch (filter) {
      case "missed":   return "No missed calls";
      case "incoming": return "No incoming calls yet";
      case "outgoing": return "No outgoing calls yet";
      case "voice":    return "No voice calls yet";
      case "video":    return "No video calls yet";
    }
  })();
  const sub = hasAny
    ? "Try another filter above."
    : "Start a call from the cards above or from a friend's chat.";
  return (
    <div
      style={{
        padding: "28px 20px",
        borderRadius: 16,
        background: PAL.card,
        border: `1px solid ${PAL.cardBorder}`,
        textAlign: "center",
      }}
    >
      <div
        aria-hidden
        style={{
          margin: "0 auto 10px",
          width: 44,
          height: 44,
          borderRadius: 999,
          background: PAL.orangeSoft,
          color: PAL.orange,
          display: "grid",
          placeItems: "center",
        }}
      >
        <PhoneIcon size={20} />
      </div>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: PAL.text }}>
        {label}
      </p>
      <p
        style={{
          margin: "6px auto 0",
          fontSize: 12,
          color: PAL.textDim,
          lineHeight: 1.5,
          maxWidth: 300,
        }}
      >
        {sub}
      </p>
    </div>
  );
}

function RecentCallRowView({ row }: { row: RecentCallRow }): React.JSX.Element {
  const missed = row.outcome === "missed";
  const callBackHref = `/nex-native/chat/peer/${row.peerId}?start_call=${
    row.mediaType === "video" ? "video" : "voice"
  }`;
  return (
    <Link
      href={callBackHref}
      aria-label={`Call back ${row.peerName}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 10px",
        borderRadius: 12,
        background: "transparent",
      }}
    >
      <Avatar name={row.peerName} avatarUrl={row.peerAvatarUrl} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              color: missed ? PAL.red : PAL.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "60vw",
            }}
          >
            {row.peerName}
          </span>
          <span
            style={{
              fontSize: 11,
              color: PAL.textDim,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {formatRecentDate(row.startedAt)}
          </span>
        </div>
        <div
          style={{
            marginTop: 2,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: missed ? PAL.red : PAL.textDim,
          }}
        >
          <DirectionIcon direction={row.direction} outcome={row.outcome} />
          <span>{recentCallSubtitle(row)}</span>
        </div>
      </div>
      <span
        aria-hidden
        style={{
          display: "grid",
          placeItems: "center",
          width: 36,
          height: 36,
          borderRadius: 999,
          background: row.mediaType === "video" ? PAL.blueSoft : PAL.greenSoft,
          color: row.mediaType === "video" ? PAL.blue : PAL.green,
          border: `1px solid ${(row.mediaType === "video" ? PAL.blue : PAL.green) + "44"}`,
        }}
      >
        {row.mediaType === "video" ? (
          <VideoIcon size={16} />
        ) : (
          <PhoneIcon size={16} />
        )}
      </span>
    </Link>
  );
}

function recentCallSubtitle(row: RecentCallRow): string {
  const kind = row.mediaType === "video" ? "Video" : "Voice";
  if (row.outcome === "missed") {
    return row.direction === "incoming" ? `Missed ${kind.toLowerCase()} call` : `No answer`;
  }
  if (row.outcome === "declined") {
    return row.direction === "incoming" ? `Declined ${kind.toLowerCase()}` : `Declined`;
  }
  if (row.outcome === "failed") {
    return `${kind} · failed`;
  }
  // completed · show duration if available
  const dur = row.durationSeconds;
  if (dur == null || dur < 1) return `${kind} call`;
  const mm = Math.floor(dur / 60);
  const ss = dur % 60;
  return `${kind} · ${mm}:${String(ss).padStart(2, "0")}`;
}

function formatRecentDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate();
  if (sameDay) {
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
  const dayMs = 86_400_000;
  const diffDays = Math.floor((now.getTime() - d.getTime()) / dayMs);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return d.toLocaleDateString("en-GB", { weekday: "short" });
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function DirectionIcon({
  direction,
  outcome,
}: {
  direction: "incoming" | "outgoing";
  outcome: "completed" | "missed" | "declined" | "failed";
}): React.JSX.Element {
  const red = outcome === "missed" || outcome === "declined";
  const color = red ? PAL.red : direction === "incoming" ? PAL.green : PAL.blue;
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      {direction === "incoming" ? (
        <path
          d="M19 5L8 16M8 16h6M8 16v-6"
          stroke={color}
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M5 19L16 8M16 8h-6M16 8v6"
          stroke={color}
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/* ─── Recent-calls filter dropdown ──────────────────────────────── */

function RecentsFilterDropdown({
  value,
  options,
  onChange,
}: {
  value: RecentsFilter;
  options: { key: RecentsFilter; label: string }[];
  onChange: (f: RecentsFilter) => void;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => o.key === value) ?? options[0]!;

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      data-nex-calls-filter-dropdown
      style={{ position: "relative", margin: "4px 0 12px" }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "11px 14px",
          borderRadius: 14,
          background: PAL.card,
          border: `1px solid ${PAL.cardBorderStrong}`,
          color: PAL.text,
          fontSize: 13.5,
          fontWeight: 600,
          letterSpacing: "0.01em",
        }}
      >
        <span>{current.label}</span>
        <ChevronIcon flipped={open} />
      </button>
      {open && (
        <>
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "transparent",
              zIndex: 40,
            }}
          />
          <ul
            role="listbox"
            aria-label="Filter recent calls"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              padding: 6,
              borderRadius: 14,
              background: PAL.card,
              border: `1px solid ${PAL.cardBorderStrong}`,
              boxShadow: "0 20px 44px rgba(0,0,0,0.55)",
              zIndex: 50,
              listStyle: "none",
              margin: 0,
              animation:
                "nex-calls-dropdown-in 160ms cubic-bezier(.2,.7,.2,1) both",
              overflow: "hidden",
            }}
          >
            {options.map((o) => {
              const active = o.key === value;
              return (
                <li key={o.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(o.key);
                      setOpen(false);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: active ? PAL.orangeSoft : "transparent",
                      border: "none",
                      color: active ? PAL.orange : PAL.text,
                      fontSize: 13.5,
                      fontWeight: active ? 700 : 500,
                      textAlign: "left",
                    }}
                  >
                    <span>{o.label}</span>
                    {active && <CheckIcon />}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

/* ─── Create-call-link modal ────────────────────────────────────── */

function CreateCallLinkModal({
  onClose,
}: {
  onClose: () => void;
}): React.JSX.Element {
  const [mediaType, setMediaType] = React.useState<"audio" | "video">("audio");
  const [partySize, setPartySize] = React.useState<1 | 2 | 3>(1);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    shareUrl: string;
    mediaType: "audio" | "video";
    maxUses: number;
    expiresAt: string | null;
  } | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onCreate(): Promise<void> {
    setBusy(true);
    setErr(null);
    const r = await createCallLinkAction({ mediaType, maxUses: partySize });
    setBusy(false);
    if (!r.ok) {
      setErr(r.reason);
      return;
    }
    setResult({
      shareUrl: r.shareUrl,
      mediaType: r.mediaType,
      maxUses: r.maxUses,
      expiresAt: r.expiresAt,
    });
  }

  async function onCopy(): Promise<void> {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* no-op · browser blocked clipboard */
    }
  }

  const tint = mediaType === "video" ? PAL.blue : PAL.green;
  const tintSoft = mediaType === "video" ? PAL.blueSoft : PAL.greenSoft;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create a call link"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2, 5, 15, 0.72)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          background: PAL.card,
          border: `1px solid ${PAL.cardBorderStrong}`,
          borderRadius: 22,
          padding: "20px 18px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              background: PAL.orangeSoft,
              color: PAL.orange,
              display: "grid",
              placeItems: "center",
              border: `1px solid ${PAL.orange}44`,
            }}
          >
            <LinkIcon />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: PAL.text }}>
              Create a call link
            </div>
            <div style={{ fontSize: 12, color: PAL.textDim }}>
              Shareable URL · 24h expiry · 1-3 joiners
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: "none",
              color: PAL.textDim,
              display: "grid",
              placeItems: "center",
            }}
          >
            <CloseIcon />
          </button>
        </div>

        {!result ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <MediaKindOption
                active={mediaType === "audio"}
                tint={PAL.green}
                tintSoft={PAL.greenSoft}
                label="Voice"
                icon={<PhoneIcon size={18} />}
                onClick={() => setMediaType("audio")}
              />
              <MediaKindOption
                active={mediaType === "video"}
                tint={PAL.blue}
                tintSoft={PAL.blueSoft}
                label="Video"
                icon={<VideoIcon size={18} />}
                onClick={() => setMediaType("video")}
              />
            </div>
            <div
              style={{
                fontSize: 11,
                color: PAL.textMuted,
                marginBottom: 6,
              }}
            >
              Who can join
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <PartyOption
                active={partySize === 1}
                label="1:1"
                sub="One joiner"
                onClick={() => setPartySize(1)}
              />
              <PartyOption
                active={partySize === 2}
                label="Group of 3"
                sub="You + 2 others"
                onClick={() => setPartySize(2)}
              />
              <PartyOption
                active={partySize === 3}
                label="Group of 4"
                sub="You + 3 others"
                onClick={() => setPartySize(3)}
              />
            </div>
            {err && (
              <p
                style={{
                  fontSize: 12.5,
                  color: "#FFB199",
                  margin: "0 0 10px",
                }}
              >
                {err}
              </p>
            )}
            <button
              type="button"
              onClick={() => void onCreate()}
              disabled={busy}
              style={{
                width: "100%",
                padding: "12px 18px",
                borderRadius: 999,
                background: tintSoft,
                border: `1px solid ${tint}`,
                color: tint,
                fontSize: 14,
                fontWeight: 700,
                cursor: busy ? "wait" : "pointer",
                opacity: busy ? 0.7 : 1,
                fontFamily: "inherit",
              }}
            >
              {busy ? "Creating…" : "Create link"}
            </button>
          </>
        ) : (
          <>
            <div
              style={{
                padding: "14px 14px",
                borderRadius: 14,
                background: tintSoft,
                border: `1px solid ${tint}66`,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  color: tint,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                {result.maxUses === 1
                  ? result.mediaType === "video"
                    ? "1:1 video call link"
                    : "1:1 voice call link"
                  : result.mediaType === "video"
                    ? `Group video call link (up to ${result.maxUses + 1})`
                    : `Group voice call link (up to ${result.maxUses + 1})`}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: PAL.text,
                  wordBreak: "break-all",
                  fontFamily: "ui-monospace, monospace",
                  lineHeight: 1.4,
                }}
              >
                {result.shareUrl}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => void onCopy()}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 999,
                  background: PAL.orange,
                  color: "#0a0608",
                  border: "none",
                  fontSize: 13.5,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                {copied ? "Copied ✓" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "12px 20px",
                  borderRadius: 999,
                  background: "transparent",
                  border: `1px solid ${PAL.cardBorderStrong}`,
                  color: PAL.textDim,
                  fontSize: 13.5,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
            {result.expiresAt && (
              <p
                style={{
                  margin: "12px 0 0",
                  fontSize: 11.5,
                  color: PAL.textMuted,
                  textAlign: "center",
                }}
              >
                Expires {new Date(result.expiresAt).toLocaleString("en-GB")}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PartyOption({
  active,
  label,
  sub,
  onClick,
}: {
  active: boolean;
  label: string;
  sub: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "9px 8px",
        borderRadius: 12,
        background: active ? PAL.orangeSoft : "transparent",
        border: `1px solid ${active ? PAL.orange + "66" : PAL.cardBorderStrong}`,
        color: active ? PAL.orange : PAL.textDim,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        fontFamily: "inherit",
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 10, opacity: 0.7 }}>{sub}</span>
    </button>
  );
}

function MediaKindOption({
  active,
  tint,
  tintSoft,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  tint: string;
  tintSoft: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 14,
        background: active ? tintSoft : "transparent",
        border: `1px solid ${active ? tint : PAL.cardBorderStrong}`,
        color: active ? tint : PAL.textDim,
        fontSize: 13.5,
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ─── Group picker modal (host-initiated group call) ────────────── */

function GroupPickerModal({
  people,
  onClose,
}: {
  people: CallsPerson[];
  onClose: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const presenceSets = usePresence();
  const [mediaType, setMediaType] = React.useState<"audio" | "video">("video");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  }

  async function onStart(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const r = await startGroupCallAction({
      mediaType,
      inviteeAccountIds: Array.from(selected),
    });
    setBusy(false);
    if (!r.ok) {
      setErr(r.reason);
      return;
    }
    router.push(`/nex-native/call/g/${r.sessionId}`);
  }

  const tint = mediaType === "video" ? PAL.blue : PAL.green;
  const tintSoft = mediaType === "video" ? PAL.blueSoft : PAL.greenSoft;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Start group call"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2, 5, 15, 0.72)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          background: PAL.card,
          border: `1px solid ${PAL.cardBorderStrong}`,
          borderRadius: 22,
          padding: "20px 16px 18px",
          maxHeight: "80dvh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span
            aria-hidden
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              background: PAL.orangeSoft,
              color: PAL.orange,
              display: "grid",
              placeItems: "center",
              border: `1px solid ${PAL.orange}44`,
            }}
          >
            <GroupIcon />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: PAL.text }}>
              Start group call
            </div>
            <div style={{ fontSize: 12, color: PAL.textDim }}>
              You + up to 3 others · mesh WebRTC
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: "none",
              color: PAL.textDim,
              display: "grid",
              placeItems: "center",
            }}
          >
            <CloseIcon />
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <MediaKindOption
            active={mediaType === "audio"}
            tint={PAL.green}
            tintSoft={PAL.greenSoft}
            label="Voice"
            icon={<PhoneIcon size={18} />}
            onClick={() => setMediaType("audio")}
          />
          <MediaKindOption
            active={mediaType === "video"}
            tint={PAL.blue}
            tintSoft={PAL.blueSoft}
            label="Video"
            icon={<VideoIcon size={18} />}
            onClick={() => setMediaType("video")}
          />
        </div>

        <div
          style={{
            fontSize: 11,
            color: PAL.textMuted,
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Invite up to 3 people (optional)</span>
          <span>{selected.size}/3 selected</span>
        </div>

        {people.length === 0 ? (
          <div
            style={{
              padding: "16px 10px",
              textAlign: "center",
              color: PAL.textDim,
              fontSize: 13,
            }}
          >
            You can start the call solo and share the room link from inside.
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: "4px 0",
              overflowY: "auto",
              maxHeight: 260,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {people.map((p) => {
              const checked = selected.has(p.id);
              const busyPeer = presenceFor(p.id, presenceSets) === "busy";
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    disabled={!checked && selected.size >= 3}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: 12,
                      background: checked ? PAL.orangeSoft : "transparent",
                      border: `1px solid ${checked ? PAL.orange + "66" : "transparent"}`,
                      color: PAL.text,
                      textAlign: "left",
                      cursor:
                        !checked && selected.size >= 3 ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                      opacity: !checked && selected.size >= 3 ? 0.4 : 1,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.06)",
                        color: PAL.text,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        flex: "none",
                      }}
                    >
                      {initialsFromName(p.displayName)}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>
                        {p.displayName}
                      </span>
                      <span style={{ fontSize: 11, color: PAL.textDim }}>
                        {busyPeer ? "On a call" : "Online"}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        border: `1.5px solid ${checked ? PAL.orange : "rgba(255,255,255,0.2)"}`,
                        background: checked ? PAL.orange : "transparent",
                        display: "grid",
                        placeItems: "center",
                        color: "#0a0608",
                        fontSize: 11,
                        fontWeight: 800,
                        flex: "none",
                      }}
                    >
                      {checked ? "✓" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {err && (
          <p style={{ fontSize: 12.5, color: "#FFB199", margin: "10px 0 0" }}>
            {err}
          </p>
        )}

        <button
          type="button"
          onClick={() => void onStart()}
          disabled={busy}
          style={{
            marginTop: 14,
            padding: "13px 18px",
            borderRadius: 999,
            background: tintSoft,
            border: `1px solid ${tint}`,
            color: tint,
            fontSize: 14.5,
            fontWeight: 700,
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.7 : 1,
            fontFamily: "inherit",
          }}
        >
          {busy ? "Starting…" : "Start group call"}
        </button>
      </div>
    </div>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "·";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/* ─── Contact picker modal (voice / video) ──────────────────────── *
 * Glass-first design matching the call-page button language:         *
 *   · Modal shell: frosted glass panel with 2px orange→cyan rim      *
 *   · Each contact: individual glass card with the same rim          *
 *   · NEX brand palette only · deep orange #FF7200, cyan #00AFFF     *
 *   · Shows all 4 info lines the founder specified: name, profession *
 *     (or role · tag combo), city, nex-handle.                       *
 * ────────────────────────────────────────────────────────────────── */

// NEX brand tokens · copied from Create Account for picker continuity.
const NEX_BRAND = {
  orange: "#FF7200",
  cyan: "#00AFFF",
  textDim: "#7D9BC0",
  darkRed: "#991B1B",
};
const RIM_GRADIENT = `linear-gradient(135deg, ${NEX_BRAND.orange} 0%, ${NEX_BRAND.cyan} 100%)`;

function ContactPickerModal({
  kind,
  people,
  onClose,
}: {
  kind: CallKind;
  people: CallsPerson[];
  onClose: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const presenceSets = usePresence();
  const title = kind === "voice" ? "Voice call" : "Video call";
  const subtitle =
    kind === "voice" ? "Pick someone to call" : "Pick someone to video-call";

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const kindTint = kind === "voice" ? NEX_BRAND.orange : NEX_BRAND.cyan;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} picker`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background:
          "radial-gradient(60% 40% at 50% 0%, rgba(0,175,255,0.09), transparent 70%), rgba(2,9,20,0.78)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          borderRadius: 24,
          padding: 0,
          border: "2px solid transparent",
          background: `rgba(255,255,255,0.05) padding-box, ${RIM_GRADIENT} border-box`,
          backdropFilter: "blur(22px) saturate(1.1)",
          WebkitBackdropFilter: "blur(22px) saturate(1.1)",
          maxHeight: "82dvh",
          display: "flex",
          flexDirection: "column",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.14), 0 20px 50px rgba(0,0,0,0.6), 0 0 40px rgba(255,114,0,0.14), 0 0 50px rgba(0,175,255,0.14)",
        }}
      >
        {/* Modal header · brand badge + title + close */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "18px 18px 14px",
          }}
        >
          <GlassChip tint={kindTint} size={38}>
            {kind === "voice" ? <PhoneIcon size={18} /> : <VideoIcon size={18} />}
          </GlassChip>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15.5,
                fontWeight: 700,
                color: PAL.text,
                letterSpacing: "-0.005em",
              }}
            >
              {title}
            </div>
            <div style={{ fontSize: 12, color: NEX_BRAND.textDim }}>{subtitle}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close picker"
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${NEX_BRAND.cyan}2A`,
              color: NEX_BRAND.textDim,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Hairline divider */}
        <div
          aria-hidden
          style={{
            height: 1,
            margin: "0 18px 10px",
            background:
              "linear-gradient(90deg, transparent, rgba(0,175,255,0.22), transparent)",
          }}
        />

        {people.length === 0 ? (
          <EmptyPicker />
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: "4px 18px 18px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {people.map((p) => (
              <li key={p.id}>
                <GlassContactCard
                  person={p}
                  kind={kind}
                  presence={presenceFor(p.id, presenceSets)}
                  onPick={() => {
                    router.push(
                      `/nex-native/chat/peer/${p.id}?start_call=${kind}`,
                    );
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─── Glass contact card · world-class landscape row ────────────── */

function GlassContactCard({
  person,
  kind,
  presence,
  onPick,
}: {
  person: CallsPerson;
  kind: CallKind;
  presence: PresenceKind;
  onPick: () => void;
}): React.JSX.Element {
  const busy = presence === "busy";
  const online = presence === "online";
  const kindTint = kind === "voice" ? NEX_BRAND.orange : NEX_BRAND.cyan;

  // Sub-line prefers "{profession} · {location}" when both exist, otherwise
  // whichever single value is available. Matches the founder's example
  // where the profession and city read as a single compact tagline.
  const subline =
    person.profession && person.locationLabel
      ? `${person.profession} · ${person.locationLabel}`
      : (person.profession ?? person.locationLabel ?? person.headline ?? null);

  return (
    <button
      type="button"
      disabled={busy}
      aria-disabled={busy}
      title={busy ? `${person.displayName} is on a call` : undefined}
      onClick={() => {
        if (busy) return;
        onPick();
      }}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 14px",
        borderRadius: 18,
        border: "1.5px solid transparent",
        background: busy
          ? `rgba(153,27,27,0.08) padding-box, linear-gradient(135deg, ${NEX_BRAND.darkRed}, ${NEX_BRAND.darkRed}) border-box`
          : `rgba(255,255,255,0.05) padding-box, ${RIM_GRADIENT} border-box`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        color: PAL.text,
        textAlign: "left",
        opacity: busy ? 0.65 : 1,
        cursor: busy ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        transition: "transform 140ms ease, box-shadow 160ms ease",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 20px rgba(0,0,0,0.4), 0 0 18px rgba(255,114,0,0.08), 0 0 22px rgba(0,175,255,0.08)",
      }}
      onMouseEnter={(e) => {
        if (busy) return;
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow =
          "inset 0 1px 0 rgba(255,255,255,0.12), 0 14px 28px rgba(0,0,0,0.5), 0 0 24px rgba(255,114,0,0.16), 0 0 30px rgba(0,175,255,0.16)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow =
          "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 20px rgba(0,0,0,0.4), 0 0 18px rgba(255,114,0,0.08), 0 0 22px rgba(0,175,255,0.08)";
      }}
    >
      <GlassAvatar
        name={person.displayName}
        avatarUrl={person.avatarUrl}
        presence={presence}
      />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div
          style={{
            fontSize: 15.5,
            fontWeight: 700,
            letterSpacing: "-0.005em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {person.displayName}
        </div>
        {person.profession && (
          <div
            style={{
              fontSize: 12.5,
              color: PAL.text,
              opacity: 0.9,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {person.profession}
          </div>
        )}
        {!person.profession && subline && (
          <div
            style={{
              fontSize: 12.5,
              color: PAL.text,
              opacity: 0.9,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {subline}
          </div>
        )}
        {person.locationLabel && (
          <div
            style={{
              fontSize: 11.5,
              color: NEX_BRAND.textDim,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {person.locationLabel}
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 3,
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              fontFamily:
                "ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
              color: NEX_BRAND.cyan,
              letterSpacing: "0.01em",
              opacity: 0.9,
            }}
          >
            {person.handle ?? "—"}
          </span>
          {(online || busy) && (
            <>
              <span
                aria-hidden
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: 999,
                  background: NEX_BRAND.textDim,
                  opacity: 0.5,
                }}
              />
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: busy ? NEX_BRAND.darkRed : NEX_BRAND.cyan,
                  letterSpacing: "0.01em",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: busy ? NEX_BRAND.darkRed : "#22C55E",
                    boxShadow: busy
                      ? `0 0 6px ${NEX_BRAND.darkRed}`
                      : "0 0 6px #22C55E99",
                  }}
                />
                {busy ? "On a call" : "Online"}
              </span>
            </>
          )}
        </div>
      </div>
      <GlassActionChip tint={kindTint} disabled={busy}>
        {kind === "voice" ? <PhoneIcon size={18} /> : <VideoIcon size={18} />}
      </GlassActionChip>
    </button>
  );
}

/* ─── Glass primitives ──────────────────────────────────────────── */

function GlassAvatar({
  name,
  avatarUrl,
  presence,
}: {
  name: string;
  avatarUrl: string | null;
  presence: PresenceKind;
}): React.JSX.Element {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("") || "·";
  // Fallback fill alternates orange/cyan by first letter so the
  // picker still feels branded when avatars are missing · no pastels.
  const fallbackTint =
    name.charCodeAt(0) % 2 === 0 ? NEX_BRAND.orange : NEX_BRAND.cyan;
  const presenceDot =
    presence === "busy"
      ? NEX_BRAND.darkRed
      : presence === "online"
        ? "#22C55E"
        : null;
  return (
    <span
      style={{ position: "relative", flex: "none" }}
      aria-hidden
    >
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: avatarUrl
            ? `url(${avatarUrl}) center/cover`
            : `${fallbackTint}22`,
          border: `1.5px solid transparent`,
          backgroundImage: avatarUrl
            ? `url(${avatarUrl})`
            : `linear-gradient(${fallbackTint}22, ${fallbackTint}22), ${RIM_GRADIENT}`,
          backgroundOrigin: "border-box",
          backgroundClip: "padding-box, border-box",
          color: fallbackTint,
          fontSize: 18,
          fontWeight: 700,
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.1), 0 0 14px rgba(0,175,255,0.1)",
        }}
      >
        {avatarUrl ? "" : initials}
      </span>
      {presenceDot && (
        <span
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: 12,
            height: 12,
            borderRadius: 999,
            background: presenceDot,
            border: `2px solid ${PAL.bg}`,
            boxShadow: `0 0 8px ${presenceDot}`,
          }}
        />
      )}
    </span>
  );
}

function GlassActionChip({
  tint,
  disabled,
  children,
}: {
  tint: string;
  disabled: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <span
      aria-hidden
      style={{
        width: 46,
        height: 46,
        borderRadius: 14,
        border: "1.5px solid transparent",
        background: disabled
          ? `rgba(255,255,255,0.03) padding-box, linear-gradient(135deg, ${NEX_BRAND.textDim}44, ${NEX_BRAND.textDim}44) border-box`
          : `${tint}1F padding-box, ${RIM_GRADIENT} border-box`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        color: disabled ? NEX_BRAND.textDim : tint,
        display: "grid",
        placeItems: "center",
        flex: "none",
        boxShadow: disabled
          ? "none"
          : `inset 0 1px 0 rgba(255,255,255,0.14), 0 0 16px ${tint}33`,
      }}
    >
      {children}
    </span>
  );
}

function GlassChip({
  tint,
  size = 34,
  children,
}: {
  tint: string;
  size?: number;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        border: "1.5px solid transparent",
        background: `${tint}1F padding-box, ${RIM_GRADIENT} border-box`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        color: tint,
        display: "grid",
        placeItems: "center",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 0 14px ${tint}33`,
      }}
    >
      {children}
    </span>
  );
}

function EmptyPicker(): React.JSX.Element {
  return (
    <div
      style={{
        padding: "28px 20px 32px",
        textAlign: "center",
        color: NEX_BRAND.textDim,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 56,
          height: 56,
          margin: "0 auto 12px",
          borderRadius: 18,
          border: "1.5px solid transparent",
          background: `rgba(255,255,255,0.04) padding-box, ${RIM_GRADIENT} border-box`,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          color: NEX_BRAND.cyan,
          display: "grid",
          placeItems: "center",
        }}
      >
        <PhoneIcon size={22} />
      </div>
      <div style={{ color: PAL.text, fontSize: 14, fontWeight: 600 }}>
        No contacts yet
      </div>
      <div style={{ marginTop: 4 }}>Add friends on NEX to call them.</div>
      <Link
        href="/nex-native/friends"
        style={{
          display: "inline-block",
          marginTop: 14,
          padding: "9px 18px",
          borderRadius: 999,
          color: NEX_BRAND.orange,
          fontWeight: 600,
          fontSize: 13,
          textDecoration: "none",
          border: `1px solid ${NEX_BRAND.orange}66`,
          background: "rgba(255,114,0,0.08)",
        }}
      >
        Open contacts →
      </Link>
    </div>
  );
}

/* ─── Shared primitives ─────────────────────────────────────────── */

function SectionHeader({
  title,
  linkLabel,
  linkHref,
}: {
  title: string;
  linkLabel: string | null;
  linkHref?: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 10,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: "0.005em" }}>
        {title}
      </h2>
      {linkLabel && linkHref && (
        <Link
          href={linkHref}
          style={{ fontSize: 12, color: PAL.orange, fontWeight: 600 }}
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

function Avatar({
  name,
  avatarUrl,
  size,
  presence,
}: {
  name: string;
  avatarUrl: string | null;
  size: number;
  presence?: PresenceKind;
}): React.JSX.Element {
  const initials = initialsOf(name);
  const rimColor =
    presence === "online"
      ? PAL.green
      : presence === "busy"
        ? PAL.orange
        : null;
  const inner = (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: avatarUrl ? "#000" : `linear-gradient(145deg, ${PAL.orange}44, ${PAL.blue}44)`,
        color: PAL.text,
        display: "grid",
        placeItems: "center",
        fontSize: size < 44 ? 14 : 18,
        fontWeight: 700,
        overflow: "hidden",
        flexShrink: 0,
        border: `1px solid ${PAL.cardBorderStrong}`,
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
        initials
      )}
    </div>
  );

  if (!rimColor) {
    // No presence data for this contact · plain avatar, no rim.
    return <div aria-hidden>{inner}</div>;
  }

  // Presence-aware avatar · rim ring + (online only) outward ping.
  // Ring sits at inset -3 (3px outside the avatar); ping starts at
  // the ring's size and expands via nex-presence-ping.
  const showPing = presence === "online";
  return (
    <div
      aria-hidden
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: -3,
          borderRadius: 999,
          border: `2px solid ${rimColor}`,
          boxShadow: `0 0 10px ${rimColor}88, inset 0 0 6px ${rimColor}55`,
          pointerEvents: "none",
        }}
      />
      {showPing && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: -3,
            borderRadius: 999,
            border: `2px solid ${rimColor}`,
            animation: "nex-presence-ping 1.9s ease-out infinite",
            pointerEvents: "none",
          }}
        />
      )}
      {inner}
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first ?? name;
}

/* ─── Icons ─────────────────────────────────────────────────────── */

function DotsIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5"  cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="19" cy="12" r="1.9" />
    </svg>
  );
}
function CloseIcon(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function PhoneIcon({ size = 20 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.8.3 1.6.6 2.4a2 2 0 0 1-.5 2.1L7.9 9.5a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.4.6a2 2 0 0 1 1.7 2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function VideoIcon({ size = 20 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 10l5-3v10l-5-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function PlusIcon({ size = 14 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function GroupIcon(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 20a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15 20a5 5 0 0 1 6-4.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function LinkIcon(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 14a5 5 0 0 1 0-7l3-3a5 5 0 0 1 7 7l-1.5 1.5M14 10a5 5 0 0 1 0 7l-3 3a5 5 0 0 1-7-7l1.5-1.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ChevronIcon({ flipped }: { flipped: boolean }): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{
        transform: flipped ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 160ms ease",
      }}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function CheckIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function InviteIcon(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="10" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 20a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M19 9v6M16 12h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
