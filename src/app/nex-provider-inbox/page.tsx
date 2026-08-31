// src/app/nex-provider-inbox/page.tsx · Philip 2026-08-29
//
// DEPRECATED · compatibility redirect shim · one-release migration window.
// The provider inbox lives inside /nexapp now, opened via rail
// Activity → Incoming requests (visible when provider role is active).
// Deep-link support: /nexapp?ws=activity-incoming-requests&roles=provider
//
// Remove this file after the migration window closes.

import { permanentRedirect } from "next/navigation";

export default function ProviderInboxRedirect(): never {
  permanentRedirect("/nexapp?ws=activity-incoming-requests&roles=provider");
}
