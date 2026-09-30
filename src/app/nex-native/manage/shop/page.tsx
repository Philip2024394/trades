// src/app/nex-native/manage/shop/page.tsx
//
// Seller shop-settings surface · Bridge 13b.
// ------------------------------------------
// The signed-in seller lands here to control:
//   · Away mode · toggle on/off, optional return date, optional
//     buyer-facing message. Drives is_away / away_until /
//     away_message on nex_business (migration 063 columns).
//   · Product stock status · quick per-product control · updates
//     nex_product.stock_status via productService.
//
// Server Component · reads the current owner's businesses + live
// products · renders forms bound to Server Actions.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import {
  setBusinessAwayModeAction,
  endBusinessAwayModeAction,
  updateProductStockStatusAction,
  updateProductTurnaroundAction,
  updateBusinessCategoryAndKeywordsAction,
  updateBusinessPaymentMethodsAction,
  updateBusinessCityAndHoursAction,
  updateBusinessLocationAction,
  setBusinessSafeTradeActivatedAction,
  updateReturnPolicyAction,
} from "../../_actions";
import {
  NEX_RETURN_REASONS,
  NEX_RETURN_SHIPPING_PAID_BY,
  NEX_RETURN_LEGAL_MIN_WINDOW_DAYS,
  NEX_RETURN_LEGAL_MIN_REFUND_DAYS,
  NEX_RETURN_POLICY_DEFAULT,
} from "@/lib/nex-native/types";
import { NEX_BUSINESS_CATEGORIES } from "@/lib/nex-native/site-templates";
import { isVenueCategory } from "@/lib/nex-native/types";
import { SellerLocationEditor } from "./_location-editor";
import {
  NEX_PAYMENT_METHODS,
  NEX_PAYMENT_METHOD_META,
  NEX_SHIPPING_SCOPES,
  NEX_SHIPPING_SCOPE_META,
} from "@/lib/nex-native/business-service";
import { updateBusinessShippingScopeAction } from "./_shipping-scope-action";
import {
  uploadBusinessQrCodeAction,
  clearBusinessQrCodeAction,
} from "./_qr-code-action";

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
  amber: "#F59E0B",
  purple: "#A384FF",
};

const STOCK_LABEL: Record<string, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  made_to_order: "Made to order",
  sold_out: "Sold out",
};

