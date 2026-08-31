// src/app/nex-provider-wallet/page.tsx · Philip 2026-08-29
//
// DEPRECATED · compatibility redirect shim · one-release migration window.
// The wallet lives inside /nexapp now, opened via rail Wallet → Balance.
// Deep-link support: /nexapp?ws=wallet-balance opens the workspace directly.
//
// Remove this file after the migration window closes.

import { permanentRedirect } from "next/navigation";

export default function ProviderWalletRedirect(): never {
  permanentRedirect("/nexapp?ws=wallet-balance");
}
