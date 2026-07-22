// Merchant asset engine — generates print-ready site posters,
// Google-review posters, and pocket business cards from data
// already on the merchant's canteen.
//
// One engine, three kinds. Output = PNG preview (screen) and
// PDF (A3 / A5 print at 300dpi). QR code embedded server-side
// via `qrcode`.
//
// Templates live inline in this file — no separate JSON. Each
// template is a pure function of merchant data → SVG string.
// PDF is composed via pdf-lib (embeds the SVG-rendered PNG at
// 300dpi so print quality holds).

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

export type AssetKind = "site_poster" | "google_review" | "business_card";

export type AssetTemplate = {
  slug:        string;
  kind:        AssetKind;
  label:       string;
  bgColor:     string;
  accentColor: string;
  textColor:   string;
};

export const TEMPLATES: AssetTemplate[] = [
  // ─── Site posters (A3 landscape) ─────────────────────────
  { slug: "v1_bold_yellow",  kind: "site_poster",   label: "Bold Yellow",   bgColor: "#0A0A0A", accentColor: "#FFB300", textColor: "#FFFFFF" },
  { slug: "v2_construction", kind: "site_poster",   label: "Construction",  bgColor: "#FFB300", accentColor: "#0A0A0A", textColor: "#0A0A0A" },
  { slug: "v3_iron",         kind: "site_poster",   label: "Iron",          bgColor: "#1F2937", accentColor: "#F97316", textColor: "#F5F5F5" },
  { slug: "v4_chalk",        kind: "site_poster",   label: "Chalk",         bgColor: "#FBF6EC", accentColor: "#166534", textColor: "#0A0A0A" },
  { slug: "v5_hivis",        kind: "site_poster",   label: "Hi-Vis Green",  bgColor: "#166534", accentColor: "#FFB300", textColor: "#FFFFFF" },
  { slug: "v6_brick",        kind: "site_poster",   label: "Brick",         bgColor: "#7C2D12", accentColor: "#FBF6EC", textColor: "#FBF6EC" },

  // ─── Google-review posters (A4 portrait) ─────────────────
  { slug: "review_v1_stars", kind: "google_review", label: "5-star spotlight", bgColor: "#FFFFFF", accentColor: "#FFB300", textColor: "#0A0A0A" },
  { slug: "review_v2_dark",  kind: "google_review", label: "Dark spotlight",   bgColor: "#0A0A0A", accentColor: "#FFB300", textColor: "#FFFFFF" },

  // ─── Business cards (85×55mm print) ──────────────────────
  { slug: "card_v1_yellow",  kind: "business_card", label: "Yellow tab",    bgColor: "#0A0A0A", accentColor: "#FFB300", textColor: "#FFFFFF" },
  { slug: "card_v2_chalk",   kind: "business_card", label: "Chalk minimal", bgColor: "#FBF6EC", accentColor: "#0A0A0A", textColor: "#0A0A0A" }
];

export const KIND_META: Record<AssetKind, { label: string; hint: string; pageSize: "A3" | "A4" | "card" }> = {
  site_poster:   { label: "Site Poster",        hint: "For van window · site fence · skip · site board", pageSize: "A3" },
  google_review: { label: "Google Review Card", hint: "Ask customers to leave a Google review",           pageSize: "A4" },
  business_card: { label: "Business Card Pack", hint: "12-up card sheet · print at home or take to Vistaprint", pageSize: "card" }
};

export type MerchantAssetInput = {
  merchantSlug:     string;
  displayName:      string;
  tradeLabel:       string;
  city:             string | null;
  headline:         string;   // merchant-authored ("Scan for reviews", "Fast quote")
  qrTargetUrl:      string;   // where the QR resolves (usually /api/assets/scan/[id])
  footerRemoved:    boolean;  // paid £2.99 unlock
  googleReviewUrl?: string | null;
  reviewCount?:     number;
  reviewAvg?:       number;
};

/** Render an SVG string for the given template + merchant data.
 *  Deliberately imperative — SVG is small, no need for JSX. */
