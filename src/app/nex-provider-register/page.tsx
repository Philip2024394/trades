// src/app/nex-provider-register/page.tsx · Philip 2026-08-29
//
// DEPRECATED · compatibility redirect shim · one-release migration window.
// Provider registration lives inside /nexapp now, opened via rail
// Me → My roles → Become a provider.
// Deep-link support: /nexapp?ws=me-my-roles
//
// Remove this file after the migration window closes.

import { permanentRedirect } from "next/navigation";

export default function ProviderRegisterRedirect(): never {
  permanentRedirect("/nexapp?ws=me-my-roles");
}
