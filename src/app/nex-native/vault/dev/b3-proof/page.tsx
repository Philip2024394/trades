// src/app/nex-native/vault/dev/b3-proof/page.tsx
//
// Vault Phase B · Commit B.3 · dev-only browser-proof harness.
//
// This is the MINIMAL integration surface authorised by the B.3 brief
// ("Only provide the minimum integration surface needed for the B.3
// browser proof"). It mounts the client conversation-key module so
// Playwright can drive it from the browser context via window hooks.
//
// NOT a real UI · do NOT link to it from anywhere · do NOT reuse it
// for B.4. B.4 lands the actual Vault chat surface.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { B3ProofClient } from "./_proof-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultB3ProofPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/dev/b3-proof");
  }
  return (
    <main
      style={{
        padding: 24,
        fontFamily: "monospace",
        color: "#F7EFE4",
        background: "#06040a",
        minHeight: "100dvh",
      }}
    >
      <h1 style={{ fontSize: 14, margin: 0, letterSpacing: "0.2em" }}>
        VAULT PHASE B.3 · PROOF HARNESS (dev-only)
      </h1>
      <p style={{ fontSize: 11, color: "#9b8b7a", marginTop: 8 }}>
        This page exposes the client conversation-key module to
        <code> window.__nexB3</code> for Playwright. It is not a Vault
        UI · see <code>/nex-native/vault/home</code> for the real
        surface.
      </p>
      <B3ProofClient />
    </main>
  );
}