export async function renderAssetSvg(
  template: AssetTemplate,
  input:    MerchantAssetInput
): Promise<string> {
  const qrPngDataUrl = await QRCode.toDataURL(input.qrTargetUrl, {
    errorCorrectionLevel: "H",
    margin:               1,
    scale:                12,
    color:                { dark: "#0A0A0A", light: "#FFFFFF" }
  });

  const isPoster = template.kind === "site_poster";
  const isReview = template.kind === "google_review";
  const isCard   = template.kind === "business_card";

  // Page dimensions in mm × 300dpi (converted to pixels for SVG viewBox)
  // A3 landscape: 420×297mm → 4961×3508
  // A4 portrait:  210×297mm → 2480×3508
  // Business card: 85×55mm  → 1004×650
  const W = isPoster ? 4961 : isReview ? 2480 : 1004;
  const H = isPoster ? 3508 : isReview ? 3508 : 650;

  const footer = input.footerRemoved
    ? ""
    : `<text x="${W / 2}" y="${H - 60}" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="42" fill="${template.textColor}" opacity="0.55" text-anchor="middle">Powered by The Networkers · thenetworkers.app</text>`;

  if (isPoster) {
    const qrSize = 1400;
    const qrX = W - qrSize - 200;
    const qrY = (H - qrSize) / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="${template.bgColor}"/>
      <rect x="0" y="0" width="80" height="${H}" fill="${template.accentColor}"/>
      <text x="200" y="500" font-family="Inter, Arial, sans-serif" font-weight="900" font-size="240" fill="${template.textColor}" letter-spacing="-4">${escapeXml(input.headline || "SCAN FOR REVIEWS")}</text>
      <text x="200" y="800" font-family="Inter, Arial, sans-serif" font-weight="900" font-size="130" fill="${template.accentColor}">${escapeXml(input.displayName)}</text>
      <text x="200" y="960" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="90" fill="${template.textColor}" opacity="0.85">${escapeXml(input.tradeLabel)}${input.city ? ` · ${escapeXml(input.city)}` : ""}</text>
      <image x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" href="${qrPngDataUrl}"/>
      <rect x="${qrX - 40}" y="${qrY - 40}" width="${qrSize + 80}" height="${qrSize + 80}" fill="none" stroke="${template.accentColor}" stroke-width="16"/>
      <text x="${qrX + qrSize / 2}" y="${qrY + qrSize + 180}" font-family="Inter, Arial, sans-serif" font-weight="900" font-size="90" fill="${template.textColor}" text-anchor="middle">SCAN TO CONNECT</text>
      ${footer}
    </svg>`;
  }

  if (isReview) {
    const qrSize = 1200;
    const qrX = (W - qrSize) / 2;
    const qrY = 1600;
    const stars = "★★★★★";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="${template.bgColor}"/>
      <text x="${W / 2}" y="380" font-family="Inter, Arial, sans-serif" font-weight="900" font-size="200" fill="${template.accentColor}" text-anchor="middle">${stars}</text>
      <text x="${W / 2}" y="640" font-family="Inter, Arial, sans-serif" font-weight="900" font-size="180" fill="${template.textColor}" text-anchor="middle">${escapeXml(input.headline || "Loved our work?")}</text>
      <text x="${W / 2}" y="900" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="110" fill="${template.textColor}" opacity="0.80" text-anchor="middle">Please leave us a Google review</text>
      <text x="${W / 2}" y="1150" font-family="Inter, Arial, sans-serif" font-weight="900" font-size="140" fill="${template.accentColor}" text-anchor="middle">${escapeXml(input.displayName)}</text>
      <text x="${W / 2}" y="1330" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="90" fill="${template.textColor}" opacity="0.70" text-anchor="middle">${escapeXml(input.tradeLabel)}${input.city ? ` · ${escapeXml(input.city)}` : ""}</text>
      <image x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" href="${qrPngDataUrl}"/>
      <text x="${W / 2}" y="${qrY + qrSize + 180}" font-family="Inter, Arial, sans-serif" font-weight="900" font-size="90" fill="${template.textColor}" text-anchor="middle">SCAN TO REVIEW</text>
      ${footer}
    </svg>`;
  }

  // Business card — single card layout (multiple copies laid out later)
  const qrSize = 380;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${template.bgColor}"/>
    <rect x="0" y="0" width="${qrSize + 60}" height="${H}" fill="${template.accentColor}"/>
    <image x="30" y="${(H - qrSize) / 2}" width="${qrSize}" height="${qrSize}" href="${qrPngDataUrl}"/>
    <text x="${qrSize + 100}" y="180" font-family="Inter, Arial, sans-serif" font-weight="900" font-size="70" fill="${template.textColor}">${escapeXml(input.displayName)}</text>
    <text x="${qrSize + 100}" y="270" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="42" fill="${template.textColor}" opacity="0.85">${escapeXml(input.tradeLabel)}${input.city ? ` · ${escapeXml(input.city)}` : ""}</text>
    <text x="${qrSize + 100}" y="440" font-family="Inter, Arial, sans-serif" font-weight="900" font-size="52" fill="${template.textColor}">${escapeXml(input.headline || "Scan for quote")}</text>
    ${footer ? `<text x="${qrSize + 100}" y="580" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="26" fill="${template.textColor}" opacity="0.50">Powered by The Networkers</text>` : ""}
  </svg>`;
}

/** Render the asset as a print-ready PDF at the correct page size.
 *  Composes the SVG output onto a pdf-lib page. For A3/A4 we
 *  embed the SVG's PNG rendering directly; for business cards we
 *  lay 12 copies per A4 sheet in a 3×4 grid. */
export async function renderAssetPdf(
  template: AssetTemplate,
  input:    MerchantAssetInput
): Promise<Uint8Array> {
  const svgString = await renderAssetSvg(template, input);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${input.displayName} — ${KIND_META[template.kind].label}`);
  pdf.setCreator("thenetworkers.app");

  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const meta = KIND_META[template.kind];

  // Page size in PDF points (1pt = 1/72 inch)
  //  A3 landscape: 1190.55 × 841.89
  //  A4 portrait:   595.28 × 841.89
  //  A4 for card sheet: 595.28 × 841.89
  const [pW, pH] = meta.pageSize === "A3"
    ? [1190.55, 841.89]
    : [595.28, 841.89];

  const page = pdf.addPage([pW, pH]);

  // pdf-lib doesn't render SVG natively. We fall back to a fully
  // native pdf-lib composition — using primitives (rectangles + text)
  // that mirror the SVG design. Cheaper than shelling out to
  // headless Chromium, and yields a real vector PDF (not a raster
  // screenshot).
  const bg     = hexToRgb(template.bgColor);
  const accent = hexToRgb(template.accentColor);
  const text   = hexToRgb(template.textColor);

  // Background
  page.drawRectangle({ x: 0, y: 0, width: pW, height: pH, color: rgb(bg.r, bg.g, bg.b) });

  if (template.kind === "site_poster") {
    // Left accent strip
    page.drawRectangle({ x: 0, y: 0, width: 20, height: pH, color: rgb(accent.r, accent.g, accent.b) });

    page.drawText((input.headline || "SCAN FOR REVIEWS").toUpperCase(), {
      x: 50, y: pH - 130, size: 64, font, color: rgb(text.r, text.g, text.b)
    });
    page.drawText(input.displayName, {
      x: 50, y: pH - 210, size: 36, font, color: rgb(accent.r, accent.g, accent.b)
    });
    page.drawText(`${input.tradeLabel}${input.city ? ` · ${input.city}` : ""}`, {
      x: 50, y: pH - 250, size: 22, font, color: rgb(text.r, text.g, text.b), opacity: 0.85
    });

    // QR (right side)
    const qrPngDataUrl = await QRCode.toDataURL(input.qrTargetUrl, {
      errorCorrectionLevel: "H", margin: 1, scale: 12,
      color: { dark: "#0A0A0A", light: "#FFFFFF" }
    });
    const qrBytes = Uint8Array.from(atob(qrPngDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
    const qrImg = await pdf.embedPng(qrBytes);
    const qrSize = 350;
    page.drawImage(qrImg, { x: pW - qrSize - 60, y: (pH - qrSize) / 2, width: qrSize, height: qrSize });
    page.drawText("SCAN TO CONNECT", {
      x: pW - qrSize - 60, y: (pH - qrSize) / 2 - 30, size: 20, font, color: rgb(text.r, text.g, text.b)
    });

    if (!input.footerRemoved) {
      page.drawText("Powered by The Networkers · thenetworkers.app", {
        x: 50, y: 20, size: 12, font, color: rgb(text.r, text.g, text.b), opacity: 0.55
      });
    }
  } else if (template.kind === "google_review") {
    const cx = pW / 2;
    // Draw 5 stars
    page.drawText("★★★★★", {
      x: cx - 90, y: pH - 100, size: 44, font, color: rgb(accent.r, accent.g, accent.b)
    });
    page.drawText(input.headline || "Loved our work?", {
      x: cx - 130, y: pH - 170, size: 32, font, color: rgb(text.r, text.g, text.b)
    });
    page.drawText("Please leave us a Google review", {
      x: cx - 130, y: pH - 210, size: 18, font, color: rgb(text.r, text.g, text.b), opacity: 0.8
    });
    page.drawText(input.displayName, {
      x: cx - 100, y: pH - 260, size: 26, font, color: rgb(accent.r, accent.g, accent.b)
    });
    page.drawText(`${input.tradeLabel}${input.city ? ` · ${input.city}` : ""}`, {
      x: cx - 100, y: pH - 285, size: 14, font, color: rgb(text.r, text.g, text.b), opacity: 0.7
    });

    const qrPngDataUrl = await QRCode.toDataURL(input.qrTargetUrl, {
      errorCorrectionLevel: "H", margin: 1, scale: 12,
      color: { dark: "#0A0A0A", light: "#FFFFFF" }
    });
    const qrBytes = Uint8Array.from(atob(qrPngDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
    const qrImg   = await pdf.embedPng(qrBytes);
    const qrSize  = 280;
    page.drawImage(qrImg, { x: cx - qrSize / 2, y: 200, width: qrSize, height: qrSize });
    page.drawText("SCAN TO REVIEW", {
      x: cx - 55, y: 170, size: 16, font, color: rgb(text.r, text.g, text.b)
    });

    if (!input.footerRemoved) {
      page.drawText("Powered by The Networkers", {
        x: cx - 90, y: 30, size: 10, font, color: rgb(text.r, text.g, text.b), opacity: 0.5
      });
    }
  } else {
    // Business card sheet — 12 cards in a 3×4 grid on A4
    const cardW = 240, cardH = 155;
    const marginX = (pW - cardW * 2 - 20) / 2;
    const marginY = 40;
    const qrPngDataUrl = await QRCode.toDataURL(input.qrTargetUrl, {
      errorCorrectionLevel: "M", margin: 1, scale: 6,
      color: { dark: "#0A0A0A", light: "#FFFFFF" }
    });
    const qrBytes = Uint8Array.from(atob(qrPngDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
    const qrImg   = await pdf.embedPng(qrBytes);
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 2; col++) {
        const cx = marginX + col * (cardW + 20);
        const cy = pH - marginY - (row + 1) * (cardH + 8);
        page.drawRectangle({ x: cx, y: cy, width: cardW, height: cardH, color: rgb(bg.r, bg.g, bg.b) });
        page.drawRectangle({ x: cx, y: cy, width: 90, height: cardH, color: rgb(accent.r, accent.g, accent.b) });
        page.drawImage(qrImg, { x: cx + 10, y: cy + (cardH - 70) / 2, width: 70, height: 70 });
        page.drawText(input.displayName.slice(0, 20), {
          x: cx + 100, y: cy + cardH - 30, size: 12, font, color: rgb(text.r, text.g, text.b)
        });
        page.drawText(`${input.tradeLabel.slice(0, 22)}`, {
          x: cx + 100, y: cy + cardH - 48, size: 9, font, color: rgb(text.r, text.g, text.b), opacity: 0.85
        });
        page.drawText((input.headline || "Scan for quote").slice(0, 24), {
          x: cx + 100, y: cy + 32, size: 11, font, color: rgb(text.r, text.g, text.b)
        });
        if (input.city) {
          page.drawText(input.city, {
            x: cx + 100, y: cy + 14, size: 8, font, color: rgb(text.r, text.g, text.b), opacity: 0.7
          });
        }
      }
    }
  }

  void svgString;   // reserved — future PNG-preview render pipeline
  return pdf.save();
}

// ─── helpers ─────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}