export default async function ShopSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; m?: string }>;
}) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const sp = await searchParams;
  const banner =
    sp.e && sp.m ? { code: sp.e, message: sp.m } : null;

  const businesses = await businessService.listBusinessesByOwner(
    session.account.id,
  );
  const business = businesses[0] ?? null;

  if (!business) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          display: "grid",
          placeItems: "center",
          padding: 20,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 340 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Shop settings
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            You don&apos;t have a shop yet
          </h1>
          <p
            style={{
              margin: "12px 0 20px",
              fontSize: 14,
              color: NEX.textDim,
              lineHeight: 1.55,
            }}
          >
            Create your first business on NEX to unlock the shop
            settings surface.
          </p>
          <Link
            href="/nex-native/manage/site/new"
            style={{
              display: "inline-block",
              padding: "12px 20px",
              borderRadius: 12,
              background: NEX.orange,
              color: "#0B0F1A",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              boxShadow: "0 8px 22px rgba(255,114,0,0.35)",
            }}
          >
            Start your NEX
          </Link>
        </div>
      </div>
    );
  }

  const products = await productService.listProductsByBusiness(
    business.id,
  );

  const setAwayBound = setBusinessAwayModeAction.bind(null, business.id);
  const endAwayBound = endBusinessAwayModeAction.bind(null, business.id);
  const categoryBound = updateBusinessCategoryAndKeywordsAction.bind(
    null,
    business.id,
  );
  const paymentsBound = updateBusinessPaymentMethodsAction.bind(
    null,
    business.id,
  );
  const uploadQrBound = uploadBusinessQrCodeAction.bind(null, business.id);
  const clearQrBound = clearBusinessQrCodeAction.bind(null, business.id);
  const currentQrUrl = business.qr_code_image_url ?? null;
  const acceptsQrisDelivery = (
    business.accepted_payment_methods ?? []
  ).includes("qris_delivery");
  const cityHoursBound = updateBusinessCityAndHoursAction.bind(
    null,
    business.id,
  );
  const locationBound = updateBusinessLocationAction.bind(null, business.id);
  const accepted = new Set(business.accepted_payment_methods ?? ["cod"]);
  const shippingScopeBound = updateBusinessShippingScopeAction.bind(
    null,
    business.id,
  );
  const currentShippingScope = business.shipping_scope ?? null;
  const isVenue = isVenueCategory(business.business_category);
  const awayUntilInputValue = business.away_until
    ? new Date(business.away_until).toISOString().slice(0, 10)
    : "";

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: 48,
      }}
    >
      {/* --- Top bar ------------------------------------------------ */}
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
          href="/nex-native/manage"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: NEX.textDim,
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          ← Manage
        </Link>
        <Link
          href={`/nex-native/${business.slug}`}
          style={{
            fontSize: 11,
            color: NEX.cyan,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          View shop ↗
        </Link>
      </header>

      <main
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "24px 20px",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          Shop settings
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            marginBottom: 24,
          }}
        >
          {business.display_name}
        </h1>

        {banner && <Banner code={banner.code} message={banner.message} />}

        {isVenueCategory(business.business_category) && (
          <Link
            href="/nex-native/manage/venue"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "14px 16px",
              borderRadius: 14,
              background: "rgba(245,158,11,0.10)",
              border: "1px solid rgba(245,158,11,0.35)",
              textDecoration: "none",
              color: NEX.text,
              marginBottom: 12,
              boxShadow: "0 8px 22px rgba(245,158,11,0.18)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "#F59E0B",
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                🎉 Venue profile
              </div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                Events, capacity, live music, private hire
              </div>
              <div
                style={{ fontSize: 12, color: NEX.textDim, marginTop: 2 }}
              >
                Add photos of the space · tell buyers what you can host.
              </div>
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#F59E0B",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              Open →
            </div>
          </Link>
        )}

        {(business.business_category === "restaurant" ||
          business.business_category === "cafe") && (
          <Link
            href="/nex-native/manage/menu"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "14px 16px",
              borderRadius: 14,
              background: "rgba(255,114,0,0.10)",
              border: `1px solid ${NEX.orangeSoft}`,
              textDecoration: "none",
              color: NEX.text,
              marginBottom: 18,
              boxShadow: "0 8px 22px rgba(255,114,0,0.18)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: NEX.orange,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                Menu editor
              </div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                Build your menu · sections and dishes
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: NEX.textDim,
                  marginTop: 2,
                }}
              >
                Add starters, mains, drinks, sweets · toggle sold-out
                without deleting.
              </div>
            </div>
            <div
              style={{
                fontSize: 12,
                color: NEX.orange,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              Open →
            </div>
          </Link>
        )}

        {/* Bridge 49c · NEX Direct Price discovery link · always
            visible so every seller finds the ladder editor. */}
        <Link
          href="/nex-native/manage/ladder"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "14px 16px",
            borderRadius: 14,
            background: "rgba(255,114,0,0.10)",
            border: `1px solid ${NEX.orangeSoft}`,
            textDecoration: "none",
            color: NEX.text,
            marginBottom: 18,
            boxShadow: "0 8px 22px rgba(255,114,0,0.18)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: NEX.orange,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              NEX Direct Price
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              Loyalty ladder + share rewards
            </div>
            <div style={{ fontSize: 12, color: NEX.textDim, marginTop: 2 }}>
              More orders → bigger discount for buyers · you still net more than on GoFood
            </div>
          </div>
          <div
            style={{
              fontSize: 12,
              color: NEX.orange,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            Open →
          </div>
        </Link>

        {/* --- Away mode ------------------------------------------- */}
        <SectionCard>
          <SectionEyebrow color={business.is_away ? NEX.purple : NEX.cyan}>
            {business.is_away ? "Away mode · on" : "Away mode · off"}
          </SectionEyebrow>
          <h2
            style={{
              margin: "6px 0 6px",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.005em",
            }}
          >
            Set your shop to Away
          </h2>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 13,
              lineHeight: 1.55,
              color: NEX.textDim,
            }}
          >
            When Away is on, your shop shows a purple <b>Away</b> badge
            with your return date so buyers know what to expect.
            Listings stay live · chat still works. Sending any peer
            message automatically turns Away off.
          </p>

          {business.is_away ? (
            <form action={endAwayBound}>
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(163,132,255,0.10)",
                  border: `1px solid ${NEX.purple}`,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: NEX.purple,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  Currently away
                </div>
                {business.away_until && (
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    Back on{" "}
                    {new Date(business.away_until).toLocaleDateString(
                      undefined,
                      { day: "numeric", month: "short", year: "numeric" },
                    )}
                  </div>
                )}
                {business.away_message && (
                  <div
                    style={{
                      fontSize: 13,
                      color: "rgba(244,247,252,0.85)",
                      lineHeight: 1.55,
                    }}
                  >
                    {business.away_message}
                  </div>
                )}
              </div>
              <SubmitButton label="End Away mode now" tone="ghost" />
            </form>
          ) : (
            <form
              action={setAwayBound}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <FormRow label="Back on">
                <input
                  type="date"
                  name="away_until"
                  defaultValue={awayUntilInputValue}
                  min={new Date().toISOString().slice(0, 10)}
                  style={inputStyle}
                />
              </FormRow>
              <FormRow label="Message to buyers (optional)">
                <textarea
                  name="away_message"
                  rows={2}
                  maxLength={280}
                  placeholder="Away for Eid until 12 April · replies resume then"
                  defaultValue={business.away_message ?? ""}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    fontFamily: "inherit",
                    lineHeight: 1.5,
                  }}
                />
              </FormRow>
              <SubmitButton label="Turn Away on" tone="primary" />
            </form>
          )}
        </SectionCard>

        {/* --- Category + search keywords -------------------------- */}
        <SectionCard>
          <SectionEyebrow color={NEX.cyan}>
            Discovery
          </SectionEyebrow>
          <h2
            style={{
              margin: "6px 0 6px",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.005em",
            }}
          >
            Category &amp; search keywords
          </h2>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 13,
              lineHeight: 1.55,
              color: NEX.textDim,
            }}
          >
            Category tells buyers what your shop is · drives the
            category chip on your public page and the Directory
            facet. Keywords surface your shop when buyers search
            those terms · comma-separated · max 20.
          </p>
          <form
            action={categoryBound}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <FormRow label="Category">
              <select
                name="business_category"
                defaultValue={business.business_category ?? ""}
                style={{
                  ...inputStyle,
                  appearance: "auto",
                }}
              >
                <option value="">— Uncategorised —</option>
                {NEX_BUSINESS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {formatCategoryLabel(c)}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Search keywords (comma-separated)">
              <textarea
                name="search_keywords"
                rows={3}
                maxLength={800}
                placeholder="vintage cameras, film cameras, leica, jakarta, cla serviced"
                defaultValue={(business.search_keywords ?? []).join(", ")}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  fontFamily: "inherit",
                  lineHeight: 1.5,
                }}
              />
            </FormRow>
            <SubmitButton label="Save category & keywords" tone="primary" />
          </form>
        </SectionCard>

        {/* --- About page · city + opening hours (Bridge 16e) ------ */}
        <SectionCard>
          <SectionEyebrow color={NEX.cyan}>About page</SectionEyebrow>
          <h2
            style={{
              margin: "6px 0 6px",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.005em",
            }}
          >
            City &amp; opening hours
          </h2>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 13,
              lineHeight: 1.55,
              color: NEX.textDim,
            }}
          >
            Buyers see both on your About page. City helps local
            buyers know if they can meet or COD · opening hours set
            expectations for when to expect a reply.
          </p>
          <form
            action={cityHoursBound}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <FormRow label="City / neighbourhood">
              <input
                type="text"
                name="city"
                defaultValue={business.city ?? ""}
                maxLength={80}
                placeholder="e.g. Jakarta Selatan, Bandung, Ubud"
                style={inputStyle}
              />
            </FormRow>
            <FormRow label="Opening hours (single line)">
              <input
                type="text"
                name="hours_display"
                defaultValue={business.hours_display ?? ""}
                maxLength={200}
                placeholder="e.g. Mon-Sat 9am-6pm · closed Sunday"
                style={inputStyle}
              />
            </FormRow>
            <SubmitButton label="Save About page" tone="primary" />
          </form>
        </SectionCard>

        {/* --- Pickup location for bike-delivery estimate (Bridge 25d) --- */}
        <SectionCard>
          <SectionEyebrow color={NEX.orange}>Pickup location</SectionEyebrow>
          <h2
            style={{
              margin: "6px 0 6px",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.005em",
            }}
          >
            Where should couriers pick up from?
          </h2>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 13,
              lineHeight: 1.55,
              color: NEX.textDim,
            }}
          >
            Tap once when you&apos;re standing at your shop and NEX
            saves the coordinates. Buyers see an instant bike-delivery
            fare on the cart page (GoSend / GrabExpress / Maxim rate),
            so they know before they order what the courier will cost.
            Nothing is shown to buyers as a raw address · only the
            estimated fare.
          </p>
          <form
            action={locationBound}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <SellerLocationEditor
              initialLat={business.location_lat ?? null}
              initialLng={business.location_lng ?? null}
            />
            <SubmitButton
              label="Save pickup location"
              tone="primary"
            />
          </form>
        </SectionCard>

        {/* --- Safe-trade activation toggle (Bridge 17d) ----------- */}
        <SectionCard>
          <SectionEyebrow
            color={business.safe_trade_activated ? NEX.green : NEX.amber}
          >
            {business.safe_trade_activated
              ? "🛡 Safe trade · activated"
              : "🛡 Safe trade · NOT activated"}
          </SectionEyebrow>
          <h2
            style={{
              margin: "6px 0 6px",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.005em",
            }}
          >
            {business.safe_trade_activated
              ? "Buyers see a green safe-trade badge on every chat with you"
              : "Buyers see a warning until you commit to safe trade"}
          </h2>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 13,
              lineHeight: 1.55,
              color: NEX.textDim,
            }}
          >
            Activating safe trade means you commit to only accepting
            payment via one of the five NEX safe paths (COD, QRIS on
            delivery, Courier COD, Meet in person, Escrow). Buyers
            trust you more · you get more orders.
          </p>
          <form
            action={setBusinessSafeTradeActivatedAction.bind(
              null,
              business.id,
            )}
          >
            <input
              type="hidden"
              name="activated"
              value={business.safe_trade_activated ? "false" : "true"}
            />
            <SubmitButton
              label={
                business.safe_trade_activated
                  ? "Deactivate safe trade"
                  : "Activate safe trade"
              }
              tone={business.safe_trade_activated ? "ghost" : "primary"}
            />
          </form>
        </SectionCard>

        {/* --- Shipping scope (Migration 108 · sealed 2026-09-30) --- */}
        <SectionCard>
          <SectionEyebrow color={NEX.cyan}>Delivery</SectionEyebrow>
          <h2
            style={{
              margin: "6px 0 6px",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.005em",
            }}
          >
            How you fulfil orders
          </h2>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 13,
              lineHeight: 1.55,
              color: NEX.textDim,
            }}
          >
            Pick the option that matches your shop. This becomes the
            heading buyers see on your cover page (e.g. "Local Delivery"
            or "Local Delivery / Export"). You can change it any time.
          </p>
          <form
            action={shippingScopeBound}
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            {NEX_SHIPPING_SCOPES.filter((s) => {
              const meta = NEX_SHIPPING_SCOPE_META[s];
              return !meta.venueOnly || isVenue;
            }).map((s) => {
              const meta = NEX_SHIPPING_SCOPE_META[s];
              const isChecked = currentShippingScope === s;
              return (
                <label
                  key={s}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "24px 1fr",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: isChecked
                      ? "rgba(0,175,255,0.10)"
                      : "rgba(0,0,0,0.28)",
                    border: isChecked
                      ? `1px solid ${NEX.cyanSoft}`
                      : `1px solid ${NEX.border}`,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="shipping_scope"
                    value={s}
                    defaultChecked={isChecked}
                    style={{
                      accentColor: NEX.cyan,
                      width: 18,
                      height: 18,
                      marginTop: 2,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 700,
                        marginBottom: 2,
                      }}
                    >
                      <span aria-hidden>{meta.emoji}</span>
                      {meta.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: NEX.textDim,
                        lineHeight: 1.5,
                      }}
                    >
                      {meta.blurb}
                    </div>
                  </div>
                </label>
              );
            })}
            {/* Unset row · lets the seller clear the picker (falls
                back to the cover default). */}
            <label
              style={{
                display: "grid",
                gridTemplateColumns: "24px 1fr",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 12,
                background:
                  currentShippingScope === null
                    ? "rgba(139,169,209,0.08)"
                    : "rgba(0,0,0,0.16)",
                border:
                  currentShippingScope === null
                    ? `1px solid ${NEX.borderStrong}`
                    : `1px dashed ${NEX.border}`,
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="shipping_scope"
                value="__unset__"
                defaultChecked={currentShippingScope === null}
                style={{
                  accentColor: NEX.textDim,
                  width: 18,
                  height: 18,
                  marginTop: 2,
                }}
              />
              <div
                style={{
                  fontSize: 12,
                  color: NEX.textDim,
                  lineHeight: 1.5,
                }}
              >
                Not set · cover heading defaults to&nbsp;
                <em style={{ color: NEX.text }}>Local Delivery</em>.
              </div>
            </label>
            <SubmitButton label="Save delivery scope" tone="primary" />
          </form>
        </SectionCard>

        {/* --- Accepted payment methods (Bridge 16a) --------------- */}
        <SectionCard>
          <SectionEyebrow color={NEX.green}>Safe trade</SectionEyebrow>
          <h2
            style={{
              margin: "6px 0 6px",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.005em",
            }}
          >
            Payment methods you accept
          </h2>
          <p
            style={{
              margin: "0 0 6px",
              fontSize: 13,
              lineHeight: 1.55,
              color: NEX.textDim,
            }}
          >
            Tick every method you can take. Buyers see these as chips
            on your shop page. NEX never handles payments · every
            option keeps the buyer safe (they never pay before they
            receive, unless a third party is holding the money).
          </p>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 12,
              lineHeight: 1.55,
              color: NEX.textMute,
            }}
          >
            Learn how buyers stay protected on{" "}
            <Link
              href="/nex-native/safe-trade"
              style={{ color: NEX.cyan, textDecoration: "none" }}
            >
              /safe-trade
            </Link>
            .
          </p>
          <form
            action={paymentsBound}
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            {NEX_PAYMENT_METHODS.map((m) => {
              const meta = NEX_PAYMENT_METHOD_META[m];
              const isChecked = accepted.has(m);
              return (
                <label
                  key={m}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "24px 1fr",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: isChecked
                      ? "rgba(22,214,107,0.08)"
                      : "rgba(0,0,0,0.28)",
                    border: isChecked
                      ? `1px solid rgba(22,214,107,0.35)`
                      : `1px solid ${NEX.border}`,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    name="payment_methods"
                    value={m}
                    defaultChecked={isChecked}
                    style={{
                      accentColor: NEX.green,
                      width: 18,
                      height: 18,
                      marginTop: 2,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 700,
                        marginBottom: 2,
                      }}
                    >
                      <span aria-hidden>{meta.emoji}</span>
                      {meta.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: NEX.textDim,
                        lineHeight: 1.5,
                      }}
                    >
                      {meta.blurb}
                    </div>
                  </div>
                </label>
              );
            })}
            <SubmitButton label="Save payment methods" tone="primary" />
          </form>
        </SectionCard>

        {/* --- Payment QR image (Migration 110 · sealed 2026-09-30) - */}
        <SectionCard>
          <SectionEyebrow color={NEX.green}>Payment</SectionEyebrow>
          <h2
            style={{
              margin: "6px 0 6px",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.005em",
            }}
          >
            Your payment QR (QRIS · bank · e-wallet)
          </h2>
          <p
            style={{
              margin: "0 0 12px",
              fontSize: 13,
              lineHeight: 1.55,
              color: NEX.textDim,
            }}
          >
            Upload your QR image. Buyers see it inside the cover&apos;s
            Info tray → Payment panel and scan it with their own bank or
            e-wallet app. Money moves directly to you · NEX never
            touches funds.
          </p>
          {!acceptsQrisDelivery && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(245,158,11,0.10)",
                border: "1px solid rgba(245,158,11,0.35)",
                color: "#FFE8B0",
                fontSize: 12,
                lineHeight: 1.5,
                marginBottom: 14,
              }}
            >
              Tick <strong>📱 QRIS on Delivery</strong> in the payment
              methods above to make the QR panel appear on your cover.
              Uploading here is safe either way; it only renders when
              QRIS on Delivery is on.
            </div>
          )}
          {currentQrUrl ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 14,
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentQrUrl}
                alt="Current payment QR"
                style={{
                  width: 96,
                  height: 96,
                  objectFit: "cover",
                  borderRadius: 8,
                  border: `1px solid ${NEX.border}`,
                  background: "#fff",
                }}
              />
              <div style={{ display: "grid", gap: 6 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: NEX.textDim,
                    lineHeight: 1.5,
                  }}
                >
                  Current QR is live on your cover. Upload a new file
                  below to replace it, or clear it entirely.
                </div>
                <form action={clearQrBound}>
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
                    Clear QR
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(0,0,0,0.28)",
                border: `1px dashed ${NEX.border}`,
                color: NEX.textDim,
                fontSize: 12,
                lineHeight: 1.5,
                marginBottom: 12,
              }}
            >
              No QR uploaded yet. Once uploaded, buyers can scan it from
              the Info tray on your cover.
            </div>
          )}
          <form
            action={uploadQrBound}
            style={{ display: "grid", gap: 10 }}
            encType="multipart/form-data"
          >
            <input
              type="file"
              name="qr_image"
              accept="image/png,image/jpeg,image/webp"
              required
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
            <div style={{ fontSize: 10, color: NEX.textMute, lineHeight: 1.5 }}>
              png / jpg / webp · max 2MB · replaces the current QR if
              one is set.
            </div>
            <SubmitButton label="Upload QR image" tone="primary" />
          </form>
        </SectionCard>

        {/* --- Return policy (Bridge 21) ---------------------------- */}
        <SectionCard>
          <SectionEyebrow color={NEX.orange}>Return policy</SectionEyebrow>
          <h2
            style={{
              margin: "6px 0 6px",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.005em",
            }}
          >
            Your returns rules
          </h2>
          <p
            style={{
              margin: "0 0 12px",
              fontSize: 13,
              lineHeight: 1.55,
              color: NEX.textDim,
            }}
          >
            Indonesian consumer protection law (UU No 8/1999) requires
            at least a 7-day return window with a 3-day refund for
            defective / wrong-item / not-as-described orders. NEX
            enforces those minimums · you can extend them but can&apos;t
            go below. Everything below is what buyers see on your
            shop&apos;s{" "}
            <Link
              href={`/nex-native/${business.slug}/returns`}
              style={{ color: NEX.cyan, textDecoration: "none" }}
            >
              Returns page
            </Link>
            .
          </p>

          {(() => {
            const rp = business.return_policy ?? NEX_RETURN_POLICY_DEFAULT;
            const bound = updateReturnPolicyAction.bind(null, business.id);
            return (
              <form
                action={bound}
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: NEX.textDim,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    name="accepts_returns"
                    defaultChecked={rp.accepts_returns !== false}
                    style={{ accentColor: NEX.green }}
                  />
                  Accept returns (highly recommended · required by
                  Indonesian law for defective / wrong-item)
                </label>

                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
                >
                  <FormRow label={`Return window (days · min ${NEX_RETURN_LEGAL_MIN_WINDOW_DAYS})`}>
                    <input
                      type="number"
                      name="window_days"
                      defaultValue={rp.window_days ?? NEX_RETURN_LEGAL_MIN_WINDOW_DAYS}
                      min={NEX_RETURN_LEGAL_MIN_WINDOW_DAYS}
                      max={90}
                      style={inputStyle}
                    />
                  </FormRow>
                  <FormRow label={`Refund within (days · min ${NEX_RETURN_LEGAL_MIN_REFUND_DAYS})`}>
                    <input
                      type="number"
                      name="refund_days"
                      defaultValue={rp.refund_days ?? NEX_RETURN_LEGAL_MIN_REFUND_DAYS}
                      min={NEX_RETURN_LEGAL_MIN_REFUND_DAYS}
                      max={14}
                      style={inputStyle}
                    />
                  </FormRow>
                </div>

                <FormRow label="Accepted return reasons">
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
                  >
                    {NEX_RETURN_REASONS.map((r) => {
                      const isRequired = r === "defective" || r === "wrong_item";
                      const isSelected =
                        rp.accepts_reasons?.includes(r) || isRequired;
                      return (
                        <label
                          key={r}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "5px 10px",
                            borderRadius: 999,
                            border: isSelected
                              ? `1px solid ${NEX.cyanSoft}`
                              : `1px solid ${NEX.borderStrong}`,
                            background: isSelected
                              ? "rgba(0,175,255,0.10)"
                              : "rgba(0,0,0,0.28)",
                            color: isSelected ? NEX.text : NEX.textDim,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.02em",
                            cursor: isRequired ? "not-allowed" : "pointer",
                            opacity: isRequired ? 0.85 : 1,
                          }}
                          title={
                            isRequired
                              ? "Required by Indonesian consumer protection law"
                              : undefined
                          }
                        >
                          <input
                            type="checkbox"
                            name="accepts_reasons"
                            value={r}
                            defaultChecked={isSelected}
                            disabled={isRequired}
                            style={{ accentColor: NEX.cyan }}
                          />
                          {r.replace(/_/g, " ")}
                          {isRequired && (
                            <span style={{ color: NEX.orange }}>*</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </FormRow>

                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}
                >
                  <FormRow label="Return shipping paid by">
                    <select
                      name="shipping_paid_by"
                      defaultValue={rp.shipping_paid_by ?? "buyer_unless_defective"}
                      style={{ ...inputStyle, appearance: "auto" }}
                    >
                      {NEX_RETURN_SHIPPING_PAID_BY.map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </FormRow>
                  <FormRow label="Restocking fee %">
                    <input
                      type="number"
                      name="restocking_fee_percent"
                      defaultValue={rp.restocking_fee_percent ?? 0}
                      min={0}
                      max={25}
                      style={inputStyle}
                    />
                  </FormRow>
                </div>

                <FormRow label="Non-returnable categories (comma-separated · optional)">
                  <input
                    type="text"
                    name="non_returnable"
                    defaultValue={(rp.non_returnable ?? []).join(", ")}
                    maxLength={400}
                    placeholder="e.g. perishable, custom made, digital, opened cosmetics"
                    style={inputStyle}
                  />
                </FormRow>

                <FormRow label="Extra notes (shown to buyers · optional)">
                  <textarea
                    name="notes"
                    rows={3}
                    maxLength={2000}
                    defaultValue={rp.notes ?? ""}
                    placeholder="Any custom terms you want buyers to see · language they'll understand · e.g. 'Return item in original box with all accessories'"
                    style={{
                      ...inputStyle,
                      resize: "vertical",
                      fontFamily: "inherit",
                      lineHeight: 1.5,
                    }}
                  />
                </FormRow>

                <SubmitButton label="Save return policy" tone="primary" />
              </form>
            );
          })()}
        </SectionCard>

        {/* --- Product stock status -------------------------------- */}
        <SectionCard>
          <SectionEyebrow color={NEX.orange}>Stock</SectionEyebrow>
          <h2
            style={{
              margin: "6px 0 6px",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.005em",
            }}
          >
            Product stock status
          </h2>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 13,
              lineHeight: 1.55,
              color: NEX.textDim,
            }}
          >
            Tell buyers what&apos;s available right now. Every option
            still keeps the listing visible · sold-out just carries a
            red pill on the card.
          </p>

          {products.length === 0 ? (
            <div
              style={{
                padding: 20,
                textAlign: "center",
                color: NEX.textDim,
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              No products yet. Add one on{" "}
              <Link
                href="/nex-native/manage/site"
                style={{ color: NEX.cyan, textDecoration: "none" }}
              >
                Manage → Site
              </Link>
              .
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {products.map((p) => (
                <ProductStockRow
                  key={p.id}
                  product={p}
                  currentStatus={p.stock_status ?? "in_stock"}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </main>
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Sub-components                                                         *
 * --------------------------------------------------------------------- */

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        padding: "20px 22px",
        borderRadius: 18,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
        boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
        marginBottom: 18,
      }}
    >
      {children}
    </section>
  );
}

function SectionEyebrow({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        color,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function FormRow({
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
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: NEX.textMute,
          fontWeight: 600,
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
  border: `1px solid ${NEX.borderStrong}`,
  color: NEX.text,
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};

function SubmitButton({
  label,
  tone,
}: {
  label: string;
  tone: "primary" | "ghost";
}) {
  const primary = tone === "primary";
  return (
    <button
      type="submit"
      style={{
        padding: "12px 16px",
        borderRadius: 12,
        background: primary
          ? "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)"
          : "rgba(0,0,0,0.35)",
        border: primary
          ? `1px solid ${NEX.orangeSoft}`
          : `1px solid ${NEX.borderStrong}`,
        color: primary ? "#0B0F1A" : NEX.text,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        cursor: "pointer",
        fontFamily: "inherit",
        boxShadow: primary
          ? "0 8px 22px rgba(255,114,0,0.35), inset 0 1px 0 rgba(255,255,255,0.28)"
          : "none",
      }}
    >
      {label}
    </button>
  );
}

function Banner({ code, message }: { code: string; message: string }) {
  const isError = code.endsWith("_failed") || code.endsWith("_error");
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
          isError ? "rgba(255,51,85,0.4)" : "rgba(22,214,107,0.4)"
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

function ProductStockRow({
  product,
  currentStatus,
}: {
  product: import("@/lib/nex-native/types").NexProductRow;
  currentStatus: string;
}) {
  const stockAction = updateProductStockStatusAction.bind(null, product.id);
  const turnaroundAction = updateProductTurnaroundAction.bind(
    null,
    product.id,
  );
  const statuses = ["in_stock", "low_stock", "made_to_order", "sold_out"];
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: "rgba(0,0,0,0.32)",
        border: `1px solid ${NEX.border}`,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Row 1 · thumb + name + stock pills */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {product.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt=""
            style={{
              flexShrink: 0,
              width: 48,
              height: 48,
              borderRadius: 8,
              objectFit: "cover",
              border: `1px solid ${NEX.border}`,
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {product.name}
          </div>
          <form action={stockAction}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
              }}
            >
              {statuses.map((s) => (
                <button
                  key={s}
                  type="submit"
                  name="stock_status"
                  value={s}
                  aria-current={currentStatus === s ? "true" : undefined}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 999,
                    border:
                      currentStatus === s
                        ? `1px solid ${statusColor(s)}`
                        : `1px solid ${NEX.borderStrong}`,
                    background:
                      currentStatus === s
                        ? statusBg(s)
                        : "rgba(0,0,0,0.28)",
                    color:
                      currentStatus === s ? statusColor(s) : NEX.textDim,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {STOCK_LABEL[s]}
                </button>
              ))}
            </div>
          </form>
        </div>
      </div>

      {/* Row 2 · dispatch time + sample request time + save button */}
      <form
        action={turnaroundAction}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          paddingTop: 12,
          borderTop: `1px solid ${NEX.border}`,
        }}
      >
        <FormRow label="Dispatch time">
          <input
            type="text"
            name="dispatch_time"
            defaultValue={product.dispatch_time ?? ""}
            placeholder="24-48 hours after payment"
            maxLength={140}
            style={inputStyle}
          />
        </FormRow>
        <FormRow label="Sample request time">
          <input
            type="text"
            name="sample_request_time"
            defaultValue={product.sample_request_time ?? ""}
            placeholder="5-7 days"
            maxLength={140}
            style={inputStyle}
          />
        </FormRow>
        <div style={{ gridColumn: "1 / -1" }}>
          <button
            type="submit"
            style={{
              padding: "9px 14px",
              borderRadius: 10,
              background: "rgba(0,175,255,0.14)",
              border: `1px solid ${NEX.cyanSoft}`,
              color: NEX.text,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Save turnaround
          </button>
        </div>
      </form>
    </div>
  );
}

/** Turn 'staircase-company' into 'Staircase Company', etc. Simple
 *  hyphen → space + Title Case. Categories are stable so no fancy
 *  lookup table needed. */
function formatCategoryLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function statusColor(s: string): string {
  if (s === "sold_out") return "#FF7A85";
  if (s === "low_stock") return NEX.amber;
  if (s === "made_to_order") return NEX.cyan;
  return NEX.green;
}
function statusBg(s: string): string {
  if (s === "sold_out") return "rgba(255,51,85,0.14)";
  if (s === "low_stock") return "rgba(245,158,11,0.14)";
  if (s === "made_to_order") return "rgba(0,175,255,0.14)";
  return "rgba(22,214,107,0.14)";
}
