// src/lib/nex-midtrans/config.ts · Philip 2026-08-29
//
// Runtime configuration for the Midtrans integration.
//
// All secrets live in env vars (server-only). This module reads them
// lazily and exposes: server_key, client_key, environment, base URLs.
// Never import this in a "use client" module — server key is secret.

export type MidtransEnv = "sandbox" | "production";

export interface MidtransConfig {
  env: MidtransEnv;
  server_key: string;
  client_key: string;
  snap_api_base: string;   // for creating transactions
  status_api_base: string; // for reconciliation queries
  snap_js_src: string;     // for client-side snap.js loader
  configured: boolean;     // false if server_key is missing
}

export function readMidtransConfig(): MidtransConfig {
  const rawEnv = (process.env.NEX_MIDTRANS_ENV ?? "sandbox").toLowerCase();
  const env: MidtransEnv = rawEnv === "production" ? "production" : "sandbox";
  const server_key = process.env.NEX_MIDTRANS_SERVER_KEY ?? "";
  const client_key = process.env.NEX_MIDTRANS_CLIENT_KEY ?? "";

  const isProd = env === "production";
  return {
    env,
    server_key,
    client_key,
    snap_api_base:   isProd ? "https://app.midtrans.com"            : "https://app.sandbox.midtrans.com",
    status_api_base: isProd ? "https://api.midtrans.com/v2"         : "https://api.sandbox.midtrans.com/v2",
    snap_js_src:     isProd ? "https://app.midtrans.com/snap/snap.js"
                            : "https://app.sandbox.midtrans.com/snap/snap.js",
    configured: server_key.length > 0,
  };
}

/**
 * Basic Auth header value for Midtrans server-to-server calls.
 * Format: Basic base64(server_key + ":")
 */
export function midtransBasicAuth(server_key: string): string {
  return "Basic " + Buffer.from(server_key + ":").toString("base64");
}

/** Approved top-up tiers (mirrors DB CHECK constraint in migration 140). */
export const APPROVED_TOPUP_TIERS = [20000, 50000, 100000, 250000, 500000] as const;
export type ApprovedTopupTier = typeof APPROVED_TOPUP_TIERS[number];
export function isApprovedTier(n: number): n is ApprovedTopupTier {
  return (APPROVED_TOPUP_TIERS as readonly number[]).includes(n);
}

/** Snap transaction expiry · matches the design report (30 minutes). */
export const SNAP_EXPIRY_MINUTES = 30;
