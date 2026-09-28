"use client";

// src/app/nex-native/manage/venue/_venue-gallery-editor.tsx
//
// Bridge 23b + 23c-1 · Client component for the venue gallery editor.
// -------------------------------------------------------------------
// Renders up to 6 photo slots. Each slot supports either:
//   · a native file picker (📷) that uploads from the seller's phone
//     or computer via uploadVenuePhotoAction and puts the returned
//     public URL into the slot, or
//   · a plain URL input (for sellers with hosted images already).
// Buyer submits the form and the parent action reads the `urls`
// hidden field as a JSON array.

import { useRef, useState, useTransition } from "react";

const NEX = {
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  orange: "#FF7200",
  green: "#16D66B",
  red: "#FF3355",
};
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const MAX_SLOTS = 6;

export function VenueGalleryEditor({
  initialUrls,
  uploadAction,
}: {
  initialUrls: string[];
  /** Bridge 23c-1 · optional · when set, each slot renders a file
   *  picker button that uploads via this action and pops the URL
   *  into the slot on success. */
  uploadAction?: (
    formData: FormData,
  ) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
}) {
  const seed = initialUrls.slice(0, MAX_SLOTS);
  while (seed.length < MAX_SLOTS) seed.push("");
  const [urls, setUrls] = useState<string[]>(seed);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingIdx, setPendingIdx] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function update(idx: number, value: string) {
    setUrls((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    setUrls((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx]!, next[idx - 1]!];
      return next;
    });
  }

  function clearSlot(idx: number) {
    update(idx, "");
  }

  function pickFileFor(idx: number) {
    fileInputRefs.current[idx]?.click();
  }

  const fileInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  function onFileChosen(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadAction) return;
    setErrorMsg(null);
    setPendingIdx(idx);
    const fd = new FormData();
    fd.append("photo", file);
    startTransition(async () => {
      try {
        const res = await uploadAction(fd);
        if (res.ok) {
          update(idx, res.url);
        } else {
          setErrorMsg(res.error || "Upload failed");
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setPendingIdx(null);
        // Reset the input so choosing the same file again re-fires.
        if (fileInputRefs.current[idx]) {
          fileInputRefs.current[idx]!.value = "";
        }
      }
    });
  }

  const clean = urls.map((u) => u.trim()).filter((u) => u.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {urls.map((url, idx) => {
        const isUploadingHere = pendingIdx === idx && isPending;
        return (
          <div
            key={idx}
            style={{
              display: "grid",
              gridTemplateColumns: "56px 1fr auto",
              gap: 10,
              alignItems: "center",
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(0,0,0,0.28)",
              border: `1px solid ${NEX.border}`,
              opacity: isUploadingHere ? 0.6 : 1,
              transition: "opacity 200ms ease",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 8,
                background: url
                  ? `url(${url}) center/cover`
                  : "rgba(139,169,209,0.08)",
                border: `1px solid ${NEX.border}`,
                position: "relative",
              }}
              aria-hidden
            >
              {isUploadingHere && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    color: NEX.cyan,
                  }}
                >
                  …
                </div>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: idx === 0 ? NEX.cyan : NEX.textMute,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {idx === 0 ? "Cover" : `Photo ${idx + 1}`}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="url"
                  value={url}
                  onChange={(e) => update(idx, e.target.value)}
                  maxLength={800}
                  placeholder="Upload a photo, or paste a URL"
                  disabled={isUploadingHere}
                  style={{
                    flex: "1 1 180px",
                    minWidth: 0,
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "rgba(0,0,0,0.35)",
                    border: `1px solid ${NEX.border}`,
                    color: NEX.text,
                    fontSize: 12,
                    fontFamily: SANS,
                    outline: "none",
                  }}
                />
                {uploadAction && (
                  <>
                    <button
                      type="button"
                      onClick={() => pickFileFor(idx)}
                      disabled={isUploadingHere}
                      title="Upload from phone or computer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "8px 12px",
                        borderRadius: 999,
                        background: "rgba(0,175,255,0.10)",
                        border: `1px solid ${NEX.cyanSoft}`,
                        color: NEX.cyan,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        cursor: isUploadingHere ? "not-allowed" : "pointer",
                        fontFamily: SANS,
                        whiteSpace: "nowrap",
                      }}
                    >
                      📷 {isUploadingHere ? "Uploading…" : "Upload"}
                    </button>
                    <input
                      ref={(el) => {
                        fileInputRefs.current[idx] = el;
                      }}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/heic,image/heif"
                      onChange={(e) => onFileChosen(idx, e)}
                      style={{ display: "none" }}
                    />
                  </>
                )}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <button
                type="button"
                onClick={() => moveUp(idx)}
                disabled={idx === 0 || !url.trim() || isUploadingHere}
                aria-label="Move up"
                title="Move up"
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background:
                    idx === 0 || !url.trim()
                      ? "transparent"
                      : "rgba(0,175,255,0.10)",
                  border: `1px solid ${NEX.borderStrong}`,
                  color:
                    idx === 0 || !url.trim() ? NEX.textMute : NEX.cyan,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor:
                    idx === 0 || !url.trim() ? "not-allowed" : "pointer",
                  fontFamily: SANS,
                }}
              >
                ↑
              </button>
              {url.trim() && (
                <button
                  type="button"
                  onClick={() => clearSlot(idx)}
                  disabled={isUploadingHere}
                  aria-label="Remove"
                  title="Remove"
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "transparent",
                    border: `1px solid rgba(255,51,85,0.25)`,
                    color: NEX.red,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    fontFamily: SANS,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        );
      })}
      <input type="hidden" name="urls" value={JSON.stringify(clean)} />
      {errorMsg && (
        <div
          role="alert"
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(255,51,85,0.10)",
            border: "1px solid rgba(255,51,85,0.35)",
            color: "#FFB4C0",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {errorMsg}
        </div>
      )}
      <div
        style={{
          fontSize: 11,
          color: NEX.textMute,
          lineHeight: 1.5,
        }}
      >
        {clean.length} of {MAX_SLOTS} photos filled · tap 📷 to upload from
        your phone or computer, or paste an existing URL · reorder with
        the ↑ button so your favourite becomes the cover.
      </div>
    </div>
  );
}
