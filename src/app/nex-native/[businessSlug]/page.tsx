// src/app/nex-native/[businessSlug]/page.tsx
//
// NEX Shop · public visitor landing for a seller's business.
// ----------------------------------------------------------
// This is what a visitor sees when they follow a philip.nex or
// aisha-vintage-cameras.nex link from an Instagram bio / QR code /
// share URL. Founder direction 2026-09-27: "highest quality possible
// shop page for sellers".
//
// Aesthetic:
//   · Dark navy #020914 canvas · matches the NEX Chat identity
//   · Serif display for the business name + product headlines ·
//     editorial, magazine-quality read
//   · Rich full-bleed hero with the seller's photo · cinematic
//   · 1-column product feed with big photos (up to 640px wide) ·
//     each item reads as its own editorial spread, not a table row
//   · Chat CTA anchored to the bottom as the primary conversion ·
//     the whole page funnels toward "start the conversation"
//
// Zero legacy chrome: no SKU column, no idempotency inputs, no
// inline order forms · commerce happens inside chat per doctrine.

import Link from "next/link";
import { notFound } from "next/navigation";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";

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
  cyanSoft: "rgba(0,175,255,0.6)",
  orange: "#FF7800",
  orangeSoft: "rgba(255,120,0,0.65)",
  green: "#16D66B",
  amber: "#F59E0B",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function Page({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const business = await businessService.getBusinessBySlug(businessSlug);
  if (!business) notFound();

  const products = await productService.listProductsByBusiness(
    business.id,
    "live",
  );

  const chatHref = `/nex-native/chat/peer/${business.owner_account_id}`;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
      }}
    >
      {/* --- HERO ---------------------------------------------------- */}
      <section
        style={{
          position: "relative",
          width: "100%",
          minHeight: "min(78vh, 720px)",
          overflow: "hidden",
        }}
      >
        {/* Cover photograph · falls back to a moody gradient when the
            seller hasn't uploaded a logo/cover yet. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: business.logo_url
              ? `url(${business.logo_url})`
              : `linear-gradient(135deg, #063B67 0%, #05101f 60%, #020914 100%)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "saturate(1.05)",
          }}
        />
        {/* Editorial scrim · dark at bottom so text stays legible */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(2,9,20,0.15) 0%, rgba(2,9,20,0.55) 45%, rgba(2,9,20,0.95) 100%)",
          }}
        />

        {/* Content column · centered · caps at 720 so lines don't
            sprawl on desktop */}
        <div
          style={{
            position: "relative",
            maxWidth: 720,
            margin: "0 auto",
            padding:
              "calc(env(safe-area-inset-top, 0) + 32px) 24px 40px",
            minHeight: "inherit",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            {business.slug}.nex
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: "clamp(38px, 8vw, 68px)",
              lineHeight: 1.02,
              letterSpacing: "-0.015em",
              marginBottom: 12,
              textShadow: "0 2px 24px rgba(0,0,0,0.6)",
            }}
          >
            {business.display_name}
          </h1>
          {business.description && (
            <p
              style={{
                margin: 0,
                fontSize: 15,
                lineHeight: 1.55,
                color: "rgba(244,247,252,0.85)",
                maxWidth: 520,
                textShadow: "0 1px 12px rgba(0,0,0,0.5)",
              }}
            >
              {business.description}
            </p>
          )}
          {/* Signal chips */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 18,
            }}
          >
            {business.address && (
              <SignalChip label={business.address.split("·")[0]!.trim()} icon="📍" />
            )}
            {products.length > 0 && (
              <SignalChip
                label={`${products.length} pieces available`}
                icon="✦"
              />
            )}
            {business.accepts_pickup && (
              <SignalChip label="Local pickup" icon="🤝" />
            )}
          </div>
        </div>
      </section>

      {/* --- PRIMARY CHAT CTA ---------------------------------------- */}
      <section
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "24px 20px 8px",
        }}
      >
        <Link
          href={chatHref}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            padding: "16px 20px",
            borderRadius: 14,
            background:
              "linear-gradient(180deg, #FF9033 0%, #FF7800 100%)",
            color: "#0B0F1A",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.02em",
            textDecoration: "none",
            boxShadow:
              "0 12px 28px rgba(255,120,0,0.4), inset 0 1px 0 rgba(255,255,255,0.28)",
          }}
        >
          <span aria-hidden style={{ fontSize: 18 }}>
            💬
          </span>
          Chat with {firstName(business.display_name)}
          <span aria-hidden>→</span>
        </Link>
        <div
          style={{
            textAlign: "center",
            fontSize: 11,
            color: NEX.textMute,
            marginTop: 10,
            letterSpacing: "0.02em",
          }}
        >
          Ask about a piece · negotiate · buy · all in one conversation
        </div>
      </section>

      {/* --- PRODUCTS ------------------------------------------------ */}
      {products.length > 0 && (
        <section
          id="products"
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "40px 20px 20px",
          }}
        >
          <SectionHeading
            eyebrow="The Collection"
            title="Currently available"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {products.map((p) => (
              <ProductSpread
                key={p.id}
                name={p.name}
                description={p.description ?? null}
                price={formatPrice(p.price_pence, p.currency)}
                imageUrl={p.image_url ?? null}
                tags={p.tags ?? []}
                stockStatus={p.stock_status}
                chatHref={chatHref}
              />
            ))}
          </div>
        </section>
      )}

      {products.length === 0 && (
        <section
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "60px 20px",
            textAlign: "center",
            color: NEX.textDim,
            fontSize: 14,
          }}
        >
          Aisha hasn&apos;t listed anything yet. The conversation is
          still open · say hi above.
        </section>
      )}

      {/* --- CONTACT + SOCIALS --------------------------------------- */}
      {(business.address ||
        business.public_phone ||
        business.public_email ||
        business.instagram_handle ||
        business.facebook_handle ||
        business.tiktok_handle) && (
        <section
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "40px 20px 24px",
          }}
        >
          <SectionHeading eyebrow="Reach out" title="Find the seller" />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: 20,
              background: NEX.panelSoft,
              border: `1px solid ${NEX.border}`,
              borderRadius: 16,
            }}
          >
            {business.address && (
              <ContactRow label="Location" value={business.address} />
            )}
            {business.public_phone && (
              <ContactRow
                label="Phone"
                value={business.public_phone}
                href={`tel:${business.public_phone}`}
              />
            )}
            {business.public_email && (
              <ContactRow
                label="Email"
                value={business.public_email}
                href={`mailto:${business.public_email}`}
              />
            )}
            {(business.instagram_handle ||
              business.facebook_handle ||
              business.tiktok_handle ||
              business.linkedin_handle ||
              business.x_handle) && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                {business.instagram_handle && (
                  <SocialPill
                    href={`https://instagram.com/${business.instagram_handle}`}
                    label={`@${business.instagram_handle}`}
                  />
                )}
                {business.facebook_handle && (
                  <SocialPill
                    href={`https://facebook.com/${business.facebook_handle}`}
                    label={`/${business.facebook_handle}`}
                  />
                )}
                {business.tiktok_handle && (
                  <SocialPill
                    href={`https://tiktok.com/@${business.tiktok_handle}`}
                    label={`TikTok · @${business.tiktok_handle}`}
                  />
                )}
                {business.linkedin_handle && (
                  <SocialPill
                    href={`https://linkedin.com/${business.linkedin_handle}`}
                    label={`LinkedIn · /${business.linkedin_handle}`}
                  />
                )}
                {business.x_handle && (
                  <SocialPill
                    href={`https://x.com/${business.x_handle}`}
                    label={`X · @${business.x_handle}`}
                  />
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* --- FOOTER -------------------------------------------------- */}
      <footer
        style={{
          padding: "32px 20px calc(env(safe-area-inset-bottom, 0) + 32px)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: NEX.textMute,
            fontWeight: 700,
          }}
        >
          Powered by NEX
        </div>
        <div
          style={{
            fontSize: 11,
            color: NEX.textMute,
            marginTop: 8,
          }}
        >
          <Link
            href="/nex-native/about"
            style={{ color: NEX.cyan, textDecoration: "none" }}
          >
            What is NEX?
          </Link>
        </div>
      </footer>
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Building blocks                                                       *
 * --------------------------------------------------------------------- */

function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
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
          fontSize: 28,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h2>
    </div>
  );
}

