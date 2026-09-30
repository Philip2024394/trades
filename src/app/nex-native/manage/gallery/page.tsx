// src/app/nex-native/manage/gallery/page.tsx
//
// Bridge Gallery-C · sealed 2026-09-30 · seller editor for the
// nex_gallery_image table. Populates the Personal Brand Images tab
// (Templates 10 / 13 / 14) with the seller's real photography +
// captions + long descriptions.
//
// One scroll · upload panel at the top · one card per existing image
// with inline caption + description editors + up/down/delete buttons.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import {
  listGalleryImages,
  NEX_GALLERY_CAPTION_MAX,
  NEX_GALLERY_LONG_DESCRIPTION_MAX,
  NEX_GALLERY_IMAGE_MAX_BYTES,
  type NexGalleryImageRow,
} from "@/lib/nex-native/gallery-image-service";
import {
  deleteGalleryImageAction,
  moveGalleryImageAction,
  updateGalleryImageAction,
  uploadGalleryImageAction,
} from "./_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#050f1e",
  border: "rgba(139, 169, 209, 0.18)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  green: "#16D66B",
  red: "#FF3355",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function ManageGalleryPage({
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
  const images = await listGalleryImages(business.id);

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        padding: "22px 18px 60px",
      }}
    >
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <header style={{ marginBottom: 18 }}>
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
            Bridge Gallery-C · Founder-sealed 2026-09-30
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            Gallery
          </h1>
          <p
            style={{
              marginTop: 8,
              color: NEX.textDim,
              fontSize: 13,
              lineHeight: 1.55,
              maxWidth: 620,
            }}
          >
            Upload photos that render on the <strong>Images</strong> tab of
            your Personal Brand cover. Each image supports a short caption
            (under the tile) and a longer body (opens in the lightbox when
            a buyer taps the image). Reorder anytime · delete anytime ·
            edits are live the moment you save.
          </p>
          <div style={{ marginTop: 10 }}>
            <Link
              href="/nex-native/manage/shop"
              style={{
                fontSize: 12,
                color: NEX.cyan,
                textDecoration: "none",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              ‹ Back to /manage/shop
            </Link>
          </div>
        </header>

        {banner && (
          <div
            role="alert"
            style={{
              marginBottom: 14,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(255, 51, 85, 0.14)",
              border: `1px solid ${NEX.red}`,
              color: "#FFB4C0",
              fontSize: 13,
            }}
          >
            <strong style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10 }}>
              {banner.code}
            </strong>{" "}
            {banner.message}
          </div>
        )}
        {okBanner && (
          <div
            role="status"
            style={{
              marginBottom: 14,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(22, 214, 107, 0.12)",
              border: `1px solid ${NEX.green}`,
              color: "#8FF3C1",
              fontSize: 13,
            }}
          >
            Saved · your Personal Brand cover has been updated.
          </div>
        )}

        {/* Upload panel */}
        <section
          style={{
            padding: "16px 18px",
            borderRadius: 14,
            border: `1px solid ${NEX.border}`,
            background: NEX.panel,
            marginBottom: 22,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: NEX.cyan,
              marginBottom: 12,
            }}
          >
            Upload a new image
          </h2>
          <form
            action={uploadGalleryImageAction.bind(null, business.id)}
            encType="multipart/form-data"
            style={{ display: "grid", gap: 12 }}
          >
            <label style={{ display: "grid", gap: 5 }}>
              <span style={eyebrowStyle()}>File · png / jpg / webp · max {NEX_GALLERY_IMAGE_MAX_BYTES / (1024 * 1024)}MB</span>
              <input
                type="file"
                name="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                required
                style={fileInputStyle()}
              />
            </label>
            <label style={{ display: "grid", gap: 5 }}>
              <span style={eyebrowStyle()}>
                Caption · shown under the thumbnail · max {NEX_GALLERY_CAPTION_MAX} chars
              </span>
              <input
                type="text"
                name="caption"
                maxLength={NEX_GALLERY_CAPTION_MAX}
                placeholder="e.g. Studio front on rainy morning"
                style={textInputStyle()}
              />
            </label>
            <label style={{ display: "grid", gap: 5 }}>
              <span style={eyebrowStyle()}>
                Long description · shown in the lightbox · max {NEX_GALLERY_LONG_DESCRIPTION_MAX} chars
              </span>
              <textarea
                name="long_description"
                maxLength={NEX_GALLERY_LONG_DESCRIPTION_MAX}
                rows={4}
                placeholder="Tell the story behind this photo — what it shows, why it matters, any context a buyer might want."
                style={textAreaStyle()}
              />
            </label>
            <button type="submit" style={primaryButtonStyle()}>
              Upload
            </button>
          </form>
        </section>

        {/* Existing gallery */}
        <section>
          <h2
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: NEX.cyan,
              marginBottom: 12,
            }}
          >
            Your gallery · {images.length}{" "}
            {images.length === 1 ? "image" : "images"}
          </h2>
          {images.length === 0 && (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                border: `1px dashed ${NEX.border}`,
                borderRadius: 12,
                color: NEX.textDim,
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              No images yet. Upload your first one above · your Personal
              Brand Images tab will show placeholder tiles until then.
            </div>
          )}
          <div style={{ display: "grid", gap: 14 }}>
            {images.map((img, idx) => (
              <GalleryImageCard
                key={img.id}
                businessId={business.id}
                image={img}
                isFirst={idx === 0}
                isLast={idx === images.length - 1}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function GalleryImageCard({
  businessId,
  image,
  isFirst,
  isLast,
}: {
  businessId: string;
  image: NexGalleryImageRow;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <article
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: 14,
        padding: 14,
        borderRadius: 12,
        border: `1px solid ${NEX.border}`,
        background: NEX.panel,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.image_url}
        alt={image.caption || "Gallery image"}
        style={{
          width: 120,
          height: 120,
          objectFit: "cover",
          borderRadius: 10,
          border: `1px solid ${NEX.border}`,
        }}
      />
      <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
        <form
          action={updateGalleryImageAction.bind(null, businessId, image.id)}
          style={{ display: "grid", gap: 10 }}
        >
          <label style={{ display: "grid", gap: 5 }}>
            <span style={eyebrowStyle()}>Caption</span>
            <input
              type="text"
              name="caption"
              defaultValue={image.caption}
              maxLength={NEX_GALLERY_CAPTION_MAX}
              placeholder="Studio front on rainy morning"
              style={textInputStyle()}
            />
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={eyebrowStyle()}>Long description</span>
            <textarea
              name="long_description"
              defaultValue={image.long_description}
              maxLength={NEX_GALLERY_LONG_DESCRIPTION_MAX}
              rows={3}
              style={textAreaStyle()}
            />
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" style={primaryButtonStyle()}>
              Save
            </button>
          </div>
        </form>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!isFirst && (
            <form
              action={moveGalleryImageAction.bind(null, businessId, image.id, "up")}
            >
              <button type="submit" style={secondaryButtonStyle()}>
                ↑ Move up
              </button>
            </form>
          )}
          {!isLast && (
            <form
              action={moveGalleryImageAction.bind(null, businessId, image.id, "down")}
            >
              <button type="submit" style={secondaryButtonStyle()}>
                ↓ Move down
              </button>
            </form>
          )}
          <form
            action={deleteGalleryImageAction.bind(null, businessId, image.id)}
          >
            <button type="submit" style={dangerButtonStyle()}>
              Delete
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}

// ─── Style helpers ──────────────────────────────────────────────────

function eyebrowStyle(): React.CSSProperties {
  return {
    fontSize: 10,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: NEX.textDim,
    fontWeight: 700,
  };
}

function textInputStyle(): React.CSSProperties {
  return {
    appearance: "none",
    padding: "9px 12px",
    borderRadius: 8,
    border: `1px solid ${NEX.border}`,
    background: NEX.bg,
    color: NEX.text,
    fontFamily: SANS,
    fontSize: 13,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };
}

function textAreaStyle(): React.CSSProperties {
  return {
    ...textInputStyle(),
    fontFamily: SANS,
    resize: "vertical",
    minHeight: 56,
  };
}

function fileInputStyle(): React.CSSProperties {
  return {
    padding: "6px 4px",
    color: NEX.text,
    fontSize: 12,
    fontFamily: SANS,
  };
}

function primaryButtonStyle(): React.CSSProperties {
  return {
    appearance: "none",
    padding: "8px 14px",
    borderRadius: 8,
    border: "none",
    background: NEX.cyan,
    color: "#03101D",
    fontFamily: SANS,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    cursor: "pointer",
  };
}

function secondaryButtonStyle(): React.CSSProperties {
  return {
    appearance: "none",
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${NEX.cyanSoft}`,
    background: "transparent",
    color: NEX.cyan,
    fontFamily: SANS,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  };
}

function dangerButtonStyle(): React.CSSProperties {
  return {
    appearance: "none",
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${NEX.red}`,
    background: "transparent",
    color: NEX.red,
    fontFamily: SANS,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  };
}
