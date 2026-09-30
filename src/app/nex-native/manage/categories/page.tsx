// src/app/nex-native/manage/categories/page.tsx
//
// Category Tabs · sealed 2026-09-30 · seller-facing dedicated management
// surface for nex_product_section. Mirrors the visual language of
// /manage/menu and /manage/products (dark navy panel, cyan eyebrow,
// orange accents).
//
// Features:
//   · List existing sections with product count
//   · Add a new section (inline form · hard cap of 3 enforced server-side)
//   · Rename section (inline form · one-word rule enforced server-side)
//   · Reorder up/down
//   · Delete: empty → single click · non-empty → dropdown to reassign
//
// Restaurants keep managing menu sections via /manage/menu (Bridge 15b).
// This page is products-only.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as productSectionService from "@/lib/nex-native/product-section-service";
import {
  createProductSectionAction,
  renameProductSectionAction,
  reorderProductSectionAction,
  deleteProductSectionAction,
} from "./_actions";

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
  amber: "#F59E0B",
  red: "#FF3355",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function ManageCategoriesPage({
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

  const sections = await productSectionService.listSectionsByBusiness(
    business.id,
  );
  const counts = await productSectionService.countProductsPerSection(
    business.id,
  );

  const atMax =
    sections.length >= productSectionService.NEX_PRODUCT_SECTION_MAX;

  return (
    <div style={{ background: NEX.bg, color: NEX.text, minHeight: "100dvh" }}>
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "24px 20px 100px",
          fontFamily: SANS,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
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
              Shop
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              Categories
            </h1>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: NEX.textDim,
                lineHeight: 1.5,
              }}
            >
              Group your products by one-word categories. Up to{" "}
              <strong style={{ color: NEX.text }}>
                {productSectionService.NEX_PRODUCT_SECTION_MAX}
              </strong>{" "}
              per shop. Shown as tabs on your cover and in the peer-chat
              shop slider.
            </div>
          </div>
          <Link
            href="/nex-native/manage/products"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${NEX.borderStrong}`,
              color: NEX.textDim,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            ← Products
          </Link>
        </div>

        {banner ? (
          <Banner tone="error" title={banner.code}>
            {banner.message}
          </Banner>
        ) : null}
        {okBanner ? (
          <Banner tone="success" title="Saved">
            Your categories were updated.
          </Banner>
        ) : null}

        {/* Add form */}
        <section
          style={{
            background: NEX.panelSoft,
            border: `1px solid ${NEX.border}`,
            borderRadius: 12,
            padding: 16,
            marginBottom: 22,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            New category
          </div>
          {atMax ? (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: NEX.textDim,
                lineHeight: 1.5,
              }}
            >
              You&apos;ve used all{" "}
              {productSectionService.NEX_PRODUCT_SECTION_MAX} slots.
              Rename or delete an existing category to add a new one.
            </p>
          ) : (
            <form
              action={createProductSectionAction.bind(null, business.id)}
              style={{ display: "flex", gap: 8 }}
            >
              <input
                name="name"
                required
                placeholder="Electronic"
                maxLength={20}
                pattern="[A-Za-z0-9\-]{1,20}"
                title="One word · letters, numbers, hyphens · up to 20 chars"
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: NEX.bg,
                  border: `1px solid ${NEX.border}`,
                  color: NEX.text,
                  fontFamily: SANS,
                  fontSize: 13,
                }}
              />
              <button
                type="submit"
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: NEX.orange,
                  color: NEX.text,
                  fontFamily: SANS,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  cursor: "pointer",
                }}
              >
                Add
              </button>
            </form>
          )}
          <div
            style={{
              marginTop: 8,
              fontSize: 10,
              color: NEX.textMute,
              lineHeight: 1.5,
            }}
          >
            One word only · letters, numbers, or hyphens · up to 20
            characters. Example: Electronic · Babyclothes · Footware.
          </div>
        </section>

        {/* Existing sections */}
        {sections.length === 0 ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: NEX.textDim,
              fontSize: 13,
              lineHeight: 1.55,
              border: `1px dashed ${NEX.border}`,
              borderRadius: 12,
            }}
          >
            No categories yet. Add up to{" "}
            {productSectionService.NEX_PRODUCT_SECTION_MAX} above.
            Uncategorised products always appear under an{" "}
            <strong style={{ color: NEX.text }}>All</strong> tab.
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: 10,
            }}
          >
            {sections.map((s, i) => {
              const productCount = counts.get(s.id) ?? 0;
              const otherSections = sections.filter((x) => x.id !== s.id);
              return (
                <li
                  key={s.id}
                  style={{
                    background: NEX.panel,
                    border: `1px solid ${NEX.border}`,
                    borderRadius: 12,
                    padding: 14,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <form
                      action={renameProductSectionAction.bind(null, s.id)}
                      style={{ display: "flex", gap: 6, flex: 1 }}
                    >
                      <input
                        name="name"
                        defaultValue={s.name}
                        required
                        maxLength={20}
                        pattern="[A-Za-z0-9\-]{1,20}"
                        title="One word · letters, numbers, hyphens · up to 20 chars"
                        style={{
                          flex: 1,
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: NEX.bg,
                          border: `1px solid ${NEX.border}`,
                          color: NEX.text,
                          fontFamily: SANS,
                          fontSize: 14,
                          fontWeight: 700,
                        }}
                      />
                      <button
                        type="submit"
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: `1px solid ${NEX.borderStrong}`,
                          background: "transparent",
                          color: NEX.textDim,
                          fontFamily: SANS,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          cursor: "pointer",
                        }}
                      >
                        Rename
                      </button>
                    </form>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: "rgba(0,175,255,0.10)",
                        border: `1px solid ${NEX.cyanSoft}`,
                        color: NEX.cyan,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {productCount} {productCount === 1 ? "product" : "products"}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <ReorderButton
                      sectionId={s.id}
                      dir="up"
                      disabled={i === 0}
                    />
                    <ReorderButton
                      sectionId={s.id}
                      dir="down"
                      disabled={i === sections.length - 1}
                    />
                    <div style={{ flex: 1 }} />
                    {productCount === 0 ? (
                      <form
                        action={deleteProductSectionAction.bind(null, s.id)}
                      >
                        <input
                          type="hidden"
                          name="reassign_to"
                          value=""
                        />
                        <button
                          type="submit"
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: `1px solid rgba(255,51,85,0.4)`,
                            background: "transparent",
                            color: NEX.red,
                            fontFamily: SANS,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </form>
                    ) : (
                      <form
                        action={deleteProductSectionAction.bind(null, s.id)}
                        style={{ display: "flex", gap: 6 }}
                      >
                        <select
                          name="reassign_to"
                          required
                          defaultValue=""
                          style={{
                            padding: "6px 8px",
                            borderRadius: 8,
                            background: NEX.bg,
                            border: `1px solid ${NEX.border}`,
                            color: NEX.text,
                            fontFamily: SANS,
                            fontSize: 12,
                          }}
                        >
                          <option value="" disabled>
                            Move {productCount} to…
                          </option>
                          <option value="__uncategorised__">
                            Uncategorised
                          </option>
                          {otherSections.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: `1px solid rgba(255,51,85,0.4)`,
                            background: "transparent",
                            color: NEX.red,
                            fontFamily: SANS,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

function ReorderButton({
  sectionId,
  dir,
  disabled,
}: {
  sectionId: string;
  dir: "up" | "down";
  disabled: boolean;
}) {
  return (
    <form action={reorderProductSectionAction.bind(null, sectionId)}>
      <input type="hidden" name="dir" value={dir} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={dir === "up" ? "Move up" : "Move down"}
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          border: `1px solid ${NEX.borderStrong}`,
          background: "transparent",
          color: disabled ? NEX.textMute : NEX.textDim,
          fontFamily: SANS,
          fontSize: 14,
          fontWeight: 700,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {dir === "up" ? "↑" : "↓"}
      </button>
    </form>
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
