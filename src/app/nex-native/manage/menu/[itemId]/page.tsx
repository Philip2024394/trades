// src/app/nex-native/manage/menu/[itemId]/page.tsx
//
// Bridge 23c-2 · Edit an existing dish · perks, spice, price,
// description, section. Owner-only. Sibling of the create form on
// /manage/menu · this page pre-fills every field so a seller can
// adjust their Free-Delivery flag, spice level, or dietary tags long
// after the dish went live.

import type * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as menuService from "@/lib/nex-native/menu-service";
import {
  NEX_MENU_DIETARY_TAGS,
  NEX_MENU_ALLERGENS,
  NEX_MENU_PERKS,
  NEX_MENU_PERK_LABELS,
  NEX_MENU_PERK_ICONS,
} from "@/lib/nex-native/menu-service";
import { updateMenuItemAction } from "../../../_actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  orangeSoft: "rgba(255,114,0,0.6)",
  green: "#16D66B",
  amber: "#F59E0B",
  red: "#FF3355",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const SPICE_LABEL: Record<number, string> = {
  0: "None",
  1: "Mild",
  2: "Medium",
  3: "Hot",
  4: "Very Hot",
  5: "Volcano",
};

export const metadata = { title: "NEX · Edit dish" };

export default async function EditDishPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const item = await menuService.getMenuItemById(itemId);
  if (!item) notFound();

  const business = await businessService.getBusinessById(item.business_id);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect("/nex-native/manage/menu");
  }

  const sections = await menuService.listSectionsByBusiness(business.id);
  const updateBound = updateMenuItemAction.bind(null, item.id);

  const priceIdr = Math.round(item.price_pence / 100);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        paddingBottom: 80,
      }}
    >
      <header
        style={{
          padding: "calc(env(safe-area-inset-top, 0) + 14px) 16px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${NEX.border}`,
        }}
      >
        <Link
          href="/nex-native/manage/menu"
          style={{
            fontSize: 11,
            color: NEX.textDim,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          ← Menu
        </Link>
        <Link
          href={`/nex-native/${business.slug}/menu`}
          style={{
            fontSize: 11,
            color: NEX.cyan,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          Preview →
        </Link>
      </header>

      <main
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "28px 16px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: NEX.orange,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Editing dish
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize: 32,
              lineHeight: 1.08,
              letterSpacing: "-0.015em",
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            {item.name}
          </h1>
          <div style={{ fontSize: 13, color: NEX.textDim }}>
            Change anything · save at the bottom.
          </div>
        </div>

        <form
          action={updateBound}
          style={{
            padding: "20px 20px",
            borderRadius: 18,
            background: NEX.panelSoft,
            border: `1px solid ${NEX.borderStrong}`,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <Row label="Section">
            <select
              name="section_id"
              defaultValue={item.section_id ?? ""}
              style={selectStyle}
            >
              <option value="">No section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Row>

          <Row label="Dish name">
            <input
              type="text"
              name="name"
              defaultValue={item.name}
              maxLength={120}
              required
              style={inputStyle}
            />
          </Row>

          <Row label="Description">
            <textarea
              name="description"
              defaultValue={item.description ?? ""}
              rows={3}
              maxLength={800}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Row>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <Row label="Price (Rp)">
              <input
                type="number"
                name="price_idr"
                defaultValue={priceIdr}
                min={0}
                inputMode="numeric"
                required
                style={inputStyle}
              />
            </Row>
            <Row label="Photo URL">
              <input
                type="url"
                name="image_url"
                defaultValue={item.image_url ?? ""}
                maxLength={800}
                placeholder="https://…"
                style={inputStyle}
              />
            </Row>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <Row label="Portion note">
              <input
                type="text"
                name="portion_note"
                defaultValue={item.portion_note ?? ""}
                maxLength={80}
                placeholder="Serves 1"
                style={inputStyle}
              />
            </Row>
            <Row label="Prep time">
              <input
                type="text"
                name="preparation_time"
                defaultValue={item.preparation_time ?? ""}
                maxLength={80}
                placeholder="10 min"
                style={inputStyle}
              />
            </Row>
          </div>

          {/* Spice level */}
          <Row label="Spice level">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[0, 1, 2, 3, 4, 5].map((lvl) => (
                <label key={lvl} style={pillLabel}>
                  <input
                    type="radio"
                    name="spice_level"
                    value={lvl}
                    defaultChecked={item.spice_level === lvl}
                    style={{ accentColor: NEX.orange }}
                  />
                  {lvl > 0 ? "🌶".repeat(lvl) : "None"}
                  {lvl > 0 && (
                    <span style={{ color: NEX.textMute }}>
                      {SPICE_LABEL[lvl]}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </Row>

          {/* Dietary */}
          <Row label="Dietary tags">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {NEX_MENU_DIETARY_TAGS.map((tag) => (
                <label key={tag} style={pillLabel}>
                  <input
                    type="checkbox"
                    name="dietary_tags"
                    value={tag}
                    defaultChecked={item.dietary_tags.includes(tag)}
                    style={{ accentColor: NEX.green }}
                  />
                  {tag}
                </label>
              ))}
            </div>
          </Row>

          {/* Allergens */}
          <Row label="Allergens">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {NEX_MENU_ALLERGENS.map((a) => (
                <label key={a} style={pillLabel}>
                  <input
                    type="checkbox"
                    name="allergens"
                    value={a}
                    defaultChecked={item.allergens.includes(a)}
                    style={{ accentColor: NEX.amber }}
                  />
                  {a}
                </label>
              ))}
            </div>
          </Row>

          {/* Perks · Bridge 23a */}
          <Row label="Free perks with this dish">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {NEX_MENU_PERKS.map((perk) => {
                const isFreeDelivery = perk === "free_delivery";
                return (
                  <label
                    key={perk}
                    style={{
                      ...pillLabel,
                      background: isFreeDelivery
                        ? "rgba(22,214,107,0.10)"
                        : pillLabel.background,
                      border: `1px solid ${
                        isFreeDelivery
                          ? "rgba(22,214,107,0.35)"
                          : NEX.borderStrong
                      }`,
                      color: isFreeDelivery ? "#B8F1CC" : NEX.textDim,
                    }}
                  >
                    <input
                      type="checkbox"
                      name="perks"
                      value={perk}
                      defaultChecked={(item.perks ?? []).includes(perk)}
                      style={{ accentColor: NEX.green }}
                    />
                    <span aria-hidden>{NEX_MENU_PERK_ICONS[perk]}</span>
                    {NEX_MENU_PERK_LABELS[perk]}
                  </label>
                );
              })}
            </div>
            <input
              type="text"
              name="perks_note"
              defaultValue={item.perks_note ?? ""}
              maxLength={200}
              placeholder='If you ticked "Other Perk", describe it here (optional)'
              style={{ ...inputStyle, marginTop: 10 }}
            />
          </Row>

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: NEX.textDim,
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            <input
              type="checkbox"
              name="is_featured"
              defaultChecked={item.is_featured}
              style={{ accentColor: NEX.orange }}
            />
            Feature this dish · shows on the shop landing preview card
          </label>

          <button
            type="submit"
            style={{
              alignSelf: "flex-start",
              padding: "12px 20px",
              borderRadius: 12,
              background: "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
              border: `1px solid ${NEX.orangeSoft}`,
              color: "#0B0F1A",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: SANS,
              boxShadow:
                "0 10px 24px rgba(255,114,0,0.35), inset 0 1px 0 rgba(255,255,255,0.28)",
            }}
          >
            Save changes
          </button>
        </form>
      </main>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: NEX.cyan,
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(0,0,0,0.35)",
  border: `1px solid ${NEX.border}`,
  color: NEX.text,
  fontSize: 13,
  fontFamily: SANS,
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none" as const,
  WebkitAppearance: "none" as const,
  MozAppearance: "none" as const,
};

const pillLabel: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  borderRadius: 999,
  border: `1px solid ${NEX.borderStrong}`,
  background: "rgba(0,0,0,0.28)",
  color: NEX.textDim,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};
