// src/app/nex-native/manage/info/page.tsx
//
// Info Pages · sealed 2026-09-30 · seller edit surface for the cover
// composer + info tray.
// -----------------------------------------------------------------------------
// One scroll · a section per sealed button (About Us · Delivery · Hours ·
// Payment · Returns · Catering (venue) · Gallery (venue) · Custom orders ·
// Services / What we fix) + a Custom Buttons block. Every section has:
//   · A single on/off toggle (checkbox)
//   · Either an inline textarea (free-text sections) or a "Edit content
//     on /manage/shop" link (sections whose data lives on other columns)
//
// Custom buttons: up to 3 rows · icon picker (30 curated emoji) · label
// (1-24 chars) · body (0-400 chars) · optional https image_url · optional
// https external_url. Each row has its own on/off toggle so the seller
// can draft a button and hide it while still saved.
//
// Server Component · one Server Action powers Save (see ./_actions.ts).

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import { isVenueCategory } from "@/lib/nex-native/types";
import { getInfoPages } from "@/lib/nex-native/info-pages-service";
import {
  isInfoPageEnabled,
  isCustomButtonEnabled,
  NEX_INFO_BODY_MAX,
  NEX_INFO_CUSTOM_ICONS,
  NEX_INFO_MAX_CUSTOM_BUTTONS,
  NEX_INFO_PAGE_META,
  NEX_INFO_TITLE_MAX,
  type NexInfoCustomButton,
  type NexInfoPageKey,
} from "@/lib/nex-native/info-pages";
import { updateInfoPagesAction } from "./_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#050f1e",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  orange: "#FF7200",
  green: "#16D66B",
  red: "#FF3355",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function ManageInfoPage({
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
  const pages = (await getInfoPages(business.id)) ?? {};
  const isVenue = isVenueCategory(business.business_category);
  const isProductOrService = !isVenue;

  const saveBound = updateInfoPagesAction.bind(null, business.id);

  // Pre-compute button rows (pad to MAX so the form always renders 3
  // draftable rows).
  const customButtons: (NexInfoCustomButton | null)[] = [
    ...(pages.custom_buttons ?? []),
  ];
  while (customButtons.length < NEX_INFO_MAX_CUSTOM_BUTTONS) {
    customButtons.push(null);
  }

  return (
    <div style={{ background: NEX.bg, color: NEX.text, minHeight: "100dvh" }}>
      <main
        style={{
          maxWidth: 780,
          margin: "0 auto",
          padding: "24px 20px 100px",
          fontFamily: SANS,
        }}
      >
        <PageHeader />
        {banner && <Banner tone="error" title={banner.code}>{banner.message}</Banner>}
        {okBanner && <Banner tone="success" title="Saved">Your info pages were updated.</Banner>}

        <form action={saveBound} style={{ display: "grid", gap: 18 }}>
          {/* ── Sealed sections ─────────────────────────────────────── */}
          <SealedSection
            keyId="about_us"
            enabled={isInfoPageEnabled(pages, "about_us")}
            editHref="/nex-native/manage/shop"
            editLabel="Edit description on /manage/shop"
            preview={business.description ?? "(no description yet)"}
            visible={true}
          />

          <FreeTextSection
            keyId="delivery"
            enabled={isInfoPageEnabled(pages, "delivery")}
            initialValue={pages.delivery_details ?? ""}
            name="delivery_details"
            placeholder="e.g. We deliver Ubud + Denpasar 08:00-21:00 · last order 20:30"
            help="Answer the delivery questions buyers ask: where, how, how long, cutoff time."
            visible={true}
          />

          <SealedSection
            keyId="hours"
            enabled={isInfoPageEnabled(pages, "hours")}
            editHref="/nex-native/manage/shop"
            editLabel="Edit opening hours on /manage/shop"
            preview={business.hours_display ?? "(hours not set)"}
            visible={true}
          />

          <SealedSection
            keyId="payment"
            enabled={isInfoPageEnabled(pages, "payment")}
            editHref="/nex-native/manage/shop"
            editLabel="Edit payment methods on /manage/shop"
            preview={
              (business.accepted_payment_methods ?? []).length > 0
                ? (business.accepted_payment_methods ?? []).join(", ")
                : "(no payment methods set)"
            }
            visible={true}
          />

          <SealedSection
            keyId="returns"
            enabled={isInfoPageEnabled(pages, "returns")}
            editHref="/nex-native/manage/shop"
            editLabel="Edit return policy on /manage/shop"
            preview={
              business.return_policy
                ? "Return policy set (edit to review)"
                : "(no return policy yet)"
            }
            visible={true}
          />

          <SealedSection
            keyId="catering"
            enabled={isInfoPageEnabled(pages, "catering")}
            editHref="/nex-native/manage/venue"
            editLabel="Edit events profile on /manage/venue"
            preview={
              business.events_profile
                ? "Events profile set (edit to review)"
                : "(no events profile yet)"
            }
            visible={isVenue}
          />

          <SealedSection
            keyId="gallery"
            enabled={isInfoPageEnabled(pages, "gallery")}
            editHref="/nex-native/manage/venue"
            editLabel="Edit venue photos on /manage/venue"
            preview={
              (business.venue_gallery ?? []).filter(Boolean).length > 0
                ? `${(business.venue_gallery ?? []).filter(Boolean).length} photo(s)`
                : "(no venue photos yet)"
            }
            visible={isVenue}
          />

          <FreeTextSection
            keyId="custom_orders"
            enabled={isInfoPageEnabled(pages, "custom_orders")}
            initialValue={pages.custom_orders ?? ""}
            name="custom_orders"
            placeholder="e.g. Yes — pick your own filling, packaging, message on the box"
            help="Answer: can buyers customise? Own packaging? Bulk quantities?"
            visible={isProductOrService}
          />

          <FreeTextSection
            keyId="services"
            enabled={isInfoPageEnabled(pages, "services")}
            initialValue={pages.services_scope ?? ""}
            name="services_scope"
            placeholder="e.g. iPhones, Samsungs, MacBooks · genuine + aftermarket parts"
            help="What models / brands / parts you handle. Buyers filter their questions from this."
            visible={isProductOrService}
          />

          {/* ── Custom buttons ──────────────────────────────────────── */}
          <div
            style={{
              background: NEX.panelSoft,
              border: `1px solid ${NEX.border}`,
              borderRadius: 12,
              padding: 16,
              display: "grid",
              gap: 14,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: NEX.orange,
                  fontWeight: 700,
                  marginBottom: 2,
                }}
              >
                Custom buttons
              </div>
              <div style={{ fontSize: 12, color: NEX.textDim, lineHeight: 1.5 }}>
                Up to {NEX_INFO_MAX_CUSTOM_BUTTONS}. Pick an icon, name the
                button, write the content. Leave the name blank to skip a row.
              </div>
            </div>
            {customButtons.map((btn, i) => (
              <CustomButtonRow key={i} idx={i} btn={btn} />
            ))}
          </div>

          <button
            type="submit"
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              border: "none",
              background: NEX.orange,
              color: NEX.text,
              fontFamily: SANS,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.06em",
              cursor: "pointer",
            }}
          >
            SAVE INFO PAGES
          </button>
        </form>
      </main>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function PageHeader() {
  return (
    <div style={{ marginBottom: 20 }}>
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
        Cover
      </div>
      <h1
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.01em",
        }}
      >
        Info buttons
      </h1>
      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          color: NEX.textDim,
          lineHeight: 1.5,
        }}
      >
        These buttons appear when a visitor taps the{" "}
        <span
          style={{
            display: "inline-block",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: NEX.cyan,
            color: NEX.bg,
            fontWeight: 800,
            textAlign: "center",
            lineHeight: "18px",
            fontSize: 14,
            verticalAlign: "middle",
          }}
        >
          +
        </span>{" "}
        on your cover composer. Toggle any button off if it doesn&apos;t
        apply to your shop.
      </div>
    </div>
  );
}

