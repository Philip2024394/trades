// src/app/nex-native/[businessSlug]/menu/page.tsx
//
// Public menu page · Bridge 15a. Editorial menu for a restaurant or
// cafe, matching the NEX identity (dark navy · serif display · cyan
// eyebrows · orange CTAs). Sections with rich dish cards · dietary
// chips, allergens, spice-level chili glyphs, featured badge,
// availability grey-out, prep time, portion note, "Chat to order"
// per item.
//
// Reachable from the shop landing when the business_category is
// 'restaurant' or 'cafe'. notFound() when the slug misses OR the
// business isn't in a menu-supporting category.

import type * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import * as businessService from "@/lib/nex-native/business-service";
import * as menuService from "@/lib/nex-native/menu-service";
import { sendMenuItemInquiryAction } from "../../_actions";
import { AddToCartButton } from "../../_add-to-cart-button";
import { FloatingCartPill } from "../../_floating-cart-pill";

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
  chili: "#FF5A3C",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const MENU_CATEGORIES = new Set(["restaurant", "cafe"]);

export default async function Page({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const business = await businessService.getBusinessBySlug(businessSlug);
  if (!business) notFound();
  if (!MENU_CATEGORIES.has(business.business_category ?? "")) {
    // Not a menu-supporting vertical · bounce back to the shop.
    notFound();
  }

  const bundle = await menuService.getMenuBundleForBusiness(business.id, {
    onlyLive: true,
  });

  const chatHref = `/nex-native/chat/peer/${business.owner_account_id}`;
  const shopHref = `/nex-native/${business.slug}`;
  const dishInquiryAction = sendMenuItemInquiryAction.bind(
    null,
    business.owner_account_id,
  );

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
      }}
    >
      {/* --- Top nav strip · back + brand + shop link --- */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          padding:
            "calc(env(safe-area-inset-top, 0) + 12px) 16px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background:
            "linear-gradient(180deg, rgba(2,9,20,0.92) 0%, rgba(2,9,20,0.6) 100%)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <Link
          href={shopHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: NEX.textDim,
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
            padding: "6px 4px",
          }}
        >
          <BackIcon />
          <span>Back to {business.display_name}</span>
        </Link>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
          }}
        >
          {business.slug}.nex
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "16px 20px 40px" }}>
        {/* --- HERO ---------------------------------------------------- */}
        <section style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            The Menu
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: "clamp(38px, 7vw, 60px)",
              lineHeight: 1.02,
              letterSpacing: "-0.014em",
              marginBottom: 10,
            }}
          >
            {business.display_name}
          </h1>
          {business.description && (
            <p
              style={{
                margin: 0,
                fontSize: 15,
                lineHeight: 1.6,
                color: "rgba(244,247,252,0.82)",
                maxWidth: 560,
              }}
            >
              {business.description}
            </p>
          )}
          <div
            style={{
              marginTop: 16,
              fontSize: 11,
              color: NEX.textMute,
              letterSpacing: "0.02em",
            }}
          >
            {bundle.totalItems} live items · prices in{" "}
            {bundle.sections[0]?.items[0]?.currency ?? "IDR"}
          </div>
        </section>

        {/* --- SECTION NAV · sticky chip row --- */}
        {bundle.sections.length > 1 && (
          <nav
            aria-label="Menu sections"
            style={{
              position: "sticky",
              top: "calc(env(safe-area-inset-top, 0) + 46px)",
              zIndex: 5,
              margin: "0 -20px 24px",
              padding: "12px 20px",
              background:
                "linear-gradient(180deg, rgba(2,9,20,0.94) 0%, rgba(2,9,20,0.86) 100%)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              borderBottom: `1px solid ${NEX.border}`,
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {bundle.sections.map((s, i) => {
              const label = s.section?.name ?? "Menu";
              const anchor = `s-${s.section?.id ?? "u"}-${i}`;
              return (
                <a
                  key={anchor}
                  href={`#${anchor}`}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: "rgba(0,175,255,0.10)",
                    border: `1px solid ${NEX.borderStrong}`,
                    color: NEX.text,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textDecoration: "none",
                  }}
                >
                  {label}
                </a>
              );
            })}
          </nav>
        )}

        {/* --- MENU BODY --- */}
        {bundle.sections.length === 0 ? (
          <div
            style={{
              padding: "48px 20px",
              textAlign: "center",
              color: NEX.textDim,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            No live menu items yet.
            <br />
            <Link
              href={chatHref}
              style={{ color: NEX.cyan, textDecoration: "none" }}
            >
              Message {firstName(business.display_name)} →
            </Link>
          </div>
        ) : (
          bundle.sections.map((s, i) => {
            const anchor = `s-${s.section?.id ?? "u"}-${i}`;
            return (
              <section
                key={anchor}
                id={anchor}
                style={{
                  marginBottom: 40,
                  scrollMarginTop: 120,
                }}
              >
                <SectionHead
                  eyebrow={`Section ${i + 1}`}
                  title={s.section?.name ?? "Menu"}
                  description={s.section?.description ?? null}
                />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: 16,
                  }}
                >
                  {s.items.map((it) => (
                    <MenuDishCard
                      key={it.id}
                      item={it}
                      chatHref={chatHref}
                      dishInquiryAction={dishInquiryAction}
                      cartAdd={
                        <AddToCartButton
                          compact
                          label="+ Add to cart"
                          item={{
                            kind: "menu_item",
                            id: it.id,
                            shop_id: business.id,
                            shop_slug: business.slug ?? "",
                            shop_owner_account_id: business.owner_account_id,
                            shop_display_name: business.display_name,
                            name: it.name,
                            price_pence: it.price_pence,
                            currency: it.currency,
                            image_url: it.image_url,
                            variants: [],
                          }}
                        />
                      }
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}

        {/* --- STICKY BOTTOM · chat CTA --- */}
        <div
          style={{
            position: "sticky",
            bottom: 12,
            padding: "12px 0",
            display: "flex",
            justifyContent: "center",
            marginTop: 40,
          }}
        >
          <Link
            href={chatHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 22px",
              borderRadius: 999,
              background:
                "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
              color: "#0B0F1A",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              textDecoration: "none",
              boxShadow:
                "0 14px 30px rgba(255,114,0,0.5), inset 0 1px 0 rgba(255,255,255,0.28)",
            }}
          >
            💬 Chat to order
            <span aria-hidden>→</span>
          </Link>
        </div>
      </main>
      <FloatingCartPill />
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Sub-components                                                         *
 * --------------------------------------------------------------------- */

function SectionHead({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string | null;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: NEX.cyan,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {eyebrow}
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: SERIF,
          fontWeight: 500,
          fontSize: 32,
          letterSpacing: "-0.012em",
          lineHeight: 1.05,
          marginBottom: description ? 6 : 0,
        }}
      >
        {title}
      </h2>
      {description && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.55,
            color: "rgba(244,247,252,0.72)",
            maxWidth: 520,
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
}

function MenuDishCard({
  item,
  chatHref,
  dishInquiryAction,
  cartAdd,
}: {
  item: import("@/lib/nex-native/menu-service").NexMenuItemRow;
  chatHref: string;
  dishInquiryAction: (formData: FormData) => Promise<never>;
  cartAdd?: React.ReactNode;
}) {
  const unavailable = !item.is_available;
  return (
    <article
      style={{
        borderRadius: 18,
        overflow: "hidden",
        background: NEX.panelSoft,
        border: item.is_featured
          ? `1px solid ${NEX.orangeSoft}`
          : `1px solid ${NEX.border}`,
        boxShadow: item.is_featured
          ? "0 12px 32px rgba(0,0,0,0.4), 0 0 24px rgba(255,114,0,0.14)"
          : "0 12px 32px rgba(0,0,0,0.4)",
        opacity: unavailable ? 0.65 : 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Hero image · 4:3 · bottom-rounded to feel like a self-
          contained photo. Feature badge top-left · sold-out
          overlay when unavailable. */}
      {item.image_url && (
        <div
          style={{
            position: "relative",
            aspectRatio: "4 / 3",
            background: "#050f1e",
            overflow: "hidden",
            borderRadius: "0 0 14px 14px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image_url}
            alt={item.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
          {item.is_featured && (
            <div
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                padding: "4px 10px",
                borderRadius: 999,
                background: NEX.orange,
                color: "#0B0F1A",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                boxShadow: "0 4px 12px rgba(255,114,0,0.4)",
              }}
            >
              ★ House special
            </div>
          )}
          {unavailable && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                background: "rgba(2,9,20,0.55)",
                backdropFilter: "blur(2px)",
              }}
            >
              <span
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  background: "rgba(2,9,20,0.85)",
                  border: `1px solid ${NEX.borderStrong}`,
                  color: NEX.text,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                }}
              >
                Sold out today
              </span>
            </div>
          )}
        </div>
      )}

      {/* Meta */}
      <div style={{ padding: "18px 20px 20px" }}>
        {/* Name + price */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 14,
            marginBottom: 8,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: 22,
              letterSpacing: "-0.008em",
              lineHeight: 1.15,
            }}
          >
            {item.name}
          </h3>
          <div
            style={{
              flexShrink: 0,
              fontSize: 16,
              fontWeight: 800,
              color: NEX.orange,
              letterSpacing: "0.01em",
              fontFamily: SANS,
            }}
          >
            {formatPrice(item.price_pence, item.currency)}
          </div>
        </div>

        {/* Chip row · spice + dietary tags */}
        {(item.spice_level > 0 ||
          item.dietary_tags.length > 0 ||
          item.portion_note ||
          item.preparation_time) && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 5,
              marginBottom: 12,
            }}
          >
            {item.spice_level > 0 && (
              <SpicePill level={item.spice_level} />
            )}
            {item.dietary_tags.map((t) => (
              <DietaryPill key={t} tag={t} />
            ))}
            {item.portion_note && <MetaPill icon="🍽️" text={item.portion_note} />}
            {item.preparation_time && (
              <MetaPill icon="⏱" text={item.preparation_time} />
            )}
          </div>
        )}

        {/* Description */}
        {item.description && (
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.6,
              color: "rgba(244,247,252,0.85)",
              marginBottom: 14,
            }}
          >
            {item.description}
          </p>
        )}

        {/* Allergens · muted line at the bottom */}
        {item.allergens.length > 0 && (
          <div
            style={{
              fontSize: 11,
              color: NEX.textMute,
              marginBottom: 14,
              letterSpacing: "0.02em",
            }}
          >
            <span
              style={{
                fontSize: 9,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: NEX.textMute,
                fontWeight: 700,
                marginRight: 6,
              }}
            >
              Contains
            </span>
            {item.allergens.join(" · ")}
          </div>
        )}

        {/* CTA · always Chat to order · doctrine · commerce lives
            in chat. Bridge 15c · fires sendMenuItemInquiryAction so
            the dish arrives in the peer chat as an inline card
            (mirrors Bridge 11 product inquiries). */}
        {!unavailable && cartAdd && (
          <div style={{ marginBottom: 8 }}>{cartAdd}</div>
        )}
        {unavailable ? (
          <div
            aria-disabled
            style={{
              display: "block",
              padding: "11px 14px",
              borderRadius: 12,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: NEX.textMute,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            Currently unavailable
          </div>
        ) : (
          <form action={dishInquiryAction}>
            <input type="hidden" name="menu_item_id" value={item.id} />
            <input type="hidden" name="intent" value="ask" />
            <button
              type="submit"
              style={{
                display: "block",
                width: "100%",
                padding: "11px 14px",
                borderRadius: 12,
                background: "rgba(0,175,255,0.16)",
                border: `1px solid ${NEX.cyanSoft}`,
                color: NEX.text,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                textAlign: "center",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Chat about {firstWord(item.name)} →
            </button>
          </form>
        )}
      </div>
    </article>
  );
}

function SpicePill({ level }: { level: number }) {
  const chilies = "🌶".repeat(Math.max(1, Math.min(3, level)));
  const label = level === 1 ? "Mild" : level === 2 ? "Medium" : "Hot";
  return (
    <span
      style={{
        padding: "3px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,90,60,0.4)",
        background: "rgba(255,90,60,0.10)",
        color: NEX.chili,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <span aria-hidden>{chilies}</span>
      {label}
    </span>
  );
}

function DietaryPill({ tag }: { tag: string }) {
  const label = tag
    .split("-")
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
  const isVegan = tag === "vegan";
  const isGF = tag === "gluten-free";
  const colour = isVegan
    ? { bg: "rgba(22,214,107,0.14)", border: "rgba(22,214,107,0.5)", text: "#B8F1CC" }
    : isGF
      ? { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.45)", text: "#FCD9A8" }
      : { bg: "rgba(0,175,255,0.10)", border: NEX.cyanSoft, text: "#B4E4FF" };
  return (
    <span
      style={{
        padding: "3px 8px",
        borderRadius: 999,
        border: `1px solid ${colour.border}`,
        background: colour.bg,
        color: colour.text,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

function MetaPill({ icon, text }: { icon: string; text: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        borderRadius: 999,
        border: `1px solid ${NEX.borderStrong}`,
        background: "rgba(0,0,0,0.35)",
        color: NEX.textDim,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.04em",
      }}
    >
      <span aria-hidden style={{ fontSize: 10 }}>
        {icon}
      </span>
      {text}
    </span>
  );
}

function BackIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function firstName(name: string): string {
  const trimmed = name.replace(/^(Priya's? · |Aisha · )/, "");
  return trimmed.split(/[·\s]+/)[0] ?? name;
}

function firstWord(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

function formatPrice(pence: number, currency: string): string {
  const majors = Math.round(pence / 100);
  const withCommas = majors.toLocaleString();
  if (currency === "IDR") return `Rp ${withCommas}`;
  if (currency === "INR") return `₹${withCommas}`;
  if (currency === "GBP") return `£${(pence / 100).toFixed(2)}`;
  if (currency === "USD") return `$${(pence / 100).toFixed(2)}`;
  return `${currency} ${withCommas}`;
}
