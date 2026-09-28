// src/app/nex-native/settings/profile/page.tsx
//
// NEX identity + discovery profile editor.
// -------------------------------------------------------------------------
// Owner-only. Reads/edits the caller's nex_account_profile (personal
// tab) or their first nex_business (business tab).
//
// Bridge 37 · 2026-09-28 · Founder-directed redesign:
//   · Palette matches /nex-native/chat cards · dark navy panels, cyan
//     borders, orange primary CTA · reads as one continuous NEX product.
//   · Header messaging reframes the surface as "how you get seen and
//     bring in opportunities" · not just a settings page.
//   · Two toggles under the header:
//       [ Personal account ]   [ Business ]
//     Query-param driven (?tab=personal|business · defaults personal).
//   · Personal tab · full editor for nex_account_profile (avatar +
//     kind + profession + headline + bio + skills + location +
//     looking_for + discoverability toggle).
//   · Business tab · hydrates the caller's business row via
//     listBusinessesByOwner. Shows a summary card + deep-link to
//     /manage/shop for detailed editing (products, hours, category,
//     verification, gallery, staff). Empty-state guides to create one.
//
// Doctrine:
//   · Every value shown here comes from the authoritative NEX
//     Supabase (ijvqdvsvwtwxzcqmoqit). No mock data.
//   · Save posts to updateProfileAction which validates lengths/enums
//     before touching the DB.
//   · Business editing intentionally routes to /manage/shop rather
//     than duplicating the editor here.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountProfileService from "@/lib/nex-native/account-profile-service";
import * as businessService from "@/lib/nex-native/business-service";
import { updateProfileAction } from "../../_actions";
import { NexPageHeader } from "../../_page-header";
import { NexFaceCameraUploader } from "./_face-camera-uploader";
import { DailyActivitySection } from "./_daily-activity-section";
import {
  NEX_ACCOUNT_KINDS,
  NEX_ACCOUNT_KIND_LABEL,
  NEX_PROFILE_BIO_MAX,
  NEX_PROFILE_HEADLINE_MAX,
  NEX_PROFILE_LOCATION_LABEL_MAX,
  NEX_PROFILE_PROFESSION_MAX,
} from "@/lib/nex-native/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileTab = "personal" | "business";
const TABS: readonly ProfileTab[] = ["personal", "business"] as const;
const TAB_LABEL: Record<ProfileTab, string> = {
  personal: "Personal",
  business: "Business",
};

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  fieldBg: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
  green: "#10B981",
  red: "#EF4444",
};

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string; tab?: string }>;
}

const SUCCESS_CODES = new Set(["profile_saved"]);

const NEX_BUSINESS_CATEGORY_LABEL: Record<string, string> = {
  bakery: "Bakery",
  restaurant: "Restaurant",
  cafe: "Cafe",
  "ice-cream": "Ice cream shop",
  "dessert-shop": "Dessert shop",
  "drinks-shop": "Drinks shop",
  "juice-bar": "Juice bar",
  tradesperson: "Tradesperson",
  construction: "Construction",
  "staircase-company": "Staircase maker",
  salon: "Salon",
  beauty: "Beauty",
  fitness: "Fitness studio",
  consultant: "Consultant",
  agency: "Agency",
  ecommerce: "Online shop",
  "product-brand": "Product brand",
  "local-service": "Local service",
  portfolio: "Portfolio",
  community: "Community",
  event: "Event organiser",
  creator: "Creator",
  "professional-service": "Professional service",
};

