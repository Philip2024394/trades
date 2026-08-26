"use client";

// NEX Market ProductGallery · patterned after Hammer's ProductGallery.tsx.
// Main image + thumbnail rail + click-to-swap + keyboard-accessible.

import { useState } from "react";

interface ImageItem { imageId: string; url: string; altText: string | null }

export default function ProductGallery({
  images, productName,
}: { images: ImageItem[]; productName: string }): React.JSX.Element {
  const [active, setActive] = useState(0);
  const seed = images.length > 0
    ? images
    : [{ imageId: "placeholder", url: "", altText: productName } as ImageItem];
  const current = seed[Math.min(active, seed.length - 1)];

  return (
    <div>
      <div
        style={{
          position: "relative",
          aspectRatio: "1/1",
          background: "#f4f1eb",
          borderRadius: 16,
          overflow: "hidden",
          backgroundImage: current?.url ? `url("${current.url}")` : undefined,
          backgroundSize: "cover", backgroundPosition: "center",
        }}
      >
        {!current?.url && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#8a8776", fontSize: 13,
          }}>
            No image available
          </div>
        )}
      </div>
      {seed.length > 1 && (
        <div style={{ display: "flex", gap: 10, marginTop: 12, overflowX: "auto" }}>
          {seed.map((img, i) => (
            <button
              key={img.imageId}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show image ${i + 1}`}
              style={{
                flex: "0 0 auto",
                width: 72, height: 72,
                border: i === active ? "2px solid #1a1a1a" : "1px solid rgba(0,0,0,0.08)",
                borderRadius: 10,
                background: "#f4f1eb",
                backgroundImage: img.url ? `url("${img.url}")` : undefined,
                backgroundSize: "cover", backgroundPosition: "center",
                cursor: "pointer", padding: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
