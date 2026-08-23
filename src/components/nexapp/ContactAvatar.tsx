// NEX Contacts · Avatar components (leaf file · small compile footprint).
// Extracted from ContactsPanel 2026-08-21 to reduce webpack per-file
// heap peak on the 8 GB Victus (see file-split note in ContactsPanel).

"use client";

import { NEX } from "@/lib/nexapp/tokens";
import { nameInitials } from "@/lib/nexapp/mockContacts";

export function Avatar({
  name,
  url,
  status,
  size = 44,
}: {
  name: string;
  url?: string;
  status?: "online" | "offline" | "typing";
  size?: number;
}) {
  return (
    <div style={{ position: "relative", flex: "0 0 auto" }}>
      {url ? (
        <img
          src={url}
          alt=""
          width={size}
          height={size}
          style={{
            display: "block",
            width: size,
            height: size,
            borderRadius: "50%",
            objectFit: "cover",
            border: `1px solid ${NEX.borderMuted}`,
          }}
          loading="lazy"
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: `linear-gradient(180deg, ${NEX.orange} 0%, rgba(249,115,22,0.7) 100%)`,
            color: "#0a0a0a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(size * 0.35),
            fontWeight: 700,
            letterSpacing: 0.2,
            border: `1px solid ${NEX.borderMuted}`,
          }}
          aria-hidden
        >
          {nameInitials(name)}
        </div>
      )}
      {status && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background:
              status === "online" ? "#22c55e" :
              status === "typing" ? "#f59e0b" :
              "#525252",
            border: `2px solid ${NEX.bgSurfaceHi}`,
          }}
        />
      )}
    </div>
  );
}

export function GroupAvatar({
  url,
  memberCount,
}: {
  url?: string;
  memberCount: number;
}) {
  const size = 44;
  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        style={{
          display: "block",
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: `1px solid ${NEX.borderMuted}`,
          flex: "0 0 auto",
        }}
        loading="lazy"
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
        border: `1px solid ${NEX.borderMuted}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: NEX.orange,
        fontSize: 16,
        fontWeight: 700,
        flex: "0 0 auto",
      }}
      aria-hidden
      title={`${memberCount} members`}
    >
      {memberCount}
    </div>
  );
}
