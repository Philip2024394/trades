// src/app/nex-native/u/[handle]/page.tsx
//
// Public NEX handle profile · Phase 3A refresh · 2026-10-04.
// -----------------------------------------------------------
// Reached via /nex-native/u/{nex_handle}. Phase 3A introduces the
// explicit public-discovery opt-in gate (migration 134): the page
// renders only when the owner has set `is_discoverable = true`
// through Settings → Profile. If the viewer IS the owner, the page
// renders regardless (so they can preview their own public page).
// Any other viewer landing on a non-discoverable profile sees 404.
//
// Doctrine
//   · Theme scope boundary (2026-10-04) · public profile is a NEX
//     SYSTEM surface · renders in NEX brand regardless of the
//     viewer's chat_theme.
//   · Public identity is nex-XXXXX (sealed) · never expose UUID
//   · Only public fields shown · no phone/email/orders/notes/bio
//     when private · no vault, no private settings
//   · notFound() for missing handles · malformed handles · and
//     non-discoverable profiles viewed by non-owners.

import type * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountService from "@/lib/nex-native/account-service";
import * as accountProfileService from "@/lib/nex-native/account-profile-service";
import * as businessService from "@/lib/nex-native/business-service";
import { NexPageHeader } from "../../_page-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ─── NEX palette · system surface · never themed ──────────────── */
const NEX = {
  bg: "#020914",
  surface: "#0E1526",
  surfaceHi: "#182540",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  textSoft: "#4B6683",
  orange: "#FF7200",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.14)",
  cyanFaint: "rgba(0,175,255,0.06)",
  borderSoft: "rgba(255,255,255,0.06)",
  divider: "rgba(255,255,255,0.08)",
};

export default async function Page({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: rawHandle } = await params;
  const handle = decodeURIComponent(rawHandle).trim().toLowerCase();
  // Allow /u/36474 as a shortcut for /u/nex-36474
  const normalised = handle.startsWith("nex-") ? handle : `nex-${handle}`;

  const account = await accountService.getAccountByNexHandle(normalised);
  if (!account) notFound();

  // Phase 3A gate: load the profile via the admin client (service
  // layer) so the owner-RLS policy doesn't interfere with the server
  // render. We then make the discoverability decision ourselves.
  const profile = await accountProfileService
    .getProfileByAccountId(account.id)
    .catch(() => null);

  const session = await resolveNexAppSessionFromContext();
  const isSelf = Boolean(session && session.account.id === account.id);

  // The guard · non-owners can view only when the owner has opted in.
  // Owners can always preview their own public page even when the
  // flag is off, so the editing loop works.
  const isDiscoverable = profile?.is_discoverable === true;
  if (!isDiscoverable && !isSelf) {
    notFound();
  }

  const businesses = await businessService.listBusinessesByOwner(account.id);

  // Trust signal: Phase 1 face-verified avatar + a completed daily
  // activity drives the "Verified Personal ✓" tick (Bridge 41).
  const verifiedPersonal =
    !!profile?.avatar_face_verified && !!profile?.daily_activity;

  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        data-nex-public-profile
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "calc(env(safe-area-inset-top, 0) + 16px) 20px 48px",
          position: "relative",
          overflow: "hidden",
        }}
      >
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
        <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto" }}>
          <NexPageHeader dataScope="public-profile" />

          {/* Owner-preview banner · only shown when the viewer is the
              owner AND discoverability is OFF · surfaces the private
              state honestly so the owner can't mistake what others
              see. */}
          {isSelf && !isDiscoverable && (
            <OwnerPreviewBanner />
          )}

          <ProfileHero
            displayName={account.display_name}
            handle={account.nex_handle}
            avatarUrl={profile?.avatar_url ?? null}
            profession={profile?.profession ?? null}
            location={profile?.location_label ?? null}
            headline={profile?.headline ?? null}
            verifiedPersonal={verifiedPersonal}
            joinedAt={account.created_at}
          />

          {profile?.bio && <BioSection bio={profile.bio} />}

          {profile?.skills && profile.skills.length > 0 && (
            <SkillsSection skills={profile.skills} />
          )}

          <BusinessesSection businesses={businesses} />

          <PrivacyFooter />
        </div>
      </main>
    </>
  );
}

/* ═════════════════════════════════════════════════════════════════ */

