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
} from "../../_actions";
import { NEX_BUSINESS_CATEGORIES } from "@/lib/nex-native/site-templates";

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
