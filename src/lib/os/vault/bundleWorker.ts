// OS — Vault bundle worker.
//
// Reads os_project_bundle_exports with status='queued', assembles the
// project record via os_project_record_summary(), collects signed
// URLs for every referenced document + video, uploads a JSON manifest
// and an HTML index to Supabase Storage, and marks the row 'ready'
// with a signed download URL.
//
// v1 ships a MANIFEST bundle (JSON + HTML index) rather than a true
// ZIP archive. Reason: producing valid ZIP output requires an npm
// dependency (archiver / jszip / yazl) and we are not silently
// adding deps. A manifest bundle is functional TODAY — Sarah opens
// the HTML index and downloads each attachment via signed link.
// Upgrading to a proper ZIP is one turn once `archiver` is approved.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUNDLE_BUCKET = "product-images"; // reuse the existing bucket
const BUNDLE_PATH_PREFIX = "vault-bundles";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

type BundleRow = {
  id: string;
  project_id: string | null;
  property_id: string | null;
  exported_by_party_id: string;
  export_type: string;
  status: string;
};

type ProjectRecord = {
  project?: { id: string; title: string; status: string; property_id: string };
  property?: {
    address_lines?: string[];
    city?: string;
    postcode?: string;
  };
  participants?: Array<Record<string, unknown>>;
  quotes?: Array<{
    quote: {
      id: string;
      quote_number: string;
      summary: string;
      total_pence: number;
      state: string;
      drafted_at: string;
    };
    line_items?: Array<Record<string, unknown>>;
  }>;
  milestones?: Array<Record<string, unknown>>;
  signoffs?: Array<Record<string, unknown>>;
  payments?: Array<{
    id: string;
    amount_pence: number;
    payment_method: string;
    status: string;
    paid_at: string;
  }>;
  reviews?: Array<Record<string, unknown>>;
  warranties?: Array<{
    id: string;
    scope: string;
    expires_at: string;
    status: string;
  }>;
  documents?: Array<{
    id: string;
    title: string;
    kind: string;
    file_url: string;
    created_at: string;
  }>;
  videos?: Array<{
    id: string;
    title: string;
    video_url: string;
    storage_path?: string;
    video_category: string;
    duration_seconds?: number | null;
    created_at: string;
  }>;
  disputes?: Array<Record<string, unknown>>;
  specifications?: Array<Record<string, unknown>>;
  generated_at?: string;
};

export type WorkerRunResult = {
  processed: number;
  ready: number;
  failed: number;
  bundleIds: string[];
  errors: Array<{ bundleId: string; message: string }>;
};

function extractStoragePath(
  url: string,
  bucket: string
): string | null {
  // Supabase Storage URLs look like:
  // https://<ref>.supabase.co/storage/v1/object/(public|sign)/<bucket>/<path>
  // For private, /object/authenticated/ or /object/sign/
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/");
    const bucketIdx = parts.findIndex((p) => p === bucket);
    if (bucketIdx === -1) return null;
    const path = parts.slice(bucketIdx + 1).join("/");
    return path || null;
  } catch {
    return null;
  }
}

async function signAttachment(
  fileUrl: string
): Promise<{ url: string; note?: string }> {
  const storagePath = extractStoragePath(fileUrl, BUNDLE_BUCKET);
  if (!storagePath) return { url: fileUrl, note: "external" };
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUNDLE_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return { url: fileUrl };
    return { url: data.signedUrl };
  } catch {
    return { url: fileUrl };
  }
}