function OwnerPreviewBanner(): React.JSX.Element {
  return (
    <section
      role="status"
      aria-label="Owner preview"
      style={{
        margin: "14px 0 6px",
        padding: "12px 16px",
        borderRadius: 14,
        border: `1px solid ${NEX.orange}44`,
        background: "rgba(255,114,0,0.08)",
        color: NEX.text,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <strong style={{ color: NEX.orange, letterSpacing: "0.04em" }}>
        PREVIEW ·
      </strong>{" "}
      Your profile is <strong>not discoverable</strong> right now · only you can
      see this page. Turn on{" "}
      <Link
        href="/nex-native/settings/profile?tab=personal"
        style={{ color: NEX.cyan, fontWeight: 600 }}
      >
        Discoverable on NEX
      </Link>{" "}
      to let others find you.
    </section>
  );
}

function ProfileHero({
  displayName,
  handle,
  avatarUrl,
  profession,
  location,
  headline,
  verifiedPersonal,
  joinedAt,
}: {
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  profession: string | null;
  location: string | null;
  headline: string | null;
  verifiedPersonal: boolean;
  joinedAt: string;
}): React.JSX.Element {
  const initials = (displayName || "·")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
  const metaParts = [profession, location].filter(Boolean) as string[];
  return (
    <section
      style={{
        margin: "20px 0 18px",
        padding: "22px 20px",
        borderRadius: 20,
        background: NEX.surface,
        border: `1px solid ${NEX.borderSoft}`,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 24px rgba(0,0,0,0.3)",
      }}
    >
      <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
        <span
          aria-hidden={!!avatarUrl}
          aria-label={!avatarUrl ? `${displayName} avatar` : undefined}
          style={{
            width: 96,
            height: 96,
            flex: "none",
            borderRadius: "50%",
            overflow: "hidden",
            background: avatarUrl
              ? `url(${avatarUrl}) center/cover`
              : `linear-gradient(135deg, ${NEX.orange}22, ${NEX.cyan}22)`,
            border: `2px solid ${NEX.cyan}33`,
            display: "grid",
            placeItems: "center",
            color: NEX.text,
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          {!avatarUrl && initials}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: NEX.text,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {displayName}
            </h1>
            {verifiedPersonal && (
              <span
                aria-label="Verified personal"
                title="Verified personal · face-captured avatar + completed daily activity"
                style={{
                  flex: "none",
                  fontSize: 10,
                  color: NEX.cyan,
                  padding: "2px 8px",
                  borderRadius: 999,
                  border: `1px solid ${NEX.cyan}44`,
                  background: NEX.cyanSoft,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                ✓ Verified
              </span>
            )}
          </div>
          {metaParts.length > 0 && (
            <div
              style={{
                marginTop: 6,
                fontSize: 13.5,
                color: NEX.orange,
                fontWeight: 600,
                letterSpacing: "0.005em",
              }}
            >
              {metaParts.join(" · ")}
            </div>
          )}
          {headline && (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 13,
                color: NEX.textDim,
                lineHeight: 1.5,
              }}
            >
              {headline}
            </p>
          )}
          {handle && (
            <div
              style={{
                marginTop: 10,
                fontSize: 11.5,
                color: NEX.textMuted,
                fontFamily:
                  "ui-monospace, 'JetBrains Mono', 'SF Mono', monospace",
              }}
            >
              {handle} · joined {new Date(joinedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function BioSection({ bio }: { bio: string }): React.JSX.Element {
  return (
    <section
      aria-label="About"
      style={{
        margin: "0 0 18px",
        padding: "18px 20px",
        borderRadius: 16,
        background: NEX.surface,
        border: `1px solid ${NEX.borderSoft}`,
      }}
    >
      <h2
        style={{
          margin: "0 0 10px",
          fontSize: 10.5,
          fontWeight: 700,
          color: NEX.textDim,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        About
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: NEX.text,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
        }}
      >
        {bio}
      </p>
    </section>
  );
}

function SkillsSection({ skills }: { skills: string[] }): React.JSX.Element {
  const trimmed = skills
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 0);
  if (trimmed.length === 0) return <></>;
  return (
    <section
      aria-label="Skills"
      style={{
        margin: "0 0 18px",
        padding: "18px 20px",
        borderRadius: 16,
        background: NEX.surface,
        border: `1px solid ${NEX.borderSoft}`,
      }}
    >
      <h2
        style={{
          margin: "0 0 12px",
          fontSize: 10.5,
          fontWeight: 700,
          color: NEX.textDim,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        Skills
      </h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {trimmed.map((s) => (
          <span
            key={s}
            style={{
              display: "inline-block",
              padding: "6px 12px",
              borderRadius: 999,
              background: NEX.surfaceHi,
              border: `1px solid ${NEX.cyan}22`,
              color: NEX.textDim,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.01em",
            }}
          >
            {s}
          </span>
        ))}
      </div>
    </section>
  );
}

function BusinessesSection({
  businesses,
}: {
  businesses: Awaited<ReturnType<typeof businessService.listBusinessesByOwner>>;
}): React.JSX.Element {
  if (businesses.length === 0) return <></>;
  return (
    <section
      aria-label="Businesses"
      style={{
        margin: "0 0 18px",
        padding: "18px 20px",
        borderRadius: 16,
        background: NEX.surface,
        border: `1px solid ${NEX.borderSoft}`,
      }}
    >
      <h2
        style={{
          margin: "0 0 12px",
          fontSize: 10.5,
          fontWeight: 700,
          color: NEX.textDim,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        Businesses ({businesses.length})
      </h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {businesses.map((b) => (
          <li key={b.id}>
            <Link
              href={`/nex-native/${b.slug}`}
              style={{
                display: "flex",
                gap: 14,
                padding: "12px 12px",
                borderRadius: 12,
                background: NEX.surfaceHi,
                border: `1px solid ${NEX.borderSoft}`,
                textDecoration: "none",
                color: NEX.text,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 56,
                  height: 56,
                  flex: "none",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: b.logo_url
                    ? `url(${b.logo_url}) center/cover`
                    : `linear-gradient(135deg, ${NEX.orange}22, ${NEX.cyan}22)`,
                  border: `1px solid ${NEX.borderSoft}`,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14.5,
                    fontWeight: 700,
                    color: NEX.text,
                    letterSpacing: "-0.005em",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {b.display_name}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: NEX.textMuted,
                    fontFamily: "ui-monospace, monospace",
                    marginTop: 2,
                  }}
                >
                  /{b.slug}
                </div>
                {b.description && (
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 12.5,
                      color: NEX.textDim,
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {b.description}
                  </p>
                )}
              </div>
              <span
                aria-hidden
                style={{ alignSelf: "center", color: NEX.orange, fontSize: 16, flex: "none" }}
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PrivacyFooter(): React.JSX.Element {
  return (
    <p
      style={{
        margin: "16px 0 0",
        fontSize: 11,
        color: NEX.textMuted,
        textAlign: "center",
        lineHeight: 1.5,
      }}
    >
      NEX handles are permanent. Only fields you've chosen to share are shown
      here. Private settings, chat, phone and email are never exposed.
    </p>
  );
}
