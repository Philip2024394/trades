// src/app/nex-native/manage/profession/page.tsx
//
// Bridge Profession-E · seller picker for nex_business.profession_id.
// Shows every profession grouped by vertical. Selecting one writes
// ONLY profession_id · nothing else changes.
//
// Below the picker is a preview panel showing the new terminology the
// buyer will see (catalog heading, action labels, location label) so
// the seller understands the impact BEFORE they save. If the picked
// profession suggests a DIFFERENT cover template than their current
// one, we surface that as a note · we never auto-swap.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import {
  getProfessionById,
  listProfessions,
  listVerticals,
  type NexProfessionRow,
  type NexVerticalRow,
} from "@/lib/nex-native/terminology-service";
import {
  GLOBAL_DEFAULT_TERMINOLOGY,
  mergeTerminology,
  type NexTerminology,
} from "@/lib/nex-native/terminology";
import { setBusinessProfessionAction } from "./_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#050f1e",
  border: "rgba(139, 169, 209, 0.18)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  green: "#16D66B",
  red: "#FF3355",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function ManageProfessionPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; m?: string; ok?: string }>;
}) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const okBanner = sp.ok === "1";

  const businesses = await businessService.listBusinessesByOwner(
    session.account.id,
  );
  if (businesses.length === 0) {
    redirect("/nex-native/onboarding?commerce=1");
  }
  const business = businesses[0];
  const [verticals, professions, currentProfession] = await Promise.all([
    listVerticals(),
    listProfessions(),
    getProfessionById(business.profession_id ?? null),
  ]);

  const currentVertical = currentProfession
    ? verticals.find((v) => v.id === currentProfession.vertical_id) ?? null
    : null;

  // Compute the terminology the buyer will see under the current
  // profession selection (or global default if none). Verticals seed
  // full defaults · profession rows only override.
  const previewTerminology: NexTerminology = currentProfession
    ? mergeTerminology(
        mergeTerminology(
          GLOBAL_DEFAULT_TERMINOLOGY,
          (currentVertical?.default_terminology ?? null) as
            | Record<string, unknown>
            | null,
        ),
        (currentProfession.default_terminology ?? null) as
          | Record<string, unknown>
          | null,
      )
    : GLOBAL_DEFAULT_TERMINOLOGY;

  const suggestedLayoutId =
    currentProfession?.default_cover_layout_id ??
    currentVertical?.default_cover_layout_id ??
    null;
  const currentLayoutId = business.cover_layout_id ?? null;
  const layoutMismatch =
    !!suggestedLayoutId &&
    !!currentLayoutId &&
    suggestedLayoutId !== currentLayoutId;

  // Group professions by vertical for the <select> element.
  const groups: {
    vertical: NexVerticalRow;
    rows: NexProfessionRow[];
  }[] = verticals.map((v) => ({
    vertical: v,
    rows: professions.filter((p) => p.vertical_id === v.id),
  }));

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        padding: "22px 18px 60px",
      }}
    >
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <header style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            Bridge Profession-E · Founder-sealed 2026-09-30
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            Profession
          </h1>
          <p
            style={{
              marginTop: 8,
              color: NEX.textDim,
              fontSize: 13,
              lineHeight: 1.55,
              maxWidth: 620,
            }}
          >
            Tell NEX what your business does. Your profession chooses the
            words your cover uses (Menu vs Products vs Portfolio vs
            Services) and suggests which cover template fits · it never
            overwrites anything you've already set on{" "}
            <Link
              href="/nex-native/manage/shop"
              style={{ color: NEX.cyan, textDecoration: "none" }}
            >
              /manage/shop
            </Link>{" "}
            or in your info pages. You can change profession anytime.
          </p>
        </header>

        {banner && (
          <div
            role="alert"
            style={{
              marginBottom: 14,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(255, 51, 85, 0.14)",
              border: `1px solid ${NEX.red}`,
              color: "#FFB4C0",
              fontSize: 13,
            }}
          >
            <strong style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10 }}>
              {banner.code}
            </strong>{" "}
            {banner.message}
          </div>
        )}
        {okBanner && (
          <div
            role="status"
            style={{
              marginBottom: 14,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(22, 214, 107, 0.12)",
              border: `1px solid ${NEX.green}`,
              color: "#8FF3C1",
              fontSize: 13,
            }}
          >
            Saved · your cover terminology has been updated. Your other
            settings, images, and template were left untouched.
          </div>
        )}

        {/* Picker form */}
        <section
          style={{
            padding: "18px 20px",
            borderRadius: 14,
            border: `1px solid ${NEX.border}`,
            background: NEX.panel,
            marginBottom: 22,
          }}
        >
          <form
            action={setBusinessProfessionAction.bind(null, business.id)}
            style={{ display: "grid", gap: 14 }}
          >
            <label style={{ display: "grid", gap: 6 }}>
              <span style={eyebrowStyle()}>Your profession</span>
              <select
                name="profession_id"
                defaultValue={business.profession_id ?? ""}
                style={selectStyle()}
              >
                <option value="">
                  {"— None (generic terminology)"}
                </option>
                {groups.map(({ vertical, rows }) => (
                  <optgroup key={vertical.id} label={vertical.label}>
                    {rows.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div>
              <button type="submit" style={primaryButtonStyle()}>
                Save profession
              </button>
            </div>
          </form>
        </section>

        {/* Preview panel · shows the resolved terminology for the
            CURRENTLY SAVED profession (not the form's current dropdown
            value). Sellers read this to understand what the buyer will
            see today. */}
        <section
          style={{
            padding: "18px 20px",
            borderRadius: 14,
            border: `1px solid ${NEX.border}`,
            background: NEX.panel,
            marginBottom: 22,
          }}
        >
          <h2 style={h2Style()}>
            What your buyer sees today
          </h2>
          <div
            style={{
              marginBottom: 12,
              fontSize: 13,
              color: NEX.textDim,
              lineHeight: 1.5,
            }}
          >
            {currentProfession
              ? `Profession · ${currentProfession.label}` +
                (currentVertical ? ` · ${currentVertical.label}` : "")
              : "No profession set · using generic labels."}
          </div>
          <TerminologyList terminology={previewTerminology} />
          {layoutMismatch && suggestedLayoutId && currentLayoutId && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(0, 175, 255, 0.08)",
                border: `1px solid ${NEX.cyanSoft}`,
                fontSize: 12,
                color: NEX.text,
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: NEX.cyan }}>Note:</strong> your
              profession suggests the{" "}
              <code style={codeStyle()}>{suggestedLayoutId}</code> cover
              template. You currently have{" "}
              <code style={codeStyle()}>{currentLayoutId}</code>. We{" "}
              <em>won't</em> swap this automatically · visit{" "}
              <Link
                href="/nex-native/manage/shop"
                style={{ color: NEX.cyan, textDecoration: "none" }}
              >
                /manage/shop
              </Link>{" "}
              to change template if you'd like.
            </div>
          )}
        </section>

        <div style={{ marginTop: 10 }}>
          <Link
            href="/nex-native/manage/shop"
            style={{
              fontSize: 12,
              color: NEX.cyan,
              textDecoration: "none",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            ‹ Back to /manage/shop
          </Link>
        </div>
      </div>
    </main>
  );
}

function TerminologyList({ terminology }: { terminology: NexTerminology }) {
  const rows: { key: string; label: string; value: string }[] = [
    { key: "catalog_heading", label: "Catalog heading", value: terminology.catalog_heading },
    { key: "catalog_action_label", label: "Catalog action", value: terminology.catalog_action_label },
    { key: "primary_action_label", label: "Primary action", value: terminology.primary_action_label },
    { key: "section_about_label", label: "About section", value: terminology.section_about_label },
    { key: "section_location_label", label: "Location section", value: terminology.section_location_label },
    { key: "story_eyebrow", label: "Story eyebrow", value: terminology.story_eyebrow },
  ];
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((r) => (
        <div
          key={r.key}
          style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr",
            gap: 12,
            fontSize: 13,
            padding: "6px 0",
            borderBottom: `1px solid ${NEX.border}`,
          }}
        >
          <div style={{ color: NEX.textDim, fontWeight: 700 }}>{r.label}</div>
          <div style={{ color: NEX.text }}>{r.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Style helpers ──────────────────────────────────────────────────

function h2Style(): React.CSSProperties {
  return {
    margin: 0,
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: NEX.cyan,
    marginBottom: 12,
  };
}

function eyebrowStyle(): React.CSSProperties {
  return {
    fontSize: 10,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: NEX.textDim,
    fontWeight: 700,
  };
}

function selectStyle(): React.CSSProperties {
  return {
    appearance: "none",
    padding: "10px 14px",
    borderRadius: 8,
    border: `1px solid ${NEX.border}`,
    background: NEX.bg,
    color: NEX.text,
    fontFamily: SANS,
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    cursor: "pointer",
  };
}

function primaryButtonStyle(): React.CSSProperties {
  return {
    appearance: "none",
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: NEX.cyan,
    color: "#03101D",
    fontFamily: SANS,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    cursor: "pointer",
  };
}

function codeStyle(): React.CSSProperties {
  return {
    fontFamily: "ui-monospace, monospace",
    fontSize: 11,
    padding: "1px 6px",
    borderRadius: 4,
    background: NEX.bg,
    border: `1px solid ${NEX.border}`,
    color: NEX.cyan,
  };
}
