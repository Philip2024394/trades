// src/app/nex-native/manage/products/[productId]/page.tsx
//
// Bridge 20 · Seller-facing Specifications editor for a product.
// --------------------------------------------------------------
// One page, one product, one big form. Every field in the
// NexProductSpec schema is exposed as a labelled input. Empty
// fields are dropped on save by product-service's normaliseSpec
// so the JSONB stays lean.
//
// Owner-gated · non-owners get redirected. Dark-navy NEX identity
// matching /manage/shop and /manage/menu.

import type * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as productService from "@/lib/nex-native/product-service";
import * as businessService from "@/lib/nex-native/business-service";
import * as productSectionService from "@/lib/nex-native/product-section-service";
import type { NexProductSpec } from "@/lib/nex-native/types";
import {
  updateProductSpecAction,
  createProductVariantAction,
  deleteProductVariantAction,
} from "../../../_actions";
import { assignProductToSectionAction } from "../../categories/_actions";
import {
  NEX_VARIANT_ATTRIBUTES,
  NEX_PRODUCT_STOCK_STATUSES,
} from "@/lib/nex-native/types";

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
  orangeSoft: "rgba(255,114,0,0.6)",
  green: "#16D66B",
  red: "#FF3355",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function ManageProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ e?: string; m?: string }>;
}) {
  const { productId } = await params;
  const sp = await searchParams;
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const product = await productService.getProductById(productId);
  if (!product) notFound();
  const business = await businessService.getBusinessById(product.business_id);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect(
      "/nex-native/manage?e=spec_forbidden&m=" +
        encodeURIComponent("You don't own this product"),
    );
  }

  const spec: NexProductSpec = product.spec ?? {};
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const action = updateProductSpecAction.bind(null, productId);
  const createVariantBound = createProductVariantAction.bind(null, productId);
  // Category Tabs · sealed 2026-09-30. Fetch this product's owner's
  // sections + the product's current section_id (may be null).
  const productSections =
    await productSectionService.listSectionsByBusiness(business.id);
  const atMaxSections =
    productSections.length >=
    productSectionService.NEX_PRODUCT_SECTION_MAX;
  const assignSectionBound = assignProductToSectionAction.bind(
    null,
    productId,
  );
  // Fetch existing variants for the grouped list.
  const variants = await productService.listVariants(productId);
  const variantsByAttribute = new Map<string, typeof variants>();
  for (const v of variants) {
    const key = v.attribute ?? "other";
    const arr = variantsByAttribute.get(key) ?? [];
    arr.push(v);
    variantsByAttribute.set(key, arr);
  }

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
          padding: "calc(env(safe-area-inset-top, 0) + 14px) 20px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${NEX.border}`,
        }}
      >
        <Link
          href="/nex-native/manage"
          style={{
            fontSize: 11,
            color: NEX.textDim,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          ← Manage
        </Link>
        <Link
          href={`/nex-native/${business.slug}/${product.id}`}
          style={{
            fontSize: 11,
            color: NEX.cyan,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          View product ↗
        </Link>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "36px 20px" }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: NEX.orange,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          Product specifications
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontSize: 36,
            lineHeight: 1.1,
            letterSpacing: "-0.012em",
            fontWeight: 500,
            marginBottom: 6,
          }}
        >
          {product.name}
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 13,
            lineHeight: 1.6,
            color: NEX.textDim,
          }}
        >
          Everything below appears in the Specifications section on
          your product page · empty fields are silent (nothing to
          hide). Comma-separated lists for materials, included
          items, certifications, export markets.
        </p>

        {banner && <Banner code={banner.code} message={banner.message} />}

        {/* Category Tabs · sealed 2026-09-30 · quick section picker with
            inline create-on-type. Full management lives at
            /nex-native/manage/categories. Hard cap of 3 enforced in
            product-section-service. */}
        <section
          style={{
            background: NEX.panelSoft,
            border: `1px solid ${NEX.border}`,
            borderRadius: 12,
            padding: 14,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 10,
              gap: 8,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: NEX.cyan,
                  fontWeight: 700,
                  marginBottom: 2,
                }}
              >
                Category
              </div>
              <div style={{ fontSize: 12, color: NEX.textDim }}>
                One-word tab that groups this product on your cover and in
                the peer-chat shop slider.
              </div>
            </div>
            <Link
              href="/nex-native/manage/categories"
              style={{
                fontSize: 11,
                color: NEX.cyan,
                textDecoration: "none",
                whiteSpace: "nowrap",
                letterSpacing: "0.04em",
                fontWeight: 700,
              }}
            >
              Manage all →
            </Link>
          </div>

          <form
            action={assignSectionBound}
            style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            <select
              name="section_id"
              defaultValue={product.section_id ?? "__uncategorised__"}
              style={{
                flex: "1 1 180px",
                padding: "10px 12px",
                borderRadius: 8,
                background: NEX.bg,
                border: `1px solid ${NEX.border}`,
                color: NEX.text,
                fontFamily: SANS,
                fontSize: 13,
                appearance: "auto",
              }}
            >
              <option value="__uncategorised__">— Uncategorised —</option>
              {productSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {!atMaxSections && (
              <input
                type="text"
                name="section_name"
                placeholder="or type a new one"
                maxLength={20}
                pattern="[A-Za-z0-9\-]{1,20}"
                title="One word · letters, numbers, hyphens · up to 20 chars"
                style={{
                  flex: "1 1 160px",
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: NEX.bg,
                  border: `1px solid ${NEX.border}`,
                  color: NEX.text,
                  fontFamily: SANS,
                  fontSize: 13,
                }}
              />
            )}
            <button
              type="submit"
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: NEX.cyan,
                color: NEX.bg,
                fontFamily: SANS,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.04em",
                cursor: "pointer",
              }}
            >
              Save
            </button>
          </form>
          {atMaxSections && (
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: NEX.textMute,
              }}
            >
              You&apos;ve used all 3 category slots. Pick from the list
              above or manage them at{" "}
              <Link
                href="/nex-native/manage/categories"
                style={{ color: NEX.cyan, textDecoration: "underline" }}
              >
                /manage/categories
              </Link>
              .
            </div>
          )}
        </section>

        <form
          action={action}
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
        >
          {/* --- IDENTITY --------------------------------------------- */}
          <FieldGroup title="Identity" eyebrow="Universal">
            <TwoCol>
              <FormRow label="Brand">
                <input
                  type="text"
                  name="brand"
                  defaultValue={spec.brand ?? ""}
                  maxLength={80}
                  placeholder="e.g. Leica, Nikon, Aisha Vintage"
                  style={inputStyle}
                />
              </FormRow>
              <FormRow label="Model">
                <input
                  type="text"
                  name="model"
                  defaultValue={spec.model ?? ""}
                  maxLength={80}
                  placeholder="e.g. M3, F2A, Custom"
                  style={inputStyle}
                />
              </FormRow>
            </TwoCol>
            <TwoCol>
              <FormRow label="Condition">
                <select
                  name="condition"
                  defaultValue={spec.condition ?? ""}
                  style={{ ...inputStyle, appearance: "auto" }}
                >
                  <option value="">— pick —</option>
                  <option value="new">New</option>
                  <option value="used">Used</option>
                  <option value="refurbished">Refurbished</option>
                  <option value="vintage">Vintage</option>
                  <option value="new_old_stock">New Old Stock</option>
                </select>
              </FormRow>
              <FormRow label="Authenticity">
                <select
                  name="authenticity"
                  defaultValue={spec.authenticity ?? ""}
                  style={{ ...inputStyle, appearance: "auto" }}
                >
                  <option value="">— pick —</option>
                  <option value="verified_original">✓ Verified original</option>
                  <option value="authenticated_vintage">
                    ✓ Authenticated vintage
                  </option>
                  <option value="reproduction">Reproduction</option>
                  <option value="unspecified">Unspecified</option>
                </select>
              </FormRow>
            </TwoCol>
            <TwoCol>
              <FormRow label="Origin (city, country)">
                <input
                  type="text"
                  name="origin"
                  defaultValue={spec.origin ?? ""}
                  maxLength={120}
                  placeholder="e.g. Jakarta, Indonesia"
                  style={inputStyle}
                />
              </FormRow>
              <FormRow label="Year produced">
                <input
                  type="number"
                  name="year_produced"
                  defaultValue={spec.year_produced ?? ""}
                  min={1800}
                  max={new Date().getFullYear() + 1}
                  placeholder="e.g. 1954"
                  style={inputStyle}
                />
              </FormRow>
            </TwoCol>
          </FieldGroup>

          {/* --- PHYSICAL --------------------------------------------- */}
          <FieldGroup title="Physical" eyebrow="Materials + size">
            <FormRow
              label="Materials (comma-separated)"
              hint="e.g. leather, brass, glass"
            >
              <input
                type="text"
                name="materials"
                defaultValue={(spec.materials ?? []).join(", ")}
                maxLength={400}
                placeholder="leather, brass, glass"
                style={inputStyle}
              />
            </FormRow>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 90px",
                gap: 10,
              }}
            >
              <FormRow label="Width">
                <input
                  type="number"
                  name="dim_w"
                  defaultValue={spec.dimensions?.w ?? ""}
                  step="0.1"
                  style={inputStyle}
                />
              </FormRow>
              <FormRow label="Height">
                <input
                  type="number"
                  name="dim_h"
                  defaultValue={spec.dimensions?.h ?? ""}
                  step="0.1"
                  style={inputStyle}
                />
              </FormRow>
              <FormRow label="Depth">
                <input
                  type="number"
                  name="dim_d"
                  defaultValue={spec.dimensions?.d ?? ""}
                  step="0.1"
                  style={inputStyle}
                />
              </FormRow>
              <FormRow label="Unit">
                <select
                  name="dim_unit"
                  defaultValue={spec.dimensions?.unit ?? "mm"}
                  style={{ ...inputStyle, appearance: "auto" }}
                >
                  <option value="mm">mm</option>
                  <option value="cm">cm</option>
                  <option value="m">m</option>
                  <option value="in">in</option>
                </select>
              </FormRow>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 10 }}>
              <FormRow label="Weight">
                <input
                  type="number"
                  name="weight_value"
                  defaultValue={spec.weight?.value ?? ""}
                  step="0.1"
                  style={inputStyle}
                />
              </FormRow>
              <FormRow label="Unit">
                <select
                  name="weight_unit"
                  defaultValue={spec.weight?.unit ?? "g"}
                  style={{ ...inputStyle, appearance: "auto" }}
                >
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="oz">oz</option>
                  <option value="lb">lb</option>
                </select>
              </FormRow>
            </div>
          </FieldGroup>

          {/* --- INCLUDED + WARRANTY + SAFETY ------------------------ */}
          <FieldGroup title="Inclusions & assurance" eyebrow="Trust">
            <FormRow
              label="What's in the box (comma-separated)"
              hint="e.g. camera body, leather case, manual"
            >
              <input
                type="text"
                name="included"
                defaultValue={(spec.included ?? []).join(", ")}
                maxLength={800}
                placeholder="camera body, leather case, manual"
                style={inputStyle}
              />
            </FormRow>
            <TwoCol>
              <FormRow label="Warranty">
                <input
                  type="text"
                  name="warranty"
                  defaultValue={spec.warranty ?? ""}
                  maxLength={140}
                  placeholder="e.g. 6 months manufacturer"
                  style={inputStyle}
                />
              </FormRow>
              <FormRow label="Age rating">
                <input
                  type="text"
                  name="age_rating"
                  defaultValue={spec.age_rating ?? ""}
                  maxLength={40}
                  placeholder="e.g. 3+ years, adult"
                  style={inputStyle}
                />
              </FormRow>
            </TwoCol>
            <FormRow
              label="Certifications (comma-separated)"
              hint="e.g. SNI-4523, CE, RoHS, halal"
            >
              <input
                type="text"
                name="certifications"
                defaultValue={(spec.certifications ?? []).join(", ")}
                maxLength={400}
                placeholder="SNI-4523, CE, RoHS, halal"
                style={inputStyle}
              />
            </FormRow>
            <FormRow label="Care instructions">
              <textarea
                name="care_instructions"
                defaultValue={spec.care_instructions ?? ""}
                maxLength={600}
                rows={2}
                placeholder="e.g. Wipe with soft cloth · keep dry"
                style={{
                  ...inputStyle,
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
            </FormRow>
          </FieldGroup>

          {/* --- SERVICE-SPECIFIC ----------------------------------- */}
          <FieldGroup
            title="Services (if applicable)"
            eyebrow="Salon · beauty · consultancy · fitness"
          >
            <TwoCol>
              <FormRow label="Duration">
                <input
                  type="text"
                  name="duration"
                  defaultValue={spec.duration ?? ""}
                  maxLength={80}
                  placeholder="e.g. 60-90 min"
                  style={inputStyle}
                />
              </FormRow>
              <FormRow label="Where">
                <select
                  name="service_location"
                  defaultValue={spec.service_location ?? ""}
                  style={{ ...inputStyle, appearance: "auto" }}
                >
                  <option value="">— pick —</option>
                  <option value="at_home">🏠 At your home</option>
                  <option value="at_shop">🏬 At the shop</option>
                  <option value="online">💻 Online</option>
                  <option value="outdoor">🌳 Outdoor</option>
                  <option value="custom">📍 Custom</option>
                </select>
              </FormRow>
            </TwoCol>
            <TwoCol>
              <FormRow label="Advance booking">
                <input
                  type="text"
                  name="advance_booking"
                  defaultValue={spec.advance_booking ?? ""}
                  maxLength={80}
                  placeholder="e.g. 24 hours notice"
                  style={inputStyle}
                />
              </FormRow>
              <FormRow label="Age range">
                <input
                  type="text"
                  name="age_range"
                  defaultValue={spec.age_range ?? ""}
                  maxLength={40}
                  placeholder="e.g. any age, 18+"
                  style={inputStyle}
                />
              </FormRow>
            </TwoCol>
          </FieldGroup>

          {/* --- MANUFACTURER-SPECIFIC ------------------------------ */}
          <FieldGroup
            title="Manufacturers (if applicable)"
            eyebrow="Product-brand · construction · export"
          >
            <TwoCol>
              <FormRow label="HS code (customs)">
                <input
                  type="text"
                  name="hs_code"
                  defaultValue={spec.hs_code ?? ""}
                  maxLength={20}
                  placeholder="e.g. 4202.11.00"
                  style={inputStyle}
                />
              </FormRow>
              <FormRow label="Factory location">
                <input
                  type="text"
                  name="factory_location"
                  defaultValue={spec.factory_location ?? ""}
                  maxLength={120}
                  placeholder="e.g. Tangerang, Indonesia"
                  style={inputStyle}
                />
              </FormRow>
            </TwoCol>
            <FormRow
              label="Export markets (ISO codes · comma-separated)"
              hint="e.g. ID, SG, MY, AU"
            >
              <input
                type="text"
                name="export_markets"
                defaultValue={(spec.export_markets ?? []).join(", ")}
                maxLength={200}
                placeholder="ID, SG, MY, AU"
                style={inputStyle}
              />
            </FormRow>
            <TwoCol>
              <FormRow label="Production capacity">
                <input
                  type="text"
                  name="production_capacity"
                  defaultValue={spec.production_capacity ?? ""}
                  maxLength={80}
                  placeholder="e.g. 500 units/month"
                  style={inputStyle}
                />
              </FormRow>
              <FormRow label="Lead time">
                <input
                  type="text"
                  name="lead_time"
                  defaultValue={spec.lead_time ?? ""}
                  maxLength={80}
                  placeholder="e.g. 4-6 weeks"
                  style={inputStyle}
                />
              </FormRow>
            </TwoCol>
          </FieldGroup>

          <button type="submit" style={primaryButtonStyle}>
            Save Specifications
          </button>
        </form>

        {/* --- VARIANTS EDITOR (Bridge 20b) ----------------------- */}
        <section
          style={{
            marginTop: 32,
            padding: "20px 22px",
            borderRadius: 18,
            background: NEX.panelSoft,
            border: `1px solid ${NEX.border}`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            Variants
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.005em",
              marginBottom: 4,
            }}
          >
            Size · Colour · Package · Duration
          </h2>
          <p
            style={{
              margin: "0 0 18px",
              fontSize: 13,
              lineHeight: 1.55,
              color: NEX.textDim,
            }}
          >
            Each variant belongs to an <b>attribute axis</b>. Buyers
            see one picker per axis (Size · Colour · etc.) instead of
            a flat list. Optional price override + per-variant stock
            status.
          </p>

          {/* Existing variants grouped by attribute */}
          {variants.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
              {Array.from(variantsByAttribute.entries()).map(
                ([axis, list]) => (
                  <div key={axis}>
                    <div
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        color: NEX.textMute,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      {formatAttributeLabel(axis)}
                    </div>
                    <div
                      style={{ display: "flex", flexDirection: "column", gap: 6 }}
                    >
                      {list.map((v) => (
                        <div
                          key={v.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto auto auto",
                            gap: 10,
                            alignItems: "center",
                            padding: "10px 12px",
                            borderRadius: 10,
                            background: "rgba(0,0,0,0.32)",
                            border: `1px solid ${NEX.border}`,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {v.name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: NEX.textDim,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {v.price_pence
                              ? `Rp ${(v.price_pence / 100).toLocaleString("id-ID")}`
                              : "same price"}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              padding: "2px 8px",
                              borderRadius: 999,
                              border: `1px solid ${NEX.borderStrong}`,
                              color: v.stock_status === "sold_out" ? NEX.red : NEX.textDim,
                              background:
                                v.stock_status === "sold_out"
                                  ? "rgba(255,51,85,0.10)"
                                  : "rgba(139,169,209,0.05)",
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {v.stock_status
                              ? v.stock_status.replace(/_/g, " ")
                              : "in stock"}
                          </div>
                          <form
                            action={deleteProductVariantAction.bind(
                              null,
                              v.id,
                            )}
                          >
                            <input
                              type="hidden"
                              name="product_id"
                              value={productId}
                            />
                            <button
                              type="submit"
                              style={{
                                padding: "4px 10px",
                                borderRadius: 999,
                                background: "rgba(255,51,85,0.08)",
                                border: "1px solid rgba(255,51,85,0.30)",
                                color: NEX.red,
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                cursor: "pointer",
                                fontFamily: "inherit",
                              }}
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}

          {/* Add-a-variant form */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "rgba(0,175,255,0.06)",
              border: `1px solid ${NEX.cyanSoft}`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: NEX.cyan,
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              Add a variant
            </div>
            <form
              action={createVariantBound}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  gap: 10,
                }}
              >
                <FormRow label="Attribute">
                  <select
                    name="attribute"
                    required
                    defaultValue="size"
                    style={{ ...inputStyle, appearance: "auto" }}
                  >
                    {NEX_VARIANT_ATTRIBUTES.map((a) => (
                      <option key={a} value={a}>
                        {formatAttributeLabel(a)}
                      </option>
                    ))}
                  </select>
                </FormRow>
                <FormRow label="Name / value (e.g. XL · Red · Premium)">
                  <input
                    type="text"
                    name="name"
                    required
                    maxLength={100}
                    placeholder="e.g. XL, Red, Premium, 1 hour"
                    style={inputStyle}
                  />
                </FormRow>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <FormRow
                  label="Price override (IDR · optional)"
                  hint="Leave blank to inherit the product price"
                >
                  <input
                    type="number"
                    name="price_idr"
                    min={0}
                    max={99999999}
                    placeholder="e.g. 285000"
                    style={inputStyle}
                  />
                </FormRow>
                <FormRow label="Stock (optional)">
                  <select
                    name="stock_status"
                    defaultValue=""
                    style={{ ...inputStyle, appearance: "auto" }}
                  >
                    <option value="">— inherit —</option>
                    {NEX_PRODUCT_STOCK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </FormRow>
              </div>
              <button type="submit" style={{ ...primaryButtonStyle, marginTop: 4 }}>
                Add variant
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

function formatAttributeLabel(a: string): string {
  return a.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* --------------------------------------------------------------------- *
 * Sub-components                                                        *
 * --------------------------------------------------------------------- */

function FieldGroup({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        padding: "20px 22px",
        borderRadius: 18,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          {eyebrow}
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-0.005em",
          }}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
    >
      {children}
    </div>
  );
}

function FormRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: NEX.textMute,
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      {children}
      {hint && (
        <span style={{ fontSize: 11, color: NEX.textMute, lineHeight: 1.5 }}>
          {hint}
        </span>
      )}
    </label>
  );
}

function Banner({ code, message }: { code: string; message: string }) {
  const isError = !code.endsWith("_ok");
  return (
    <div
      role="status"
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: isError
          ? "rgba(255,51,85,0.10)"
          : "rgba(22,214,107,0.10)",
        border: `1px solid ${
          isError ? "rgba(255,51,85,0.35)" : "rgba(22,214,107,0.35)"
        }`,
        color: isError ? "#FFB4C0" : "#B8F1CC",
        fontSize: 13,
        marginBottom: 18,
      }}
    >
      {message}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(0,0,0,0.35)",
  border: `1px solid ${NEX.borderStrong}`,
  color: NEX.text,
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "14px 18px",
  borderRadius: 14,
  background: "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
  border: `1px solid ${NEX.orangeSoft}`,
  color: "#0B0F1A",
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
  fontFamily: "inherit",
  boxShadow:
    "0 12px 30px rgba(255,114,0,0.35), inset 0 1px 0 rgba(255,255,255,0.28)",
};
