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
  uploadSizeChartAction,
} from "../../_actions";
import {
  NEX_CURRENCIES,
  DEFAULT_CURRENCY,
  findCurrency,
} from "@/lib/nex-native/currencies";
import {
  NEX_VARIANT_TEMPLATES,
  getVariantTemplate,
} from "@/lib/nex-native/variant-templates";

interface PaletteColor {
  slug: string;
  label: string;
  hex: string;
}

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
  colorPalette: PaletteColor[];
}

const MAX_COLORS_PER_PRODUCT = 10;

export function FirstProductClient({
  slug,
  displayName,
  logoUrl,
  banner,
  colorPalette,
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

  // Phase 1 Shoppe-grade variants · sealed 2026-10-01.
  // · Currency picker · defaults to Indonesia launch currency (IDR).
  // · Size variants · pick a template, multi-select values; custom
  //   lets the seller type a comma-separated list.
  // · Colour variants · multi-select up to 10 from the NEX palette.
  // · Size chart image · uploads via uploadSizeChartAction, URL
  //   carried as a hidden field until final submit.
  const [currency, setCurrency] = React.useState<string>(DEFAULT_CURRENCY);
  const [sizeTemplateKey, setSizeTemplateKey] = React.useState<string>("");
  const [sizeValues, setSizeValues] = React.useState<string[]>([]);
  const [customSizes, setCustomSizes] = React.useState<string>("");
  const [colorSlugs, setColorSlugs] = React.useState<string[]>([]);
  const [colorPickerOpen, setColorPickerOpen] = React.useState(false);
  const [sizeChartUrl, setSizeChartUrl] = React.useState<string | null>(null);
  const [sizeChartUploading, setSizeChartUploading] = React.useState(false);
  const [sizeChartError, setSizeChartError] = React.useState<string | null>(
    null,
  );
  const sizeChartRef = React.useRef<HTMLInputElement | null>(null);

  const sizeTemplate = sizeTemplateKey
    ? getVariantTemplate(sizeTemplateKey)
    : null;

  // Toggle a single size value in/out of the pick set.
  const toggleSizeValue = (v: string) => {
    setSizeValues((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  };
  const toggleColor = (slug: string) => {
    setColorSlugs((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX_COLORS_PER_PRODUCT) return prev;
      return [...prev, slug];
    });
  };

  // Serialize variants for the hidden form field. Each entry is a
  // {attribute, name} pair that the server action turns into one
  // nex_product_variant row.
  const serializedVariants = React.useMemo(() => {
    const rows: { attribute: "size" | "colour"; name: string }[] = [];
    // Size · either template values or custom comma-split.
    if (sizeTemplate) {
      if (sizeTemplate.key === "custom_size") {
        customSizes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 30)
          .forEach((name) => rows.push({ attribute: "size", name }));
      } else {
        sizeValues.forEach((name) =>
          rows.push({ attribute: "size", name }),
        );
      }
    }
    // Colour · resolve slugs to palette labels at submit time so the
    // row name reads as "Red" not "red". Server also stores the hex
    // via a future join to nex_color_palette if we want (not needed
    // Phase 1 since the slug is enough to look up).
    colorSlugs.forEach((slug) => {
      const row = colorPalette.find((c) => c.slug === slug);
      if (row) rows.push({ attribute: "colour", name: row.label });
    });
    return JSON.stringify(rows);
  }, [sizeTemplate, sizeValues, customSizes, colorSlugs, colorPalette]);

  const activeCurrency = findCurrency(currency);
  const currencySymbol = activeCurrency?.symbol ?? "£";

  const openSizeChartPicker = () => sizeChartRef.current?.click();

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
          <input type="hidden" name="product_currency" value={currency} />
          <input
            type="hidden"
            name="product_variants"
            value={serializedVariants}
          />
          <input
            type="hidden"
            name="product_size_chart_url"
            value={sizeChartUrl ?? ""}
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

          {/* 3 · Variants + Colours · two dropdowns side-by-side.
              Each opens an expanded panel beneath for value picking.
              Sealed 2026-10-01 · Phase 1 Shoppe-grade. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <div>
              <FieldLabel label="Variants" />
              <select
                value={sizeTemplateKey}
                onChange={(e) => {
                  setSizeTemplateKey(e.target.value);
                  setSizeValues([]);
                  setCustomSizes("");
                }}
                style={selectStyle}
              >
                <option value="">None</option>
                {NEX_VARIANT_TEMPLATES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel
                label={`Colours · ${colorSlugs.length}/${MAX_COLORS_PER_PRODUCT}`}
              />
              <button
                type="button"
                onClick={() => setColorPickerOpen((v) => !v)}
                style={{
                  ...selectStyle,
                  textAlign: "left",
                  color: colorSlugs.length === 0 ? NEX.textDim : NEX.text,
                  cursor: "pointer",
                }}
              >
                {colorSlugs.length === 0
                  ? colorPickerOpen
                    ? "Pick colours below…"
                    : "None · tap to open"
                  : colorSlugs
                      .slice(0, 3)
                      .map(
                        (s) =>
                          colorPalette.find((c) => c.slug === s)?.label ?? s,
                      )
                      .join(" · ") +
                    (colorSlugs.length > 3
                      ? ` + ${colorSlugs.length - 3}`
                      : "")}
              </button>
            </div>
          </div>

          {/* Size values panel · appears when a size template is picked.
              `custom_size` prompts for a comma-separated list instead
              of chip multi-select. */}
          {sizeTemplate && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(0,159,239,0.06)",
                border: `1px solid ${NEX.cyanSoft}`,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: NEX.textDim,
                  lineHeight: 1.5,
                  marginBottom: 10,
                }}
              >
                {sizeTemplate.hint}
              </div>
              {sizeTemplate.key === "custom_size" ? (
                <input
                  type="text"
                  value={customSizes}
                  onChange={(e) => setCustomSizes(e.target.value)}
                  placeholder="e.g. One size, King, Queen"
                  style={inputStyle}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                  }}
                >
                  {sizeTemplate.values.map((v) => {
                    const picked = sizeValues.includes(v);
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => toggleSizeValue(v)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 999,
                          background: picked
                            ? "linear-gradient(180deg, rgba(0,159,239,0.3) 0%, rgba(0,159,239,0.14) 100%)"
                            : "transparent",
                          border: picked
                            ? `1px solid ${NEX.cyan}`
                            : `1px solid rgba(255,255,255,0.14)`,
                          color: picked ? NEX.text : NEX.textDim,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Size chart upload · appears when template requests it */}
              {sizeTemplate.wantsSizeChart && (
                <div style={{ marginTop: 14 }}>
                  <input
                    ref={sizeChartRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setSizeChartError(null);
                        setSizeChartUploading(true);
                        try {
                          const fd = new FormData();
                          fd.append("size_chart", f);
                          const res = await uploadSizeChartAction(fd);
                          if (res.ok) {
                            setSizeChartUrl(res.url);
                          } else {
                            setSizeChartError(res.error);
                          }
                        } catch (err) {
                          setSizeChartError(
                            err instanceof Error
                              ? err.message
                              : "upload_failed",
                          );
                        } finally {
                          setSizeChartUploading(false);
                        }
                      }
                      if (sizeChartRef.current)
                        sizeChartRef.current.value = "";
                    }}
                    style={{ display: "none" }}
                  />
                  <button
                    type="button"
                    onClick={openSizeChartPicker}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 14px",
                      borderRadius: 999,
                      background: sizeChartUrl
                        ? "rgba(143,255,110,0.1)"
                        : "transparent",
                      border: `1px solid ${
                        sizeChartUrl ? NEX.green : NEX.cyanSoft
                      }`,
                      color: sizeChartUrl ? NEX.green : NEX.cyan,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {sizeChartUploading
                      ? "Uploading…"
                      : sizeChartUrl
                        ? "✓ Size chart set · tap to replace"
                        : "+ Upload size chart (optional)"}
                  </button>
                  {sizeChartUrl && (
                    <button
                      type="button"
                      onClick={() => setSizeChartUrl(null)}
                      style={{
                        marginLeft: 8,
                        padding: "6px 10px",
                        borderRadius: 999,
                        background:
                          "linear-gradient(180deg, #B91C1C 0%, #7F1414 100%)",
                        border: "1px solid rgba(255,90,90,0.5)",
                        color: "#FFEDED",
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  )}
                  {sizeChartError && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: NEX.red,
                      }}
                    >
                      {sizeChartError}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Colour palette grid · open/close state is separate from
              selections, so sellers can close the picker without
              losing their picks. Header shows picks count + a Close
              chip in the top-right of the panel. */}
          {colorPickerOpen && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(0,159,239,0.06)",
                border: `1px solid ${NEX.cyanSoft}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: NEX.textDim,
                    lineHeight: 1.5,
                  }}
                >
                  Pick up to {MAX_COLORS_PER_PRODUCT} colours from the NEX
                  palette · {colorSlugs.length}/{MAX_COLORS_PER_PRODUCT} picked.
                </div>
                <button
                  type="button"
                  onClick={() => setColorPickerOpen(false)}
                  aria-label="Close colour picker"
                  style={{
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background:
                      "linear-gradient(180deg, #0a1a30 0%, #020914 100%)",
                    border: `1px solid ${NEX.cyanSoft}`,
                    color: NEX.cyan,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Done
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))",
                  gap: 8,
                }}
              >
                {colorPalette.map((c) => {
                  const picked = colorSlugs.includes(c.slug);
                  const disabled =
                    !picked && colorSlugs.length >= MAX_COLORS_PER_PRODUCT;
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => toggleColor(c.slug)}
                      disabled={disabled}
                      title={c.label}
                      aria-label={c.label}
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        padding: 0,
                        borderRadius: "50%",
                        background: c.hex,
                        border: picked
                          ? `3px solid ${NEX.green}`
                          : `1px solid rgba(255,255,255,0.18)`,
                        cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled ? 0.35 : 1,
                        boxShadow: picked
                          ? "0 0 10px rgba(143,255,110,0.4)"
                          : "0 2px 4px rgba(0,0,0,0.4)",
                        transition:
                          "transform 120ms ease, box-shadow 160ms ease",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* 4 · Price + Currency · two columns · currency defaults to
              IDR per Indonesia launch package but seller can change
              per-product. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: 10,
            }}
          >
            <div>
              <FieldLabel label={`Price (${currencySymbol})`} />
              <input
                type="number"
                name="product_price_major"
                required
                min={0.01}
                step={0.01}
                placeholder={
                  currency === "IDR" ? "e.g. 75000" : "e.g. 24.50"
                }
                style={inputStyle}
              />
            </div>
            <div>
              <FieldLabel label="Currency" />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={selectStyle}
              >
                {NEX_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 5 · Short description */}
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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "auto",
  cursor: "pointer",
};
