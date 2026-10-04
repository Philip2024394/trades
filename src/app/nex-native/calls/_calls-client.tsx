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

export interface CallsPerson {
  id: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
}

interface CallsClientProps {
  viewerId: string;
  people: CallsPerson[];
}

// Palette tuned to the reference image · deep navy base, rich card
// surfaces, orange brand accent, green voice, blue video, red missed.
const PAL = {
  bg: "#06091A",
  bg2: "#0B1024",
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
type RecentsFilter = "all" | "missed" | "incoming" | "outgoing" | "voice" | "video";

export function CallsClient({ people }: CallsClientProps): React.JSX.Element {
  const [search, setSearch] = React.useState("");
  const [pickerFor, setPickerFor] = React.useState<CallKind | null>(null);
  const [recentsFilter, setRecentsFilter] = React.useState<RecentsFilter>("all");

  const filteredPeople = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) =>
      p.displayName.toLowerCase().includes(q) ||
      (p.handle ?? "").toLowerCase().includes(q),
    );
  }, [people, search]);

  return (
    <>
      <style>{`
        html, body { background: ${PAL.bg} !important; }
        [data-nex-calls] * { box-sizing: border-box; }
        [data-nex-calls] a { text-decoration: none; color: inherit; }
        [data-nex-calls] button { font-family: inherit; cursor: pointer; }
        [data-nex-calls] input::placeholder { color: ${PAL.textMuted}; }
      `}</style>
      <div
        data-nex-calls
        style={{
          minHeight: "100dvh",
          background: `linear-gradient(180deg, ${PAL.bg} 0%, ${PAL.bg2} 100%)`,
          color: PAL.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          paddingBottom: 32,
        }}
      >
        <main
          style={{
            maxWidth: 480,
            margin: "0 auto",
            padding:
              "calc(env(safe-area-inset-top, 0) + 16px) 18px 24px",
          }}
        >
          <Header />
          <SearchField value={search} onChange={setSearch} />
          <PrimaryCards onPick={(kind) => setPickerFor(kind)} />
          <QuickActions />
          <PeopleRow people={people.slice(0, 10)} />
          <RecentCalls filter={recentsFilter} onFilter={setRecentsFilter} />
        </main>

        {pickerFor && (
          <ContactPickerModal
            kind={pickerFor}
            people={filteredPeople}
            onClose={() => setPickerFor(null)}
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
      <div
        aria-hidden
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: PAL.orange,
          color: "#0a0608",
          display: "grid",
          placeItems: "center",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.08em",
        }}
      >
        NEX
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>
          Calls
        </h1>
        <p
          style={{
            margin: "1px 0 0",
            fontSize: 12,
            color: PAL.textDim,
            letterSpacing: "0.005em",
          }}
        >
          Connect with your people
        </p>
      </div>
      <IconButton ariaLabel="Search">
        <SearchIcon />
      </IconButton>
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

/* ─── Search ────────────────────────────────────────────────────── */

function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <div
      data-nex-calls-search
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 16,
        background: PAL.card,
        border: `1px solid ${PAL.cardBorder}`,
        marginBottom: 18,
      }}
    >
      <SearchIcon color={PAL.orange} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search people to call"
        aria-label="Search people to call"
        style={{
          flex: 1,
          minWidth: 0,
          background: "transparent",
          border: "none",
          outline: "none",
          color: PAL.text,
          fontSize: 14.5,
          fontFamily: "inherit",
        }}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "rgba(255,255,255,0.06)",
            border: "none",
            display: "grid",
            placeItems: "center",
            color: PAL.textDim,
            padding: 0,
          }}
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}

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
          left: 14,
          bottom: 12,
          width: 20,
          height: 20,
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

function QuickActions(): React.JSX.Element {
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
      <QuickAction
        icon={<GroupIcon />}
        label="Group call"
        disabledReason="Group calls are not yet available"
      />
      <QuickAction
        icon={<LinkIcon />}
        label="Call link"
        disabledReason="Call links are not yet available"
      />
      <QuickActionLink
        icon={<InviteIcon />}
        label="Invite"
        href="/nex-native/friends"
      />
    </section>
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
      <SectionHeader title="People" linkLabel="See all" linkHref="/nex-native/friends" />
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
        {people.map((p) => (
          <Link
            key={p.id}
            href={`/nex-native/chat/peer/${p.id}`}
            role="listitem"
            style={{
              flex: "0 0 auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              width: 64,
              scrollSnapAlign: "start",
            }}
          >
            <Avatar name={p.displayName} avatarUrl={p.avatarUrl} size={56} />
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
        ))}
      </div>
    </section>
  );
}

