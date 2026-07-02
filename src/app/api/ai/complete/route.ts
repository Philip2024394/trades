// AI complete — the single endpoint every Studio AI feature calls.
//
// Provider-agnostic. Modules 0-13 ship with zero providers registered,
// so today every request returns 501 + a structured "no-provider"
// error the caller can render. Module 14 registers the first adapters
// and this endpoint activates automatically — every existing caller
// starts working with zero changes.

import { NextResponse } from "next/server";
import { aiGateway } from "@/lib/studio/aiGateway";
// Side-effect import populates the gateway with every registered
// provider adapter. Module 14 ships the Anthropic Claude adapter here.
import "@/lib/studio/aiProviders";
import type { AiCompleteRequest, AiCompleteResponse } from "@/lib/studio/aiTypes";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: AiCompleteRequest | null = null;
  try {
    body = (await req.json()) as AiCompleteRequest;
  } catch {
    const err: AiCompleteResponse = {
      ok: false,
      error: {
        code: "invalid-request",
        message: "Request body was not valid JSON.",
        retryable: false
      }
    };
    return NextResponse.json(err, { status: 400 });
  }

  if (!body?.task || typeof body.task !== "string") {
    const err: AiCompleteResponse = {
      ok: false,
      error: {
        code: "invalid-request",
        message: "Missing required `task` field.",
        retryable: false
      }
    };
    return NextResponse.json(err, { status: 400 });
  }

  const response = await aiGateway.complete(body);

  const status: number = response.ok
    ? 200
    : response.error.code === "no-provider" ||
        response.error.code === "not-implemented"
      ? 501
      : response.error.retryable
        ? 502
        : 400;

  return NextResponse.json(response, { status });
}
