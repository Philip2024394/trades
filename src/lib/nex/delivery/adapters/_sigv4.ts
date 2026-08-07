// NEX Delivery · minimal AWS Signature v4 signer for SES REST calls.
//
// Used by src/lib/nex/delivery/adapters/ses.ts. No external deps —
// pure Node crypto. Only signs POSTs to `email.{region}.amazonaws.com`
// (SES v2 SendEmail).

import { createHash, createHmac } from "crypto";

export type SigV4Options = {
  method: "POST";
  host: string;
  path: string;                                     // e.g. "/v2/email/outbound-emails"
  region: string;                                    // e.g. "eu-west-1"
  service: string;                                   // "ses"
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  body: string;                                      // pre-serialized JSON
};

export type SignedRequest = {
  url: string;
  headers: Record<string, string>;
  body: string;
};

function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}
function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

export function signRequest(opts: SigV4Options): SignedRequest {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");    // e.g. 20260808T171200Z
  const dateStamp = amzDate.slice(0, 8);                             // e.g. 20260808
  const payloadHash = sha256Hex(opts.body);

  const headers: Record<string, string> = {
    "host": opts.host,
    "x-amz-date": amzDate,
    "content-type": "application/json",
  };
  if (opts.sessionToken) headers["x-amz-security-token"] = opts.sessionToken;

  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map((k) => `${k}:${headers[k].trim()}\n`).join("");
  const canonicalRequest = [
    opts.method,
    opts.path,
    "",                                                              // empty query
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${opts.region}/${opts.service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");

  const kDate    = hmac("AWS4" + opts.secretAccessKey, dateStamp);
  const kRegion  = hmac(kDate, opts.region);
  const kService = hmac(kRegion, opts.service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  headers.authorization =
    `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { url: `https://${opts.host}${opts.path}`, headers, body: opts.body };
}
