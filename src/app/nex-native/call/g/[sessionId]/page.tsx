// src/app/nex-native/call/g/[sessionId]/page.tsx
//
// Group-call room page. Server-resolves session + hands off to the
// client component which runs the mesh engine. The 4-cap and
// participant eligibility are enforced server-side by the join
// action · this page only validates the session exists + is still
// joinable.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getAccountById } from "@/lib/nex-native/account-service";
import { getProfileByAccountId } from "@/lib/nex-native/account-profile-service";
import {
  getGroupCallSession,
  listParticipants,
} from "@/lib/nex-native/calls/group-call-service";
import { GroupCallClient } from "./_group-call-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function GroupCallPage({ params }: PageProps) {
  const { sessionId } = await params;
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    const next = `/nex-native/call/g/${encodeURIComponent(sessionId)}`;
    redirect(`/nex-native/sign-in?next=${encodeURIComponent(next)}`);
  }

  const row = await getGroupCallSession(sessionId).catch(() => null);
  if (!row) return <RoomUnavailable kind="not-found" />;
  if (row.state === "ended") return <RoomUnavailable kind="ended" />;

  const participants = await listParticipants(sessionId).catch(() => []);

  // Hydrate self name for presence tracking + host avatar for lobby.
  const [selfAccount, hostAccount, hostProfile] = await Promise.all([
    getAccountById(session.account.id).catch(() => null),
    getAccountById(row.host_account_id).catch(() => null),
    getProfileByAccountId(row.host_account_id).catch(() => null),
  ]);

  const participantAccountIds = Array.from(
    new Set(participants.map((p) => p.account_id)),
  );
  const participantAccounts = await Promise.all(
    participantAccountIds.map(async (id) => {
      const [a, p] = await Promise.all([
        getAccountById(id).catch(() => null),
        getProfileByAccountId(id).catch(() => null),
      ]);
      return {
        accountId: id,
        displayName: a?.display_name ?? "NEX user",
        avatarUrl: p?.avatar_url ?? null,
      };
    }),
  );

  const isHost = row.host_account_id === session.account.id;
  const canJoin =
    isHost ||
    participants.some(
      (p) => p.account_id === session.account.id && !p.left_at,
    ) ||
    // Allow walk-ins when count < 4 · the trigger will reject if full.
    participants.filter((p) => !p.left_at).length < 4;

  if (!canJoin) return <RoomUnavailable kind="full" />;

  return (
    <GroupCallClient
      sessionId={sessionId}
      selfAccountId={session.account.id}
      selfDisplayName={selfAccount?.display_name ?? "You"}
      mediaType={row.media_type}
      isHost={isHost}
      hostName={hostAccount?.display_name ?? "Host"}
      hostAvatarUrl={hostProfile?.avatar_url ?? null}
      participantAccounts={participantAccounts}
    />
  );
}

function RoomUnavailable({
  kind,
}: {
  kind: "not-found" | "ended" | "full";
}): React.JSX.Element {
  const copy = {
    "not-found": {
      title: "Call not found",
      body: "This group call doesn't exist or the URL is wrong.",
    },
    ended: {
      title: "Call ended",
      body: "This group call has already ended.",
    },
    full: {
      title: "Call is full",
      body: "This group call already has four participants.",
    },
  }[kind];
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(180deg, #06091A 0%, #0B1024 100%)",
        color: "#F2F5FA",
        display: "grid",
        placeItems: "center",
        padding: 24,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 400,
          width: "100%",
          padding: "28px 24px",
          borderRadius: 20,
          background: "#121737",
          border: "1px solid rgba(255,255,255,0.08)",
          textAlign: "center",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          {copy.title}
        </h1>
        <p
          style={{
            margin: "10px auto 20px",
            fontSize: 13.5,
            color: "#A6ADC2",
            lineHeight: 1.5,
            maxWidth: 300,
          }}
        >
          {copy.body}
        </p>
        <Link
          href="/nex-native/calls"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            borderRadius: 999,
            background: "#FF8A2A",
            color: "#0a0608",
            fontSize: 13.5,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Back to Calls
        </Link>
      </div>
    </main>
  );
}
