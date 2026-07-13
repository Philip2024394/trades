// Create the network-uploads storage bucket via Supabase Storage API.
// Uses the service role key from .env.local since that's the credential
// with write access to storage.
import { readFileSync, existsSync } from "node:fs";

function loadEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const raw of readFileSync(file, "utf-8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [k, ...rest] = line.split("=");
    out[k.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const localEnv = loadEnv(".env.local");
const toolsEnv = loadEnv(".env.tools.local");

const supabaseUrl = localEnv.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = localEnv.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = toolsEnv.SUPABASE_PROJECT_REF;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

async function ensureBucket(name, opts) {
  // Check if already exists
  const listRes = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey
    }
  });
  const buckets = await listRes.json();
  if (Array.isArray(buckets)) {
    const existing = buckets.find((b) => b.id === name || b.name === name);
    if (existing) {
      console.log(`✓ bucket "${name}" already exists (public=${existing.public})`);
      return { existed: true, bucket: existing };
    }
  }

  // Create it
  const createRes = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      id: name,
      name,
      public: opts.public,
      file_size_limit: opts.fileSizeLimit,
      allowed_mime_types: opts.allowedMimeTypes
    })
  });
  const body = await createRes.text();
  if (!createRes.ok) {
    console.error(`✗ create failed: status=${createRes.status} ${body}`);
    process.exit(1);
  }
  console.log(`✓ created bucket "${name}"`);
  console.log(`  ${body}`);
}

await ensureBucket("network-uploads", {
  public: true,
  fileSizeLimit: 50 * 1024 * 1024,  // 50MB — matches Pro-tier video cap
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime"
  ]
});

// Verify by listing again
const verifyRes = await fetch(`${supabaseUrl}/storage/v1/bucket/network-uploads`, {
  headers: {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey
  }
});
const verify = await verifyRes.json();
console.log("");
console.log(`── verify network-uploads`);
console.log(`  public: ${verify.public}`);
console.log(`  file_size_limit: ${verify.file_size_limit} bytes (${(verify.file_size_limit/1024/1024).toFixed(0)}MB)`);
console.log(`  allowed_mime_types: ${JSON.stringify(verify.allowed_mime_types)}`);
console.log(`  project_ref: ${projectRef}`);