function SignalChip({ label, icon }: { label: string; icon: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.42)",
        border: `1px solid ${NEX.borderStrong}`,
        color: NEX.text,
        fontSize: 11,
        letterSpacing: "0.02em",
        backdropFilter: "blur(6px)",
      }}
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function ContactRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const valueEl = href ? (
    <a
      href={href}
      style={{
        color: NEX.text,
        textDecoration: "none",
        borderBottom: `1px solid ${NEX.borderStrong}`,
      }}
    >
      {value}
    </a>
  ) : (
    <span style={{ color: NEX.text }}>{value}</span>
  );
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "80px 1fr",
        gap: 12,
        alignItems: "start",
        fontSize: 13,
      }}
    >
      <div
        style={{
          color: NEX.textMute,
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          paddingTop: 2,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{valueEl}</div>
    </div>
  );
}

function SocialPill({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${NEX.borderStrong}`,
        background: "rgba(0,175,255,0.08)",
        color: NEX.cyan,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.02em",
        textDecoration: "none",
      }}
    >
      {label}
    </a>
  );
}

function ProductSpread({
  name,
  description,
  price,
  imageUrl,
  tags,
  stockStatus,
  chatHref,
}: {
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  tags: string[];
  stockStatus: string | null;
  chatHref: string;
}) {
  return (
    <article
      style={{
        borderRadius: 20,
        overflow: "hidden",
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
        boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
      }}
    >
      {/* Hero photo · 3:2 aspect · price now sits INSIDE the image
          at the lower-right as a glass pill, so the card leads
          with the visual and the number lands where the eye
          finishes scanning the frame. Stock pill stays top-left. */}
      <div
        style={{
          width: "100%",
          aspectRatio: "3 / 2",
          background: "#050f1e",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt={name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              display: "grid",
              placeItems: "center",
              width: "100%",
              height: "100%",
              color: NEX.textMute,
              fontSize: 56,
            }}
          >
            🛍️
          </div>
        )}
        {stockStatus && stockStatus !== "in_stock" && (
          <div
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(2,9,20,0.75)",
              border: `1px solid ${
                stockStatus === "sold_out"
                  ? "rgba(255,120,120,0.5)"
                  : NEX.borderStrong
              }`,
              color:
                stockStatus === "sold_out"
                  ? "#FF7A85"
                  : stockStatus === "low_stock"
                    ? NEX.amber
                    : NEX.cyan,
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
              backdropFilter: "blur(6px)",
            }}
          >
            {stockStatus === "sold_out"
              ? "Sold out"
              : stockStatus === "low_stock"
                ? "Low stock"
                : stockStatus === "made_to_order"
                  ? "Made to order"
                  : stockStatus.replace(/_/g, " ")}
          </div>
        )}
        {/* Price overlay · lower-right corner of the image */}
        <div
          style={{
            position: "absolute",
            right: 14,
            bottom: 14,
            padding: "8px 14px",
            borderRadius: 12,
            background:
              "linear-gradient(180deg, rgba(2,9,20,0.72) 0%, rgba(2,9,20,0.88) 100%)",
            border: `1px solid ${NEX.orangeSoft}`,
            color: NEX.orange,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.01em",
            fontFamily: SANS,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow: "0 8px 20px rgba(0,0,0,0.55)",
          }}
        >
          {price}
        </div>
      </div>

      {/* Meta · name lives under the image now (its own row), then
          tags, then description, then the CTAs. */}
      <div style={{ padding: "18px 22px 22px" }}>
        <h3
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontWeight: 500,
            fontSize: 26,
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
            marginBottom: 10,
          }}
        >
          {name}
        </h3>
        {tags.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 14,
            }}
          >
            {tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                style={{
                  padding: "3px 10px",
                  borderRadius: 999,
                  border: `1px solid ${NEX.borderStrong}`,
                  background: "rgba(0,175,255,0.08)",
                  color: NEX.cyan,
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {description && (
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.6,
              color: "rgba(244,247,252,0.85)",
              marginBottom: 18,
              whiteSpace: "pre-wrap",
            }}
          >
            {description}
          </p>
        )}
        {/* Two CTAs · Purchase (primary orange) + Chat Now (cyan) */}
        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href={chatHref}
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 12,
              background: NEX.orange,
              color: "#0B0F1A",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              textDecoration: "none",
              textAlign: "center",
              boxShadow: "0 8px 20px rgba(255,120,0,0.35)",
            }}
          >
            Purchase
          </Link>
          <Link
            href={chatHref}
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(0,175,255,0.16)",
              border: `1px solid ${NEX.cyanSoft}`,
              color: NEX.text,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Chat Now
          </Link>
        </div>
      </div>
    </article>
  );
}

function firstName(name: string): string {
  return name.split(/[·\s]+/)[0] ?? name;
}

function formatPrice(pence: number, currency: string): string {
  const majors = Math.round(pence / 100);
  const withCommas = majors.toLocaleString();
  if (currency === "IDR") return `Rp ${withCommas}`;
  if (currency === "GBP") return `£${(pence / 100).toFixed(2)}`;
  if (currency === "USD") return `$${(pence / 100).toFixed(2)}`;
  return `${currency} ${withCommas}`;
}
