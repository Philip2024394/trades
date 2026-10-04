// src/app/nex-native/call/j/[slug]/page.tsx
//
// Call-link join lobby. Reached via the shareable URL
// /nex-native/call/j/{slug}. Validates the link, shows a lobby card
// with the creator's name + media type + Join button. On Join:
//   · 1:1 link (max_uses=1): consume the link, redirect to the
//     creator's peer chat with ?start_call={media_type}.
//   · Group link (max_uses 2-4): the Join button hands off to the
//     group-call client (phase 3) · for now, shows a "coming later"
//     notice while phase 3 is still in progress.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountService from "@/lib/nex-native/account-service";
import { getProfileByAccountId } from "@/lib/nex-native/account-profile-service";
import { resolveCallLink } from "@/lib/nex-native/call-link-service";
import { JoinCallLinkClient } from "./_join-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CallLinkJoinPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    const next = `/nex-native/call/j/${encodeURIComponent(slug)}`;
    redirect(`/nex-native/sign-in?next=${encodeURIComponent(next)}`);
  }

  const status = await resolveCallLink(slug).catch(() => ({
    kind: "not-found" as const,
  }));

  if (status.kind !== "ok") {
    return <InvalidLobby reason={status.kind} />;
  }

  const row = status.row;
  const [creator, creatorProfile] = await Promise.all([
    accountService.getAccountById(row.created_by).catch(() => null),
    getProfileByAccountId(row.created_by).catch(() => null),
  ]);
  const creatorName = creator?.display_name ?? "A NEX user";

  return (
    <JoinCallLinkClient
      slug={slug}
      creatorId={row.created_by}
      creatorName={creatorName}
      creatorAvatarUrl={creatorProfile?.avatar_url ?? null}
      mediaType={row.media_type}
      maxUses={row.max_uses}
      expiresAt={row.expires_at}
      selfIsCreator={session.account.id === row.created_by}
    />
  );
}

function InvalidLobby({
  reason,
}: {
  reason: "not-found" | "revoked" | "expired" | "used-up";
}): React.JSX.Element {
  const copy = (() => {
    switch (reason) {
      case "not-found":
        return {
          title: "Link not found",
          body:
            "This call link doesn't exist or was mistyped. Check the URL and try again.",
        };
      case "revoked":
        return {
          title: "Link revoked",
          body: "The person who created this link has revoked it.",
        };
      case "expired":
        return {
          title: "Link expired",
          body: "This call link has expired. Ask the creator to send a fresh one.",
        };
      case "used-up":
        return {
          title: "Link already used",
          body: "This call link has been used the maximum number of times.",
        };
    }
  })();
  return (
    <main
      style={{
        minHeight: "100dvh",
        background:
          "linear-gradient(180deg, #06091A 0%, #0B1024 100%)",
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
        <div
          aria-hidden
          style={{
            margin: "0 auto 14px",
            width: 54,
            height: 54,
            borderRadius: 999,
            background: "rgba(239,68,68,0.14)",
            color: "#EF4444",
            display: "grid",
            placeItems: "center",
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M12 7v6M12 17v.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-0.005em",
          }}
        >
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
