"use client";

// src/app/nex-native/chat/_qr-image-scanner.tsx
//
// Bridge 16d · Client-side QR-code detector for image attachments.
// ----------------------------------------------------------------
// Scans image attachments in the peer chat with jsQR (pure JS, canvas
// based). When a QR decodes to something that looks like an Indonesian
// payment target (QRIS / GoPay / DANA / OVO / ShopeePay / bank
// transfer link), the shell surfaces a red warning bubble beneath the
// offending image · same visual language as the text-detection warning
// from Bridge 16b.
//
// Runs entirely on the viewer's device · no server round-trip, no
// image upload to a third party.
//
// Detection strategy:
//   1. Fetch the image as a Blob
//   2. Decode via createImageBitmap
//   3. Draw to OffscreenCanvas (or hidden Canvas fallback)
//   4. Extract ImageData
//   5. Feed to jsQR
//   6. Classify the decoded string as payment/not-payment
//
// Kept in the shared chat/ directory so both peer and business chats
// can consume it (business chat with sellers may need it later too).

import { useEffect, useState } from "react";
import jsQR from "jsqr";

/** Classify a decoded QR payload · returns true when it looks like
 *  an Indonesian payment target we should warn about. Deliberately
 *  biased toward false positives · one extra warning is cheaper than
 *  one missed scam. */
export function isPaymentQrPayload(payload: string): boolean {
  if (!payload || payload.length < 3) return false;
  const p = payload.toLowerCase();

  // QRIS payloads start with a specific structure (EMV QR spec) ·
  // typically the string starts with "00020101" and contains "id"
  // merchant identifiers. Any modern Indonesian merchant QR is QRIS.
  if (payload.startsWith("00020101")) return true;

  // Direct deep-links · gojek / gopay / shopeepay / dana / ovo /
  // linkaja all use uri schemes that mention the wallet name.
  const walletPatterns = [
    "gopay:",
    "gopay.",
    "gojek:",
    "shopeepay:",
    "shopeepay.",
    "dana:",
    "dana.",
    "ovo:",
    "ovo.",
    "linkaja:",
    "linkaja.",
  ];
  if (walletPatterns.some((k) => p.includes(k))) return true;

  // URL-based payment intents · shopee.co.id/qr, tokopedia.com/pay,
  // BCA / Mandiri / BRI transfer links.
  if (
    p.includes("payment") ||
    p.includes("pay?") ||
    p.includes("/qr") ||
    p.includes("/pay/")
  )
    return true;
  const bankPatterns = [
    "klikbca.com",
    "ibank.bri",
    "mandiri.co.id",
    "bni.co.id",
    "cimbclicks",
    "danamon",
    "permatabank",
  ];
  if (bankPatterns.some((k) => p.includes(k))) return true;

  return false;
}

/** React hook: fetches + scans an image URL for a QR code. Returns
 *  a status the caller can use to show the warning. Caches per URL
 *  via a component-local ref so scans don't repeat when the message
 *  list re-renders. */
export function useQrScan(imageUrl: string | null | undefined): {
  status: "idle" | "scanning" | "clean" | "payment_qr" | "error";
  payload: string | null;
} {
  const [status, setStatus] = useState<
    "idle" | "scanning" | "clean" | "payment_qr" | "error"
  >("idle");
  const [payload, setPayload] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setStatus("idle");
      setPayload(null);
      return;
    }
    let cancelled = false;
    setStatus("scanning");
    setPayload(null);

    (async () => {
      try {
        const res = await fetch(imageUrl, { cache: "force-cache" });
        if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
        const blob = await res.blob();
        const bitmap = await createImageBitmap(blob);
        // Cap decode size · huge photos slow us down and the QR is
        // recognisable at 800px.
        const maxDim = 800;
        const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
        const w = Math.round(bitmap.width * scale);
        const h = Math.round(bitmap.height * scale);

        // Prefer OffscreenCanvas when available, fall back to a
        // detached HTMLCanvasElement in older browsers.
        let imageData: ImageData;
        if (typeof OffscreenCanvas !== "undefined") {
          const canvas = new OffscreenCanvas(w, h);
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("no 2d ctx");
          ctx.drawImage(bitmap, 0, 0, w, h);
          imageData = ctx.getImageData(0, 0, w, h);
        } else {
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("no 2d ctx");
          ctx.drawImage(bitmap, 0, 0, w, h);
          imageData = ctx.getImageData(0, 0, w, h);
        }

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        if (cancelled) return;
        if (code && code.data) {
          setPayload(code.data);
          setStatus(isPaymentQrPayload(code.data) ? "payment_qr" : "clean");
        } else {
          setStatus("clean");
        }
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        void e;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return { status, payload };
}

/** Bridge 16d · drop-in probe used by the bloom shell. Runs the
 *  hook and renders the warning inline when the image contains a
 *  payment QR. Kept in this file so the shell can stay a server
 *  component and just import a single client wrapper. */
export function ImageQrProbe({
  imageUrl,
  mine,
}: {
  imageUrl: string;
  mine: boolean;
}) {
  const { status } = useQrScan(imageUrl);
  if (status !== "payment_qr") return null;
  return (
    <QrPaymentWarning
      mine={mine}
      label="⚠ Payment QR detected"
      body="This looks like a QRIS / wallet / bank payment code. Direct payment before delivery is not protected · request COD or Escrow instead ·"
      cta="learn how"
    />
  );
}

/** Small red warning strip shown beneath a payment-QR image
 *  attachment. Client-only · rendered from the shell. */
export function QrPaymentWarning({
  mine,
  label,
  body,
  cta,
}: {
  mine: boolean;
  label: string;
  body: string;
  cta: string;
}) {
  return (
    <div
      style={{
        margin: "6px 0 12px",
        display: "flex",
        justifyContent: mine ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: 320,
          padding: "10px 12px",
          borderRadius: 12,
          background: "rgba(255,51,85,0.10)",
          border: "1px solid rgba(255,51,85,0.35)",
          color: "#FFB4C0",
          fontSize: 12,
          lineHeight: 1.5,
          boxShadow: "0 6px 14px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#FF7A85",
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div style={{ color: "rgba(255,255,255,0.9)" }}>
          {body}{" "}
          <a
            href="/nex-native/safe-trade"
            target="_blank"
            rel="noopener"
            style={{
              color: "#FF7A85",
              textDecoration: "underline",
              textDecorationColor: "rgba(255,51,85,0.6)",
              textUnderlineOffset: 2,
            }}
          >
            {cta}
          </a>
        </div>
      </div>
    </div>
  );
}