export default async function Page({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const sp = await searchParams;
  const activeTab: ProfileTab = TABS.includes(sp.tab as ProfileTab)
    ? (sp.tab as ProfileTab)
    : "personal";
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const isSuccess = banner ? SUCCESS_CODES.has(banner.code) : false;

  const [profile, businesses] = await Promise.all([
    accountProfileService.getProfileByAccountId(session.account.id),
    businessService.listBusinessesByOwner(session.account.id).catch(() => []),
  ]);
  const business = businesses[0] ?? null;

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        [data-nex-profile-root] * { box-sizing: border-box; }
        [data-nex-profile-input]:focus,
        [data-nex-profile-textarea]:focus {
          outline: none;
          border-color: ${NEX.cyan};
          box-shadow: 0 0 0 2px rgba(0,175,255,0.20);
        }
      `}</style>
      <main
        data-nex-profile-root
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "16px 12px 40px",
          position: "relative",
          overflowX: "hidden",
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
        <div style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="profile" />

          {/* Framing · shared title · per-tab subheading below the toggle */}
          <section style={{ marginTop: 22 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: NEX.textPrimary,
              }}
            >
              Your NEX profile
            </h1>
          </section>

          {/* Toggle bar · Personal · Business */}
          <nav
            aria-label="Profile modes"
            data-nex-profile-toggle
            style={{
              marginTop: 20,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              borderBottom: `1px solid ${NEX.cyanFaint}`,
            }}
          >
            {TABS.map((t) => {
              const isActive = t === activeTab;
              return (
                <Link
                  key={t}
                  href={`/nex-native/settings/profile?tab=${t}`}
                  data-nex-profile-tab={t}
                  data-nex-profile-tab-active={isActive ? "true" : "false"}
                  style={{
                    position: "relative",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "14px 8px 12px",
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: isActive ? NEX.textPrimary : NEX.textSecondary,
                    textDecoration: "none",
                  }}
                >
                  {TAB_LABEL[t]}
                  {isActive && (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        bottom: -1,
                        left: "20%",
                        right: "20%",
                        height: 3,
                        background: NEX.cyan,
                        borderRadius: "3px 3px 0 0",
                        boxShadow: `0 0 12px ${NEX.cyan}`,
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {banner && (
            <div
              role="status"
              data-nex-profile-banner={banner.code}
              style={{
                marginTop: 16,
                padding: "10px 14px",
                borderRadius: 10,
                border: `1px solid ${isSuccess ? NEX.green : NEX.red}55`,
                background: isSuccess
                  ? "rgba(16,185,129,0.10)"
                  : "rgba(239,68,68,0.10)",
                color: isSuccess ? NEX.green : NEX.red,
                fontSize: 12,
              }}
            >
              {banner.message}
            </div>
          )}

          {/* Panel · active tab body */}
          <section style={{ marginTop: 20 }}>
            {activeTab === "personal" && (
              <PersonalTab profile={profile} account={session.account} />
            )}
            {activeTab === "business" && <BusinessTab business={business} />}
          </section>
        </div>
      </main>
    </>
  );
}

// ---------------------------------------------------------------------
// Personal tab · edits nex_account_profile
// ---------------------------------------------------------------------

function PersonalTab(props: {
  profile: Awaited<
    ReturnType<typeof accountProfileService.getProfileByAccountId>
  >;
  account: { id: string; display_name: string; nex_handle: string | null };
}) {
  const { profile, account } = props;
  return (
    <>
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          lineHeight: 1.5,
          color: NEX.textSecondary,
          maxWidth: 440,
        }}
      >
        Your identity to friends · this is who people see when you chat.
        Say who you are and what you do so friends recognise you.
      </p>

      {/* Bridge 43d · 2026-09-28 · founder tightening. Retired the
          green "Private by design" panel + the Verified Personal ✓
          checklist card in favour of a single-line note. The tick
          still exists (isPersonalVerified helper) · surfaces are
          Bridge 43c. */}
      <p
        data-nex-profile-privacy-line
        style={{
          margin: "0 0 14px",
          fontSize: 12,
          lineHeight: 1.5,
          color: NEX.textSecondary,
        }}
      >
        Personal accounts are private · you're only found on NEX when
        you share your NEX ID.
      </p>

      <NexFaceCameraUploader
        currentAvatarUrl={profile?.avatar_url ?? null}
        displayName={account.display_name}
        handle={account.nex_handle}
        faceVerified={profile?.avatar_face_verified ?? false}
      />

      <form
        action={updateProfileAction}
        data-nex-profile-form
        style={{
          padding: 16,
          background: NEX.panel,
          border: `1px solid ${NEX.cyanSoft}`,
          borderRadius: 14,
        }}
      >
        {/* Personal profiles are never in the Directory · force
            is_public=false on save regardless of legacy value. */}
        <input type="hidden" name="is_public" value="false" />

        {/* Bridge 39 · structured day-to-day activity + cascading
            follow-up fields. Rendered inside a JS-free client-only
            details/summary tree so the follow-ups can toggle in the
            browser without state · gracefully degrades to "everything
            visible" if scripting is disabled. */}
        <DailyActivitySection
          initial={profile?.daily_activity ?? null}
          detail={profile?.daily_activity_detail ?? {}}
        />

        <FieldGroup legend="What best describes what you do?">
          <div style={{ display: "grid", gap: 6 }}>
            <RadioRow
              name="kind"
              value="unset"
              label="Not yet set"
              muted
              defaultChecked={!profile?.kind}
            />
            {NEX_ACCOUNT_KINDS.map((k) => (
              <RadioRow
                key={k}
                name="kind"
                value={k}
                label={NEX_ACCOUNT_KIND_LABEL[k]}
                defaultChecked={profile?.kind === k}
                dataOption={k}
              />
            ))}
          </div>
        </FieldGroup>

        <TextField
          name="profession"
          label={`Profession (single term · e.g. "footwear designer")`}
          defaultValue={profile?.profession ?? ""}
          maxLength={NEX_PROFILE_PROFESSION_MAX}
          placeholder="e.g. footwear designer"
        />

        <TextField
          name="headline"
          label="Headline (short · one line)"
          defaultValue={profile?.headline ?? ""}
          maxLength={NEX_PROFILE_HEADLINE_MAX}
          placeholder="e.g. 12 years of footwear · Bandung"
        />

        <TextAreaField
          name="bio"
          label={`About you (up to ${NEX_PROFILE_BIO_MAX} chars)`}
          defaultValue={profile?.bio ?? ""}
          maxLength={NEX_PROFILE_BIO_MAX}
          rows={4}
          placeholder="A short paragraph in your own words · what you make, who you work with, what you're best at."
        />

        <TextField
          name="skills"
          label="Skills (comma-separated · max 20 · e.g. sample-making, CAD, sourcing)"
          defaultValue={(profile?.skills ?? []).join(", ")}
          placeholder="sample-making, CAD, sourcing"
        />

        <TextField
          name="location_label"
          label="Location label (freeform · country, city, or region)"
          defaultValue={profile?.location_label ?? ""}
          maxLength={NEX_PROFILE_LOCATION_LABEL_MAX}
          placeholder="e.g. Bandung, Indonesia"
        />

        <TextField
          name="looking_for"
          label="Looking for (comma-separated · max 10 · e.g. work, clients, collaborators)"
          defaultValue={(profile?.looking_for ?? []).join(", ")}
          placeholder="work, clients, collaborators"
        />

        <button
          type="submit"
          style={{
            display: "inline-flex",
            width: "100%",
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 20px",
            background: NEX.orange,
            color: "#0B0F1A",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Save profile
        </button>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------
// Business tab · summary + deep-link to /manage/shop
// ---------------------------------------------------------------------

function BusinessTab(props: {
  business: Awaited<
    ReturnType<typeof businessService.listBusinessesByOwner>
  >[number] | null;
}) {
  const { business } = props;

  const intro = (
    <p
      style={{
        margin: "0 0 14px",
        fontSize: 13,
        lineHeight: 1.5,
        color: NEX.textSecondary,
        maxWidth: 440,
      }}
    >
      Sell your products to local and international buyers. Once your
      listing is fully set up and NEX-verified, buyers worldwide find
      you in the NEX Directory. Profile can be a photo or your company
      logo — face-verification is not required for businesses.
    </p>
  );

  if (!business) {
    return (
      <>
        {intro}
      <div
        style={{
          padding: 20,
          background: NEX.panel,
          border: `1px solid ${NEX.cyanSoft}`,
          borderRadius: 14,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 8 }} aria-hidden>
          🛍
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: NEX.textPrimary,
          }}
        >
          No business yet
        </h2>
        <p
          style={{
            marginTop: 8,
            fontSize: 12,
            color: NEX.textSecondary,
            lineHeight: 1.5,
          }}
        >
          Set up a NEX Shop and reach local + international buyers.
          List products, take orders, share your address everywhere.
          Once your listing is complete and NEX-verified, you appear
          in the worldwide NEX Directory · Bisnis premium unlocks
          priority placement + unlimited products + boosted messages.
        </p>
        <Link
          href="/nex-native/manage/shop"
          style={{
            display: "inline-flex",
            marginTop: 14,
            padding: "10px 18px",
            background: NEX.orange,
            color: "#0B0F1A",
            border: "none",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          Create your business →
        </Link>
      </div>
      </>
    );
  }

  const categoryLabel =
    (business.business_category &&
      NEX_BUSINESS_CATEGORY_LABEL[business.business_category]) ||
    business.business_category ||
    null;
  const isVerified = !!business.verified_at;

  return (
    <>
      {intro}
      <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          padding: 16,
          background: NEX.panel,
          border: `1px solid ${NEX.cyanSoft}`,
          borderRadius: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            aria-hidden
            style={{
              flexShrink: 0,
              width: 52,
              height: 52,
              borderRadius: 12,
              background: NEX.cyanFaint,
              color: NEX.cyan,
              display: "grid",
              placeItems: "center",
              fontSize: 24,
              lineHeight: 1,
            }}
          >
            🛍
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  minWidth: 0,
                  flexShrink: 1,
                }}
              >
                {business.display_name}
              </span>
              {isVerified && <VerifiedTick />}
            </div>
            {categoryLabel && (
              <div
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: NEX.cyan,
                  opacity: 0.85,
                }}
              >
                {categoryLabel}
              </div>
            )}
            <div
              style={{
                marginTop: 2,
                fontSize: 12,
                color: NEX.textSecondary,
              }}
            >
              /nex-native/{business.slug}
            </div>
          </div>
        </div>

        {business.description && (
          <p
            style={{
              marginTop: 12,
              marginBottom: 0,
              fontSize: 13,
              color: NEX.textPrimary,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {business.description}
          </p>
        )}

        {business.city && (
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              color: NEX.textSecondary,
            }}
          >
            📍 {business.city}
          </div>
        )}

        {/* Bridge 43a · Directory-status indicator · founder doctrine
            2026-09-28: verified businesses are what buyers worldwide
            find in the NEX Directory. Unverified rows still exist but
            aren't Directory-listed. */}
        <div
          style={{
            marginTop: 12,
            padding: "8px 12px",
            borderRadius: 8,
            background: isVerified
              ? "rgba(0,175,255,0.10)"
              : "rgba(0,175,255,0.04)",
            border: `1px ${isVerified ? "solid" : "dashed"} ${
              isVerified ? NEX.cyan : `${NEX.cyan}66`
            }`,
            fontSize: 12,
            color: NEX.textPrimary,
            lineHeight: 1.45,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {isVerified ? (
            <>
              <VerifiedTick size={14} />
              <span>
                <strong style={{ color: NEX.cyan, fontWeight: 700 }}>
                  In the NEX Directory ·
                </strong>{" "}
                buyers worldwide can find you.
              </span>
            </>
          ) : (
            <>
              <span aria-hidden style={{ color: NEX.cyan, fontSize: 14 }}>
                ⏳
              </span>
              <span>
                <strong style={{ color: NEX.cyan, fontWeight: 700 }}>
                  Not in Directory yet ·
                </strong>{" "}
                finish setup and NEX will verify you.
              </span>
            </>
          )}
        </div>
      </div>

      <div
        style={{
          padding: 16,
          background: NEX.panel,
          border: `1px solid ${NEX.cyanFaint}`,
          borderRadius: 14,
        }}
      >
        <div style={{ fontSize: 13, color: NEX.textPrimary, lineHeight: 1.5 }}>
          Rich business editing — products, menu, hours, category,
          verification, gallery, staff — lives on the business editor.
        </div>
        <Link
          href="/nex-native/manage/shop"
          style={{
            display: "inline-flex",
            marginTop: 12,
            padding: "10px 18px",
            background: NEX.cyan,
            color: "#0B0F1A",
            border: "none",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          Open business editor →
        </Link>
      </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------
// Field primitives · dark chat-card palette
// ---------------------------------------------------------------------

function FieldGroup(props: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset style={{ marginBottom: 16, padding: 0, border: "none" }}>
      <legend
        style={{
          marginBottom: 8,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: NEX.textSecondary,
        }}
      >
        {props.legend}
      </legend>
      {props.children}
    </fieldset>
  );
}

function RadioRow(props: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
  muted?: boolean;
  dataOption?: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        background: NEX.fieldBg,
        border: `1px solid ${NEX.cyanFaint}`,
        fontSize: 13,
        color: props.muted ? NEX.textSecondary : NEX.textPrimary,
        cursor: "pointer",
      }}
      data-nex-profile-kind-option={props.dataOption}
    >
      <input
        type="radio"
        name={props.name}
        value={props.value}
        defaultChecked={props.defaultChecked}
        style={{ accentColor: NEX.cyan }}
      />
      <span>{props.label}</span>
    </label>
  );
}

function TextField(props: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 12,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: NEX.textSecondary,
      }}
    >
      {props.label}
      <input
        type="text"
        name={props.name}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        data-nex-profile-input={props.name}
        style={{
          display: "block",
          marginTop: 6,
          width: "100%",
          minHeight: 44,
          padding: "10px 12px",
          background: NEX.fieldBg,
          color: NEX.textPrimary,
          border: `1px solid ${NEX.cyanFaint}`,
          borderRadius: 8,
          fontSize: 14,
          fontFamily: "inherit",
          letterSpacing: 0,
          textTransform: "none",
          fontWeight: 400,
        }}
      />
    </label>
  );
}

function TextAreaField(props: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
}) {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 12,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: NEX.textSecondary,
      }}
    >
      {props.label}
      <textarea
        name={props.name}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        rows={props.rows ?? 4}
        data-nex-profile-textarea={props.name}
        style={{
          display: "block",
          marginTop: 6,
          width: "100%",
          padding: "10px 12px",
          background: NEX.fieldBg,
          color: NEX.textPrimary,
          border: `1px solid ${NEX.cyanFaint}`,
          borderRadius: 8,
          fontSize: 14,
          fontFamily: "inherit",
          letterSpacing: 0,
          textTransform: "none",
          fontWeight: 400,
          resize: "vertical",
          lineHeight: 1.5,
        }}
      />
    </label>
  );
}

function VerifiedTick({ size = 14 }: { size?: number } = {}) {
  return (
    <span
      aria-label="Verified by NEX"
      title="Verified by NEX"
      style={{
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: NEX.cyan,
        color: "#0B0F1A",
        lineHeight: 1,
      }}
    >
      <svg
        width={size * 0.68}
        height={size * 0.68}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M5 12 L10 17 L20 6" />
      </svg>
    </span>
  );
}
