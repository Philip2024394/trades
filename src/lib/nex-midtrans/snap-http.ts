// src/lib/nex-midtrans/snap-http.ts · Philip 2026-08-29
//
// Production SnapCreateFn implementation · calls the real Midtrans /snap/v1/
// transactions endpoint. Route handlers pass this to initiateTopup(); tests
// pass a mock so no network call happens.

import type { SnapCreateFn, SnapCreateRequest, SnapCreateResponse } from "./initiate-topup";
import { readMidtransConfig, midtransBasicAuth } from "./config";

export function makeSnapCreateHttp(): SnapCreateFn {
  return async (req: SnapCreateRequest): Promise<SnapCreateResponse> => {
    const cfg = readMidtransConfig();
    if (!cfg.configured) {
      throw new Error("NEX_MIDTRANS_SERVER_KEY not set · Midtrans is not configured");
    }
    const url = `${cfg.snap_api_base}/snap/v1/transactions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: midtransBasicAuth(cfg.server_key),
      },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`midtrans snap create ${res.status}: ${text.slice(0, 400)}`);
    }
    const data = (await res.json()) as SnapCreateResponse;
    if (!data.token || !data.redirect_url) {
      throw new Error(`midtrans snap create returned malformed body: ${JSON.stringify(data).slice(0, 200)}`);
    }
    return data;
  };
}