/* ─── Recent calls (empty-state only · no call-log table yet) ──── */

function RecentCalls({
  filter,
  onFilter,
}: {
  filter: RecentsFilter;
  onFilter: (f: RecentsFilter) => void;
}): React.JSX.Element {
  const filters: { key: RecentsFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "missed", label: "Missed" },
    { key: "incoming", label: "Incoming" },
    { key: "outgoing", label: "Outgoing" },
    { key: "voice", label: "Voice" },
    { key: "video", label: "Video" },
  ];
  return (
    <section data-nex-calls-recent>
      <SectionHeader title="Recent calls" linkLabel="View all" linkHref="#" />
      <div
        role="tablist"
        aria-label="Recent-calls filter"
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          padding: "4px 0 12px",
        }}
      >
        {filters.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onFilter(f.key)}
              style={{
                flex: "0 0 auto",
                padding: "7px 14px",
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 600,
                background: active ? PAL.orange : "transparent",
                color: active ? "#0a0608" : PAL.textDim,
                border: `1px solid ${active ? PAL.orange : PAL.cardBorderStrong}`,
                letterSpacing: "0.01em",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>
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
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: PAL.text,
          }}
        >
          Your recent calls will appear here
        </p>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 12,
            color: PAL.textDim,
            lineHeight: 1.5,
            maxWidth: 300,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Call history is tracked once a call log is wired up. For now,
          start a call from the cards above or from a friend&rsquo;s chat.
        </p>
      </div>
    </section>
  );
}

/* ─── Contact picker modal (voice / video) ──────────────────────── */

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} picker`}
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
          maxHeight: "76dvh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span
            aria-hidden
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              background: kind === "voice" ? PAL.greenSoft : PAL.blueSoft,
              color: kind === "voice" ? PAL.green : PAL.blue,
              display: "grid",
              placeItems: "center",
              border: `1px solid ${(kind === "voice" ? PAL.green : PAL.blue) + "44"}`,
            }}
          >
            {kind === "voice" ? <PhoneIcon size={18} /> : <VideoIcon size={18} />}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: PAL.text }}>{title}</div>
            <div style={{ fontSize: 12, color: PAL.textDim }}>{subtitle}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close picker"
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
        {people.length === 0 ? (
          <div
            style={{
              padding: "24px 10px",
              textAlign: "center",
              color: PAL.textDim,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            You don&rsquo;t have any friends on NEX yet.
            <br />
            <Link href="/nex-native/friends" style={{ color: PAL.orange, fontWeight: 600 }}>
              Open contacts →
            </Link>
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: "6px 0 0",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {people.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    router.push(
                      `/nex-native/chat/peer/${p.id}?start_call=${kind}`,
                    );
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 10px",
                    borderRadius: 14,
                    background: "transparent",
                    border: "none",
                    color: PAL.text,
                    textAlign: "left",
                  }}
                >
                  <Avatar name={p.displayName} avatarUrl={p.avatarUrl} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{p.displayName}</div>
                    {p.handle && (
                      <div style={{ fontSize: 11.5, color: PAL.textDim }}>
                        {p.handle}
                      </div>
                    )}
                  </div>
                  <span
                    aria-hidden
                    style={{
                      color: kind === "voice" ? PAL.green : PAL.blue,
                      padding: 6,
                    }}
                  >
                    {kind === "voice" ? <PhoneIcon size={18} /> : <VideoIcon size={18} />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
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
}: {
  name: string;
  avatarUrl: string | null;
  size: number;
}): React.JSX.Element {
  const initials = initialsOf(name);
  return (
    <div
      aria-hidden
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

function SearchIcon({ color }: { color?: string } = {}): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke={color ?? "currentColor"} strokeWidth="1.8" />
      <path d="M20 20l-3.5-3.5" stroke={color ?? "currentColor"} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
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
function InviteIcon(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="10" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 20a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M19 9v6M16 12h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
