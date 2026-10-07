// src/app/nex-native/vault/_doorway-shell.tsx
//
// NEX Vault · doorway shell.
// Shared outer layout for every theme's Vault doorway page.
// Governed by:
//   · vault-research.md §10.0 — one-line prompt simplicity principle
//   · vault-research.md §10.0.1 — each theme has its own doorway page
//
// Theme-specific `page.tsx` imports this and hands over a Skin.
// This file is UI-only · no auth, no crypto, no network, no storage.

import { PinEntryClient } from "./_pin-entry-client";
import type { VaultDoorwaySkin } from "./_doorway-skin";

interface DoorwayShellProps {
  skin: VaultDoorwaySkin;
  deviceId: string;
}

export function DoorwayShell({ skin, deviceId }: DoorwayShellProps) {
  const bgLayers: string[] = [];
  if (skin.bg.radialOverlay) bgLayers.push(skin.bg.radialOverlay);
  if (skin.bg.imageUrl) {
    bgLayers.push(`url(${JSON.stringify(skin.bg.imageUrl)}) center/cover no-repeat`);
  }
  bgLayers.push(skin.bg.base);

  const imageOpacity = skin.bg.imageOpacity ?? 1;
  const imageBlend = skin.bg.imageBlend ?? "normal";

  return (
    <>
      <style>{`html, body { background: ${skin.bg.base} !important; }`}</style>
      <main
        id="main"
        data-nex-vault-root
        data-nex-vault-theme={skin.slug}
        style={{
          minHeight: "100dvh",
          background: skin.bg.base,
          color: skin.text.primary,
          fontFamily: skin.font,
          padding:
            skin.contentAnchor === "bottom"
              ? "16px 20px 10vh"
              : "16px 20px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent:
            skin.contentAnchor === "bottom" ? "flex-end" : "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {skin.bg.imageUrl && (
          <div
            aria-hidden
            data-nex-vault-bg-image
            style={{
              position: "fixed",
              inset: 0,
              background: `url(${JSON.stringify(skin.bg.imageUrl)}) center/cover no-repeat`,
              opacity: imageOpacity,
              mixBlendMode: imageBlend,
              pointerEvents: "none",
            }}
          />
        )}

        {skin.bg.radialOverlay && (
          <div
            aria-hidden
            style={{
              position: "fixed",
              inset: 0,
              background: skin.bg.radialOverlay,
              pointerEvents: "none",
            }}
          />
        )}

        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 360,
            textAlign: "center",
          }}
        >
          <p
            data-nex-vault-brand
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: skin.text.brandChip,
            }}
          >
            {skin.label}
          </p>

          <h1
            data-nex-vault-headline
            style={{
              margin: "18px 0 0",
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "0.005em",
              lineHeight: 1.3,
              color: skin.text.primary,
            }}
          >
            Unlock your Vault
          </h1>

          <div style={{ marginTop: 36 }}>
            <PinEntryClient skin={skin} deviceId={deviceId} />
          </div>

          <div style={{ marginTop: 16 }}>
            <a
              href="/nex-native/vault/recover"
              data-nex-vault-use-recovery
              style={{
                display: "inline-block",
                color: skin.text.secondary,
                fontSize: 13,
                textDecoration: "underline",
                opacity: 0.85,
              }}
            >
              Forgot your PIN? Use recovery passphrase.
            </a>
          </div>

          <div style={{ marginTop: 10 }}>
            <a
              href="/nex-native/home"
              data-nex-vault-sign-out
              style={{
                display: "inline-block",
                color: skin.text.secondary,
                fontSize: 13,
                textDecoration: "underline",
                opacity: 0.7,
              }}
            >
              Sign out of Vault · return to NEX
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