function poundsFromPence(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderIndexHtml(
  record: ProjectRecord,
  attachments: Array<{ label: string; url: string; note?: string }>
): string {
  const project = record.project;
  const property = record.property;
  const totalSpent =
    record.payments?.reduce((s, p) => s + (p.amount_pence ?? 0), 0) ?? 0;
  const gen = record.generated_at
    ? new Date(record.generated_at).toLocaleString("en-GB")
    : new Date().toLocaleString("en-GB");

  const attachmentRows = attachments
    .map(
      (a) =>
        `<li><a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">${escapeHtml(a.label)}</a>${
          a.note ? ` <span style="color:#888">(${escapeHtml(a.note)})</span>` : ""
        }</li>`
    )
    .join("\n");

  const quotes = (record.quotes ?? [])
    .map(
      ({ quote }) =>
        `<tr><td>${escapeHtml(quote.quote_number)}</td><td>${escapeHtml(quote.summary)}</td><td>${poundsFromPence(quote.total_pence)}</td><td>${escapeHtml(quote.state)}</td></tr>`
    )
    .join("\n");

  const warranties = (record.warranties ?? [])
    .map(
      (w) =>
        `<tr><td>${escapeHtml(w.scope)}</td><td>${escapeHtml(w.expires_at)}</td><td>${escapeHtml(w.status)}</td></tr>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(project?.title ?? "Project record")} — Property Vault</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 780px; margin: 0 auto; padding: 24px; color: #222; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 24px 0 8px; padding-top: 12px; border-top: 1px solid #eee; }
  .meta { color: #555; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td, th { padding: 6px 8px; border-bottom: 1px solid #eee; text-align: left; }
  th { color: #666; font-weight: 600; }
  .kpi { display: flex; gap: 16px; margin: 12px 0 20px; }
  .kpi div { flex: 1; padding: 12px; background: #fafafa; border-radius: 8px; }
  .kpi .n { font-size: 18px; font-weight: 700; }
  .kpi .l { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: .04em; }
  a { color: #a35a00; }
  ul { padding-left: 20px; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; color: #888; }
</style>
</head>
<body>
<h1>${escapeHtml(project?.title ?? "Project record")}</h1>
<div class="meta">${escapeHtml(property?.address_lines?.[0] ?? "")}${property?.city ? ` · ${escapeHtml(property.city)}` : ""} · Status: ${escapeHtml(project?.status ?? "")}</div>
<div class="kpi">
  <div><div class="n">${poundsFromPence(totalSpent)}</div><div class="l">Total spent</div></div>
  <div><div class="n">${record.participants?.length ?? 0}</div><div class="l">Participants</div></div>
  <div><div class="n">${record.warranties?.length ?? 0}</div><div class="l">Warranties</div></div>
  <div><div class="n">${record.signoffs?.length ?? 0}</div><div class="l">Signoffs</div></div>
</div>

${
  quotes
    ? `<h2>Quotes</h2><table><tr><th>#</th><th>Summary</th><th>Total</th><th>State</th></tr>${quotes}</table>`
    : ""
}

${
  warranties
    ? `<h2>Warranties</h2><table><tr><th>Scope</th><th>Expires</th><th>Status</th></tr>${warranties}</table>`
    : ""
}

<h2>Attachments</h2>
${
  attachments.length
    ? `<ul>${attachmentRows}</ul>`
    : `<p style="color:#666;font-size:13px;">No attachments in this bundle.</p>`
}

<div class="footer">Generated ${escapeHtml(gen)} · Property Vault · XRatedTrade<br>
Attachment links are signed and valid for 30 days.</div>
</body>
</html>`;
}

async function processOneBundle(row: BundleRow): Promise<void> {
  // Move to 'generating'
  await supabaseAdmin
    .from("os_project_bundle_exports")
    .update({ status: "generating" })
    .eq("id", row.id)
    .eq("status", "queued");

  const projectId = row.project_id;
  if (!projectId) {
    throw new Error("bundle has no project_id — property-scope bundles not yet supported");
  }

  const { data: record, error: rpcErr } = await supabaseAdmin.rpc(
    "os_project_record_summary",
    { p_project_id: projectId }
  );
  if (rpcErr) throw rpcErr;
  const summary = (record as ProjectRecord) ?? {};

  // Collect attachments — documents + videos
  const attachments: Array<{
    label: string;
    url: string;
    note?: string;
  }> = [];
  const includedDocs: string[] = [];
  const includedVideos: string[] = [];

  for (const d of summary.documents ?? []) {
    const signed = await signAttachment(d.file_url);
    attachments.push({
      label: `${d.kind}: ${d.title}`,
      url: signed.url,
      note: signed.note
    });
    includedDocs.push(d.id);
  }
  for (const v of summary.videos ?? []) {
    const signed = await signAttachment(v.video_url);
    attachments.push({
      label: `Video: ${v.title}`,
      url: signed.url,
      note: signed.note
    });
    includedVideos.push(v.id);
  }

  const manifest = {
    kind: "xrated_trade_property_vault_bundle",
    version: 1,
    export_type: row.export_type,
    generated_at: new Date().toISOString(),
    record: summary,
    attachments
  };

  const uploadPathBase = `${BUNDLE_PATH_PREFIX}/${row.id}`;
  const manifestPath = `${uploadPathBase}/manifest.json`;
  const indexPath = `${uploadPathBase}/index.html`;

  const indexHtml = renderIndexHtml(summary, attachments);

  // Upload manifest
  const { error: manErr } = await supabaseAdmin.storage
    .from(BUNDLE_BUCKET)
    .upload(manifestPath, JSON.stringify(manifest, null, 2), {
      contentType: "application/json",
      upsert: true
    });
  if (manErr) throw manErr;

  // Upload HTML index
  const { error: htmlErr } = await supabaseAdmin.storage
    .from(BUNDLE_BUCKET)
    .upload(indexPath, indexHtml, {
      contentType: "text/html; charset=utf-8",
      upsert: true
    });
  if (htmlErr) throw htmlErr;

  // Sign the index URL for download
  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from(BUNDLE_BUCKET)
    .createSignedUrl(indexPath, SIGNED_URL_TTL_SECONDS);
  if (signErr || !signed?.signedUrl) {
    throw new Error(signErr?.message ?? "failed to sign bundle URL");
  }

  const bundleSizeBytes =
    Buffer.byteLength(JSON.stringify(manifest), "utf-8") +
    Buffer.byteLength(indexHtml, "utf-8");

  await supabaseAdmin
    .from("os_project_bundle_exports")
    .update({
      status: "ready",
      ready_at: new Date().toISOString(),
      expires_at: new Date(
        Date.now() + SIGNED_URL_TTL_SECONDS * 1000
      ).toISOString(),
      bundle_storage_path: indexPath,
      bundle_download_url: signed.signedUrl,
      bundle_size_bytes: bundleSizeBytes,
      bundle_file_count: attachments.length + 2, // +manifest.json +index.html
      included_document_ids: includedDocs,
      included_video_ids: includedVideos,
      content_summary_json: {
        quote_count: summary.quotes?.length ?? 0,
        warranty_count: summary.warranties?.length ?? 0,
        milestone_count: summary.milestones?.length ?? 0,
        signoff_count: summary.signoffs?.length ?? 0,
        payment_count: summary.payments?.length ?? 0,
        review_count: summary.reviews?.length ?? 0,
        document_count: includedDocs.length,
        video_count: includedVideos.length
      }
    })
    .eq("id", row.id);
}

export async function runBundleWorker(
  batchSize = 10
): Promise<WorkerRunResult> {
  const result: WorkerRunResult = {
    processed: 0,
    ready: 0,
    failed: 0,
    bundleIds: [],
    errors: []
  };

  const { data: queued, error: qErr } = await supabaseAdmin
    .from("os_project_bundle_exports")
    .select("id, project_id, property_id, exported_by_party_id, export_type, status")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (qErr) throw qErr;
  if (!queued || queued.length === 0) return result;

  for (const row of queued as BundleRow[]) {
    result.processed += 1;
    result.bundleIds.push(row.id);
    try {
      await processOneBundle(row);
      result.ready += 1;
    } catch (e) {
      result.failed += 1;
      const message =
        e instanceof Error ? e.message : "unknown error";
      result.errors.push({ bundleId: row.id, message });
      await supabaseAdmin
        .from("os_project_bundle_exports")
        .update({ status: "failed", failure_reason: message })
        .eq("id", row.id);
    }
  }

  return result;
}
