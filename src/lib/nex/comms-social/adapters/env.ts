// NEX Comms Centre · Social · adapter env-var loader.
//
// Per-provider env-var configuration. Each provider adapter reads its
// creds through the getter below · missing creds cause the registry to
// SKIP that provider (rather than throw at import time) so the app
// boots even without every credential set. When the provider is not
// registered, the Phase 3 platform validator returns `fail_closed`.
//
// Convention: `<PROVIDER>_APP_ID` · `<PROVIDER>_APP_SECRET` ·
// `<PROVIDER>_REDIRECT_URI`. Additional per-provider vars documented
// inline.

export interface ProviderCreds {
  app_id:       string;
  app_secret:   string;
  redirect_uri: string;
  extra:        Record<string, string>;
}

function getEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : undefined;
}

export function loadCreds(
  provider: "meta" | "instagram" | "linkedin" | "tiktok" | "google_business",
  extraKeys: readonly string[] = [],
): ProviderCreds | null {
  const P = provider.toUpperCase().replace("_", "");
  const app_id       = getEnv(`${P}_APP_ID`);
  const app_secret   = getEnv(`${P}_APP_SECRET`);
  const redirect_uri = getEnv(`${P}_REDIRECT_URI`);
  if (!app_id || !app_secret || !redirect_uri) return null;
  const extra: Record<string, string> = {};
  for (const k of extraKeys) {
    const v = getEnv(`${P}_${k.toUpperCase()}`);
    if (v) extra[k] = v;
  }
  return { app_id, app_secret, redirect_uri, extra };
}