function SectionHeader({
  keyId,
  enabled,
  visible,
}: {
  keyId: NexInfoPageKey;
  enabled: boolean;
  visible: boolean;
}) {
  const meta = NEX_INFO_PAGE_META[keyId];
  if (!visible) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 8,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          <span aria-hidden style={{ fontSize: 18 }}>
            {meta.icon}
          </span>
          {meta.label}
        </div>
        <div style={{ fontSize: 11, color: NEX.textDim, marginTop: 2 }}>
          {meta.blurb}
        </div>
      </div>
      <ToggleSwitch name={`enabled__${keyId}`} defaultChecked={enabled} />
    </div>
  );
}

function ToggleSwitch({
  name,
  defaultChecked,
}: {
  name: string;
  defaultChecked: boolean;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        style={{ accentColor: NEX.cyan, width: 18, height: 18 }}
      />
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: NEX.textDim,
          fontWeight: 700,
        }}
      >
        show
      </span>
    </label>
  );
}

function SealedSection({
  keyId,
  enabled,
  editHref,
  editLabel,
  preview,
  visible,
}: {
  keyId: NexInfoPageKey;
  enabled: boolean;
  editHref: string;
  editLabel: string;
  preview: string;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <section
      style={{
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
        borderRadius: 12,
        padding: 14,
      }}
    >
      <SectionHeader keyId={keyId} enabled={enabled} visible={visible} />
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          background: "rgba(0,0,0,0.28)",
          border: `1px solid ${NEX.border}`,
          fontSize: 12,
          color: NEX.textDim,
          lineHeight: 1.5,
          marginBottom: 8,
          whiteSpace: "pre-wrap",
        }}
      >
        {preview}
      </div>
      <Link
        href={editHref}
        style={{
          fontSize: 11,
          color: NEX.cyan,
          textDecoration: "none",
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        {editLabel} →
      </Link>
    </section>
  );
}

