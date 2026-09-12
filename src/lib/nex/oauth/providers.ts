// src/lib/nex/oauth/providers.ts
//
// Founder Phase 24 · P24-1 · OAuth provider registry.
//
// One provider currently: Google.
// Other providers (GitHub, Microsoft, Facebook) can be added later as
// pure config records — the flow (start/callback) is provider-agnostic.
//
// Discipline: `isConfigured()` returns true only when BOTH client_id
// and client_secret are non-empty · endpoints degrade honestly with
// oauth_not_configured when either is missing (mirror of image-gen +
// voice honest-fallback pattern).

export interface OAuthProvider {
  id: string;                      // slug used in URLs: "google" | "github" | ...
  display_name: string;
  authorize_url: string;
  token_url: string;
  userinfo_url: string;
  scopes: string[];
  client_id: string;               // from env
  client_secret: string;           // from env
}

function readGoogle(): OAuthProvider {
  return {
    id: "google",
    display_name: "Google",
    authorize_url: "https://accounts.google.com/o/oauth2/v2/auth",
    token_url: "https://oauth2.googleapis.com/token",
    userinfo_url: "https://openidconnect.googleapis.com/v1/userinfo",
    scopes: ["openid", "email", "profile"],
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
  };
}

const _registry: Record<string, () => OAuthProvider> = {
  google: readGoogle,
};

export function getProvider(id: string): OAuthProvider | null {
  const factory = _registry[id];
  if (!factory) return null;
  return factory();
}

export function isConfigured(p: OAuthProvider | null): boolean {
  return !!p && p.client_id.length > 0 && p.client_secret.length > 0;
}

export function listProviders(): Array<{ id: string; display_name: string; configured: boolean }> {
  return Object.keys(_registry).map((id) => {
    const p = _registry[id]();
    return { id, display_name: p.display_name, configured: isConfigured(p) };
  });
}
