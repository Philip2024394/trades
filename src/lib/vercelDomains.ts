// Vercel Domains API — server-only thin wrapper.
//
// Custom Domain add-on uses Vercel's per-project domain API to attach
// the tradesperson's apex + www, get back the DNS challenge records,
// poll for verification, and detach on Disconnect.
//
// Why no Vercel SDK: the four endpoints we need are plain fetch() calls
// — pulling in the SDK costs us a 200 KB runtime dependency for less
// than 100 lines of code. We hand-roll a small exponential-backoff
// retry wrapper because Vercel's API occasionally returns 5xx during
// SSL issuance + verification storms.
//
// Env vars (set in Vercel project env, NOT in client bundle):
//   VERCEL_API_TOKEN  — personal access token with project:write scope.
//   VERCEL_PROJECT_ID — opaque "prj_..." id of the Xrated Trades project.
//
// If either is missing we throw `MissingVercelConfigError` at call
// site. The API routes that surface this to the customer catch it and
// return a clear "Custom Domain requires VERCEL_API_TOKEN in env" so
// the dashboard can render a graceful "this feature isn't wired yet"
// state instead of a 500.

import "server-only";

const VERCEL_API_BASE = "https://api.vercel.com";

export class MissingVercelConfigError extends Error {
  constructor() {
    super(
      "Custom Domain requires VERCEL_API_TOKEN and VERCEL_PROJECT_ID env vars."
    );
    this.name = "MissingVercelConfigError";
  }
}

function getConfig(): { token: string; projectId: string } {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) throw new MissingVercelConfigError();
  return { token, projectId };
}

export type VercelDomainVerification = {
  type: string;
  domain: string;
  value: string;
  reason: string;
};

export type AttachResult = {
  name: string;
  apexName: string;
  verified: boolean;
  verification: VercelDomainVerification[];
  id?: string;
  error?: string;
};

export type VerifyResult = {
  verified: boolean;
  verification?: VercelDomainVerification[];
  error?: string;
};

export type StatusResult = {
  verified: boolean;
  misconfigured?: boolean;
  error?: string;
};

// Vercel API request with exponential backoff. 6 attempts:
//   1s, 2s, 4s, 8s, 16s, 30s (capped). Retries on 5xx or network
//   error; surfaces 4xx straight through (those are caller bugs).
async function vercelFetch(
  path: string,
  init: RequestInit & { method?: string }
): Promise<Response> {
  const { token } = getConfig();
  const delays = [1000, 2000, 4000, 8000, 16000, 30000];
  let lastErr: unknown = null;
  for (let i = 0; i <= delays.length; i++) {
    try {
      const res = await fetch(`${VERCEL_API_BASE}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {})
        }
      });
      // Retry on 5xx; pass 4xx + 2xx straight back.
      if (res.status >= 500 && res.status < 600 && i < delays.length) {
        await new Promise((r) => setTimeout(r, delays[i]));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (i < delays.length) {
        await new Promise((r) => setTimeout(r, delays[i]));
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error("Vercel API exhausted retries");
}

/** Attach a domain to the Vercel project. Returns Vercel's response,
 *  including the DNS verification challenge the customer must add at
 *  their registrar. Idempotent on Vercel's side — calling twice with
 *  the same domain returns the existing record. */
export async function attachDomain(domain: string): Promise<AttachResult> {
  const { projectId } = getConfig();
  const res = await vercelFetch(`/v10/projects/${projectId}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: domain })
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const errBlock = json.error as Record<string, unknown> | undefined;
    return {
      name: domain,
      apexName: domain,
      verified: false,
      verification: [],
      error:
        (errBlock?.message as string) ??
        (json.message as string) ??
        `Vercel ${res.status}`
    };
  }
  return {
    name: (json.name as string) ?? domain,
    apexName: (json.apexName as string) ?? domain,
    verified: json.verified === true,
    verification: Array.isArray(json.verification)
      ? (json.verification as VercelDomainVerification[])
      : [],
    id: typeof json.id === "string" ? (json.id as string) : undefined
  };
}

/** Ask Vercel to re-check the domain's DNS challenge. Returns the new
 *  verification status. If verification has already succeeded once,
 *  this is a no-op that returns verified=true. */
export async function verifyDomain(domain: string): Promise<VerifyResult> {
  const { projectId } = getConfig();
  const res = await vercelFetch(
    `/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}/verify`,
    { method: "POST" }
  );
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const errBlock = json.error as Record<string, unknown> | undefined;
    return {
      verified: false,
      error:
        (errBlock?.message as string) ??
        (json.message as string) ??
        `Vercel ${res.status}`
    };
  }
  return {
    verified: json.verified === true,
    verification: Array.isArray(json.verification)
      ? (json.verification as VercelDomainVerification[])
      : undefined
  };
}

/** Fetch current status. Used by the cron health-check + the editor's
 *  status poll. `misconfigured` flips true when Vercel detects DNS has
 *  drifted (customer changed their A record after going live). */
export async function getDomainStatus(domain: string): Promise<StatusResult> {
  const { projectId } = getConfig();
  const res = await vercelFetch(
    `/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}`,
    { method: "GET" }
  );
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const errBlock = json.error as Record<string, unknown> | undefined;
    return {
      verified: false,
      error:
        (errBlock?.message as string) ??
        (json.message as string) ??
        `Vercel ${res.status}`
    };
  }
  return {
    verified: json.verified === true,
    misconfigured: json.misconfigured === true
  };
}

/** Remove the domain from the Vercel project. Idempotent — 404 is
 *  treated as success because the post-condition (domain not on this
 *  project) is satisfied either way. */
export async function detachDomain(domain: string): Promise<void> {
  const { projectId } = getConfig();
  const res = await vercelFetch(
    `/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}`,
    { method: "DELETE" }
  );
  if (!res.ok && res.status !== 404) {
    const json = (await res.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    const errBlock = json?.error as Record<string, unknown> | undefined;
    throw new Error(
      (errBlock?.message as string) ??
        (json?.message as string) ??
        `Vercel ${res.status}`
    );
  }
}

/** Best-effort: is Vercel actually wired? Lets callers degrade
 *  gracefully without try/catching every entrypoint. */
export function isVercelConfigured(): boolean {
  return Boolean(
    process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID
  );
}

/** Vercel's published apex A-record IP. Public, documented. Hard-coded
 *  so the dashboard can show it before we've ever called the API. */
export const VERCEL_APEX_A_RECORD = "76.76.21.21";
export const VERCEL_WWW_CNAME = "cname.vercel-dns.com";