function FreeTextSection({
  keyId,
  enabled,
  initialValue,
  name,
  placeholder,
  help,
  visible,
}: {
  keyId: NexInfoPageKey;
  enabled: boolean;
  initialValue: string;
  name: string;
  placeholder: string;
  help: string;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <section
      style={{
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
        borderRadius: 12,
        padding: 14,
      }}
    >
      <SectionHeader keyId={keyId} enabled={enabled} visible={visible} />
      <textarea
        name={name}
        defaultValue={initialValue}
        placeholder={placeholder}
        maxLength={NEX_INFO_BODY_MAX}
        rows={4}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 8,
          background: NEX.bg,
          border: `1px solid ${NEX.border}`,
          color: NEX.text,
          fontFamily: SANS,
          fontSize: 13,
          resize: "vertical",
          minHeight: 80,
        }}
      />
      <div
        style={{
          marginTop: 6,
          fontSize: 10,
          color: NEX.textMute,
          lineHeight: 1.5,
        }}
      >
        {help} · max {NEX_INFO_BODY_MAX} chars.
      </div>
    </section>
  );
}

function CustomButtonRow({
  idx,
  btn,
}: {
  idx: number;
  btn: NexInfoCustomButton | null;
}) {
  const enabled = btn ? isCustomButtonEnabled(btn) : true;
  return (
    <div
      style={{
        border: `1px dashed ${NEX.border}`,
        borderRadius: 10,
        padding: 12,
        display: "grid",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: NEX.textDim,
            fontWeight: 700,
          }}
        >
          Custom button {idx + 1}
        </div>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            name={`custom__${idx}__enabled`}
            defaultChecked={enabled}
            style={{ accentColor: NEX.cyan, width: 16, height: 16 }}
          />
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.textDim,
              fontWeight: 700,
            }}
          >
            show
          </span>
        </label>
      </div>

      <input
        type="hidden"
        name={`custom__${idx}__id`}
        defaultValue={btn?.id ?? ""}
      />

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.textMute,
              fontWeight: 700,
            }}
          >
            Icon
          </span>
          <select
            name={`custom__${idx}__icon`}
            defaultValue={btn?.icon ?? "✨"}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              background: NEX.bg,
              border: `1px solid ${NEX.border}`,
              color: NEX.text,
              fontFamily: SANS,
              fontSize: 16,
              appearance: "auto",
              minWidth: 68,
            }}
          >
            {NEX_INFO_CUSTOM_ICONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.textMute,
              fontWeight: 700,
            }}
          >
            Label (max {NEX_INFO_TITLE_MAX})
          </span>
          <input
            type="text"
            name={`custom__${idx}__label`}
            defaultValue={btn?.label ?? ""}
            maxLength={NEX_INFO_TITLE_MAX}
            placeholder="e.g. Beans we use"
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              background: NEX.bg,
              border: `1px solid ${NEX.border}`,
              color: NEX.text,
              fontFamily: SANS,
              fontSize: 13,
            }}
          />
        </label>
      </div>

      <label style={{ display: "grid", gap: 4 }}>
        <span
          style={{
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: NEX.textMute,
            fontWeight: 700,
          }}
        >
          Content (max {NEX_INFO_BODY_MAX})
        </span>
        <textarea
          name={`custom__${idx}__body`}
          defaultValue={btn?.body ?? ""}
          maxLength={NEX_INFO_BODY_MAX}
          rows={3}
          placeholder="Short paragraph the buyer reads when they tap this button."
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            background: NEX.bg,
            border: `1px solid ${NEX.border}`,
            color: NEX.text,
            fontFamily: SANS,
            fontSize: 13,
            resize: "vertical",
            minHeight: 64,
          }}
        />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.textMute,
              fontWeight: 700,
            }}
          >
            Image URL (https · optional)
          </span>
          <input
            type="url"
            name={`custom__${idx}__image_url`}
            defaultValue={btn?.image_url ?? ""}
            placeholder="https://…"
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              background: NEX.bg,
              border: `1px solid ${NEX.border}`,
              color: NEX.text,
              fontFamily: SANS,
              fontSize: 12,
            }}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.textMute,
              fontWeight: 700,
            }}
          >
            External link (https · optional)
          </span>
          <input
            type="url"
            name={`custom__${idx}__external_url`}
            defaultValue={btn?.external_url ?? ""}
            placeholder="https://…"
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              background: NEX.bg,
              border: `1px solid ${NEX.border}`,
              color: NEX.text,
              fontFamily: SANS,
              fontSize: 12,
            }}
          />
        </label>
      </div>
    </div>
  );
}

function Banner({
  tone,
  title,
  children,
}: {
  tone: "success" | "error";
  title: string;
  children: React.ReactNode;
}) {
  const color = tone === "success" ? NEX.green : NEX.red;
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        border: `1px solid ${color}55`,
        background: `${color}12`,
        color: NEX.text,
        marginBottom: 14,
        fontSize: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color,
          fontWeight: 700,
          marginBottom: 2,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
