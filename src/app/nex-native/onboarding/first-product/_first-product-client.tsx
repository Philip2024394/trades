"use client";

// src/app/nex-native/onboarding/first-product/_first-product-client.tsx
//
// Seller Central · first product form · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// Shown immediately after the Seller Central wizard launches the shop.
// Opens with a celebratory header confirming the shop is live, then
// walks the seller through adding their first product listing:
//
//   · product image (optional, encourages upload)
//   · product name (required)
//   · price in GBP (required)
//   · short description (optional)
//
// Submit → createFirstProductAction → opens the shop's public page.
// "Skip for now" → opens the shop with no product (empty state).

import * as React from "react";
import Link from "next/link";
import {
  createFirstProductAction,
  uploadFirstProductImageAction,
} from "../../_actions";

const NEX = {
  bg: "#020914",
  border: "rgba(139, 169, 209, 0.14)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#009FEF",
  cyanSoft: "rgba(0,159,239,0.5)",
  cyanBorder: "rgba(0,159,239,0.35)",
  orange: "#FF7200",
  green: "#8FFF6E",
  red: "#FF5A5A",
};
const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

interface Props {
  slug: string;
  displayName: string;
  logoUrl: string | null;
  banner: { code: string; message: string } | null;
}

export function FirstProductClient({
  slug,
  displayName,
  logoUrl,
  banner,
}: Props): React.JSX.Element {
  // Sealed 2026-10-01 · each product supports up to 4 images.
  // Slot 0 is the primary image (persisted to nex_product.image_url);
  // slots 1-3 go into gallery_urls. Each slot has independent upload /
  // preview / remove with its own file-input ref.
  const SLOTS = 4;
  const [imageUrls, setImageUrls] = React.useState<(string | null)[]>(
    Array.from({ length: SLOTS }, () => null),
  );
  const [uploadingSlot, setUploadingSlot] = React.useState<number | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);
  const openSlotPicker = (i: number) => inputRefs.current[i]?.click();
  const setSlotUrl = (i: number, url: string | null) => {
    setImageUrls((prev) => {
      const next = [...prev];
      next[i] = url;
      return next;
    });
  };
  // Primary image goes to image_url; the rest (non-null) go to
  // gallery_urls as a JSON-serialized array for the hidden field.
  const primaryImage = imageUrls[0] ?? "";
  const galleryImages = imageUrls.slice(1).filter((u): u is string => !!u);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        paddingBottom: 60,
      }}
    >
      {/* Top chrome · matches Seller Central wizard · NEX wordmark
          left + Home right · same sticky treatment. */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          padding:
            "calc(env(safe-area-inset-top, 0) + 12px) 18px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(2,9,20,0.78)",
          backdropFilter: "blur(14px) saturate(1.2)",
          WebkitBackdropFilter: "blur(14px) saturate(1.2)",
          borderBottom: `1px solid ${NEX.border}`,
        }}
      >
        <Link
          href="/nex-native/home"
          aria-label="NEX Seller Central"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 2,
            textDecoration: "none",
            fontFamily: SANS,
            lineHeight: 1,
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            <span style={{ color: "#F2F5F8" }}>NE</span>
            <span style={{ color: NEX.orange }}>X</span>
          </span>
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              color: NEX.textMute,
              fontWeight: 600,
            }}
          >
            Seller Central
          </span>
        </Link>
        <Link
          href="/nex-native/home"
          aria-label="Home"
          title="Home"
          style={{
            width: 36,
            height: 36,
            display: "grid",
            placeItems: "center",
            borderRadius: "50%",
            background: "transparent",
            color: "rgba(255,255,255,0.55)",
            textDecoration: "none",
            transition: "color 160ms ease",
          }}
        >
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 11l9-8 9 8" />
            <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
          </svg>
        </Link>
      </header>

      <main
        style={{
          maxWidth: 560,
          margin: "0 auto",
          padding:
            "48px 20px calc(env(safe-area-inset-bottom, 0) + 40px)",
        }}
      >
        {/* Celebration moment */}
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: NEX.green,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          🎉 Your shop is live
        </div>
        <h1
          style={{
            margin: "0 0 10px",
            fontFamily: SERIF,
            fontSize: 32,
            lineHeight: 1.1,
            letterSpacing: "-0.012em",
            fontWeight: 500,
          }}
        >
          Customers are waiting.
        </h1>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 14,
            lineHeight: 1.6,
            color: NEX.textDim,
          }}
        >
          Let's get your first listing uploaded so buyers landing on{" "}
          <b
            style={{
              color: NEX.cyan,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            }}
          >
            {slug}.nex
          </b>{" "}
          have something to buy.
        </p>

        {/* Shop identity confirmation chip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            borderRadius: 14,
            background: "rgba(0,159,239,0.08)",
            border: `1px solid ${NEX.cyanSoft}`,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: logoUrl
                ? `url(${logoUrl}) center/cover no-repeat`
                : "rgba(0,0,0,0.4)",
              border: `2px solid ${NEX.green}`,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: NEX.text,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                fontSize: 11,
                color: NEX.textDim,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
              }}
            >
              {slug}.nex
            </div>
          </div>
        </div>

        {banner && (
          <div
            style={{
              marginBottom: 18,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(255,90,90,0.08)",
              border: "1px solid rgba(255,90,90,0.4)",
              fontSize: 12,
              lineHeight: 1.5,
              color: NEX.text,
            }}
          >
            <b style={{ color: NEX.red }}>{banner.code}:</b> {banner.message}
          </div>
        )}

        <form
          action={createFirstProductAction}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="product_image_url" value={primaryImage} />
          <input
            type="hidden"
            name="product_gallery_urls"
            value={JSON.stringify(galleryImages)}
          />

          {/* 1 · Product name (goes first so the seller names it
              before uploading images, keeps focus on identity). */}
          <div>
            <FieldLabel label="Product name" />
            <input
              type="text"
              name="product_name"
              required
              maxLength={200}
              placeholder="e.g. Hand-poured soy candle"
              style={inputStyle}
            />
          </div>

          {/* 2 · Images · 4-slot grid · slot 0 = primary (image_url),
              slots 1-3 = gallery_urls. Each slot has independent
              upload / preview / remove. First empty slot shows the
              cyan ping icon; others sit quiet until the first fills. */}
          <div>
            <FieldLabel label="Product images · up to 4" />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              {Array.from({ length: SLOTS }).map((_, i) => {
                const url = imageUrls[i];
                const isUploading = uploadingSlot === i;
                const isPrimary = i === 0;
                return (
                  <div key={i}>
                    <input
                      ref={(el) => {
                        inputRefs.current[i] = el;
                      }}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/avif"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setUploadError(null);
                          setUploadingSlot(i);
                          try {
                            const fd = new FormData();
                            fd.append("image", f);
                            const res = await uploadFirstProductImageAction(fd);
                            if (res.ok) {
                              setSlotUrl(i, res.url);
                            } else {
                              setUploadError(res.error);
                            }
                          } catch (err) {
                            setUploadError(
                              err instanceof Error
                                ? err.message
                                : "upload_failed",
                            );
                          } finally {
                            setUploadingSlot(null);
                          }
                        }
                        const ref = inputRefs.current[i];
                        if (ref) ref.value = "";
                      }}
                      style={{ display: "none" }}
                    />
                    <div
                      onClick={
                        !isUploading && !url ? () => openSlotPicker(i) : undefined
                      }
                      style={{
                        position: "relative",
                        width: "100%",
                        aspectRatio: "1 / 1",
                        borderRadius: 14,
                        background: url
                          ? `url(${url}) center/cover no-repeat`
                          : "rgba(0,0,0,0.4)",
                        border: `1px dashed ${
                          url ? NEX.green : NEX.cyanSoft
                        }`,
                        cursor:
                          isUploading || url ? "default" : "pointer",
                        display: "grid",
                        placeItems: "center",
                        overflow: "hidden",
                      }}
                    >
                      {isPrimary && (
                        <span
                          aria-hidden
                          style={{
                            position: "absolute",
                            top: 6,
                            left: 6,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "rgba(2,9,20,0.72)",
                            color: NEX.cyan,
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                          }}
                        >
                          Main
                        </span>
                      )}
                      {!url && !isUploading && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 4,
                            color: NEX.cyan,
                          }}
                        >
                          <svg
                            width={24}
                            height={24}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.6}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          <span
                            style={{
                              fontSize: 10,
                              letterSpacing: "0.14em",
                              textTransform: "uppercase",
                              color: NEX.textDim,
                              fontWeight: 700,
                            }}
                          >
                            {isPrimary ? "Add main" : "Add photo"}
                          </span>
                        </div>
                      )}
                      {isUploading && (
                        <div
                          style={{
                            fontSize: 10,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: NEX.cyan,
                            fontWeight: 700,
                          }}
                        >
                          Uploading…
                        </div>
                      )}
                      {url && !isUploading && (
                        <button
                          type="button"
                          aria-label={`Remove image ${i + 1}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSlotUrl(i, null);
                          }}
                          style={{
                            position: "absolute",
                            top: 6,
                            right: 6,
                            width: 22,
                            height: 22,
                            padding: 0,
                            borderRadius: "50%",
                            background:
                              "linear-gradient(180deg, #B91C1C 0%, #7F1414 100%)",
                            border: "1px solid rgba(255,90,90,0.5)",
                            color: "#FFEDED",
                            cursor: "pointer",
                            display: "grid",
                            placeItems: "center",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                          }}
                        >
                          <svg
                            width={10}
                            height={10}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={3}
                            strokeLinecap="round"
                            aria-hidden
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {uploadError && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: NEX.red,
                }}
              >
                Upload failed · {uploadError}
              </div>
            )}
          </div>

          {/* 3 · Price */}
          <div>
            <FieldLabel label="Price (GBP)" />
            <input
              type="number"
              name="product_price_gbp"
              required
              min={0.01}
              step={0.01}
              placeholder="e.g. 24.50"
              style={inputStyle}
            />
          </div>

          {/* 4 · Short description */}
          <div>
            <FieldLabel label="Short description (optional)" />
            <textarea
              name="product_description"
              rows={3}
              maxLength={400}
              placeholder="One line that makes a buyer want this."
              style={{ ...inputStyle, minHeight: 72, padding: "10px 14px" }}
            />
          </div>

          <button
            type="submit"
            style={{
              padding: "14px 24px",
              borderRadius: 999,
              background: `linear-gradient(180deg, ${NEX.cyan} 0%, #0073b8 100%)`,
              border: "none",
              color: "#FFF",
              fontSize: 13,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 10px 24px rgba(0,159,239,0.3)",
              fontFamily: "inherit",
              marginTop: 8,
            }}
          >
            Add product & open shop →
          </button>
          <Link
            href={`/nex-native/${slug}`}
            style={{
              textAlign: "center",
              fontSize: 12,
              color: NEX.textDim,
              textDecoration: "none",
              padding: "6px 12px",
            }}
          >
            Skip for now · add later from /manage/products
          </Link>
        </form>
      </main>
    </div>
  );
}

function FieldLabel({ label }: { label: string }): React.JSX.Element {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: NEX.textDim,
        fontWeight: 700,
        marginBottom: 8,
      }}
    >
      {label}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  padding: "0 14px",
  borderRadius: 12,
  background: "rgba(4,20,36,0.85)",
  border: `1px solid rgba(0,159,239,0.4)`,
  color: NEX.text,
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
