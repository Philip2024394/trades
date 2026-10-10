// §36-W-1 · WAVE-W1 · 2026-09-14 · workstation-live
//
// Real preview-status endpoint. Attempts an actual HTTP GET against the
// caller-supplied preview URL (default: same-origin). Returns the true
// reachability state · never fabricates "READY".

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PreviewStatusResponse {
  readonly target_url: string;
  readonly reachable: boolean;
  readonly http_status: number | null;
  readonly content_length: number | null;
  readonly probed_at: string;
  readonly duration_ms: number;
  readonly reason: string | null;
}

export async function GET(req: Request): Promise<NextResponse<PreviewStatusResponse>> {
  const url = new URL(req.url);
  const rawTarget = url.searchParams.get("target") ?? "";

  // Deterministically validate: must be absolute http(s) URL OR relative starting with "/"
  let target: string;
  if (rawTarget.length === 0) {
    target = new URL("/", url).toString();
  } else if (rawTarget.startsWith("/")) {
    target = new URL(rawTarget, url).toString();
  } else {
    try {
      const parsed = new URL(rawTarget);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return NextResponse.json({
          target_url: rawTarget,
          reachable: false,
          http_status: null,
          content_length: null,
          probed_at: new Date().toISOString(),
          duration_ms: 0,
          reason: "unsupported_protocol",
        }, { headers: { "Cache-Control": "no-store" } });
      }
      target = parsed.toString();
    } catch {
      return NextResponse.json({
        target_url: rawTarget,
        reachable: false,
        http_status: null,
        content_length: null,
        probed_at: new Date().toISOString(),
        duration_ms: 0,
        reason: "invalid_url",
      }, { headers: { "Cache-Control": "no-store" } });
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  const start = Date.now();
  try {
    const resp = await fetch(target, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeoutId);
    const duration = Date.now() - start;
    // Do not download the full body; just read Content-Length header if present.
    const clen = resp.headers.get("content-length");
    return NextResponse.json({
      target_url: target,
      reachable: resp.status >= 200 && resp.status < 500,
      http_status: resp.status,
      content_length: clen ? Number.parseInt(clen, 10) : null,
      probed_at: new Date().toISOString(),
      duration_ms: duration,
      reason: resp.status >= 500 ? `http_${resp.status}` : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    clearTimeout(timeoutId);
    const duration = Date.now() - start;
    const reason = (e as Error & { name?: string }).name === "AbortError"
      ? "timeout"
      : `fetch_error:${(e as Error).message.slice(0, 80)}`;
    return NextResponse.json({
      target_url: target,
      reachable: false,
      http_status: null,
      content_length: null,
      probed_at: new Date().toISOString(),
      duration_ms: duration,
      reason,
    }, { headers: { "Cache-Control": "no-store" } });
  }
}
