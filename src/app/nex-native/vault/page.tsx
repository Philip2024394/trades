// src/app/nex-native/vault/page.tsx
//
// NEX Vault · entry surface · UI foundation only.
//
// This route exists to render the user-facing Vault PIN entry screen in
// isolation. There is no Vault cryptography wired up here, no server
// action, no database, no HSM, no key derivation, no auth boundary beyond
// a mock. Phase A has not started.
//
// Governed by:
//   · vault-research.md §10.0 — user-facing simplicity principle
//     ("Enter your 6-digit Vault PIN" is the entire user-facing surface)
//   · vault-security-architecture-research.md §14 — Phase A not authorised.

import { PinEntryClient } from "./_pin-entry-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ mock?: string }>;
}

const NEX = {
  bg: "#020914",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
};

export default async function VaultPinEntryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const mockReason = params.mock === "unavailable" ? "unavailable" : "incorrect";

  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        id="main"
        data-nex-vault-root
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "16px 20px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            background:
              "radial-gradient(60% 40% at 50% 10%, rgba(0,175,255,0.08), transparent 70%)",
            pointerEvents: "none",
          }}
        />

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
              color: NEX.cyan,
            }}
          >
            NEX Vault
          </p>

          <h1
            data-nex-vault-headline
            style={{
              margin: "18px 0 0",
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "0.005em",
              lineHeight: 1.3,
              color: NEX.textPrimary,
            }}
          >
            Enter your 6-digit Vault PIN
          </h1>

          <div style={{ marginTop: 36 }}>
            <PinEntryClient mockReason={mockReason} />
          </div>
        </div>
      </main>
    </>
  );
}
