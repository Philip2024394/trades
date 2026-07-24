// Business Brain sync engine — runs one crawl-and-extract cycle for
// a business, diffs against stored pages by content_hash, writes new
// or changed rows to Supabase, records a sync_job with counters.
//
// This is the orchestrator that binds crawler + extractors + Supabase
// together. It is deliberately transactional-per-page rather than
// per-batch so one bad page can't destroy the whole sync run.

import "server-only";
import { createHash } from "node:crypto";
import { crawlSite, type CrawledPage, type CrawlResult } from "./_crawler";
import {
  categorisePage,
  extractProduct,
  extractService,
  extractFaqs,
  slugify
} from "./_extractors";
import type {
  BusinessBrain,
  BrainSyncJob,
  SyncJobStatus,
  BrainPage,
  BrainProduct,
  BrainService,
  BrainFaq
} from "./_types";

// ─── Supabase client — server-side, service-role for RLS-bypass writes
//
// We deliberately use the service-role client here rather than the
// authed client because the sync job runs from a cron / admin endpoint,
// not from an owner-authenticated request. All Brain rows carry a
// business_id so RLS on the read side stays in charge of who sees what.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function serviceClient(): SupabaseClient {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("supabase_service_role_env_missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Public entry ─────────────────────────────────────────────────

export type SyncOptions = {
  brainId:     string;
  triggeredBy: "cron" | "manual" | "install" | "webhook";
  maxPages?:   number;
};

export type SyncResult = {
  ok:            boolean;
  syncJobId:     string;
  pagesCrawled:  number;
  pagesAdded:    number;
  pagesChanged:  number;
  pagesUnchanged: number;
  productsFound: number;
  servicesFound: number;
  faqsFound:     number;
  errors:        Array<{ url: string; error: string }>;
  duration_ms:   number;
};

export async function runBrainSync(opts: SyncOptions): Promise<SyncResult> {
  const supabase = serviceClient();
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();

  // ─── Load the target brain + business ───────────────────────────
  const brain = await loadBrain(supabase, opts.brainId);
  if (!brain) throw new Error("brain_not_found");
  const business = await loadBusiness(supabase, brain.business_id);
  if (!business) throw new Error("business_not_found");

  const seedUrl = brain.crawl_root_url ?? `https://${business.primary_domain}/`;

  // Per-brain override lives in config_json.max_pages so different sites
  // can have different depth without changing code. Falls back to the
  // caller-supplied opts.maxPages, then a sensible default.
  const brainConfig = (brain.config_json ?? {}) as Record<string, unknown>;
  const configuredMax = typeof brainConfig.max_pages === "number" ? brainConfig.max_pages : null;
  const maxPages = opts.maxPages ?? configuredMax ?? 1000;

  // ─── Open a sync_job row (running) ──────────────────────────────
  const syncJobId = await openSyncJob(supabase, {
    brain_id:     brain.id,
    business_id:  business.id,
    triggered_by: opts.triggeredBy,
    started_at:   startedAt
  });

  // ─── Crawl ──────────────────────────────────────────────────────
  let crawlResult: CrawlResult;
  try {
    crawlResult = await crawlSite({
      seedUrl,
      maxPages
    });
  } catch (err) {
    await closeSyncJob(supabase, syncJobId, {
      status: "failed",
      pages_crawled: 0,
      pages_added: 0,
      pages_changed: 0,
      pages_unchanged: 0,
      products_found: 0,
      services_found: 0,
      faqs_found: 0,
      errors: [{ url: seedUrl, error: err instanceof Error ? err.message : "crawl_failed" }],
      duration_ms: Date.now() - startedMs
    });
    throw err;
  }

  // ─── Load existing page hashes for diff ─────────────────────────
  const existingHashes = await loadExistingHashes(supabase, brain.id);

  let pagesAdded = 0;
  let pagesChanged = 0;
  let pagesUnchanged = 0;
  let productsFound = 0;
  let servicesFound = 0;
  let faqsFound = 0;
  const perPageErrors: Array<{ url: string; error: string }> = [...crawlResult.errors];

  for (const page of crawlResult.pages) {
    try {
      const category = categorisePage(page);
      const priorHash = existingHashes.get(page.url);
      const changed = priorHash !== undefined && priorHash !== page.content_hash;
      const added   = priorHash === undefined;
      if (added)        pagesAdded++;
      else if (changed) pagesChanged++;
      else              pagesUnchanged++;

      // Upsert the page row
      const pageId = await upsertPage(supabase, brain, page, category);

      // Only rerun extractors on new-or-changed pages — saves compute
      if (added || changed) {
        const product = extractProduct(page, category);
        if (product) {
          await upsertProduct(supabase, brain, pageId, product);
          productsFound++;
        }
        const service = extractService(page, category);
        if (service) {
          await upsertService(supabase, brain, pageId, service);
          servicesFound++;
        }
        const faqs = extractFaqs(page);
        for (const faq of faqs) {
          await upsertFaq(supabase, brain, pageId, faq);
          faqsFound++;
        }
      }
    } catch (err) {
      perPageErrors.push({
        url:   page.url,
        error: err instanceof Error ? err.message : "extract_error"
      });
    }
  }

  // ─── Update brain's last_synced_at + next_sync_due_at ───────────
  const nextDue = computeNextSyncDue(brain.sync_frequency);
  await supabase
    .from("business_brains")
    .update({
      last_synced_at:   new Date().toISOString(),
      next_sync_due_at: nextDue,
      pages_indexed:    crawlResult.pages.length,
      status:           "active"
    })
    .eq("id", brain.id);

  // ─── Close the sync_job ─────────────────────────────────────────
  const status: SyncJobStatus = perPageErrors.length > 0 && crawlResult.pages.length === 0
    ? "failed"
    : perPageErrors.length > 0
      ? "partial"
      : "completed";

  await closeSyncJob(supabase, syncJobId, {
    status,
    pages_crawled:   crawlResult.pages.length,
    pages_added:     pagesAdded,
    pages_changed:   pagesChanged,
    pages_unchanged: pagesUnchanged,
    products_found:  productsFound,
    services_found:  servicesFound,
    faqs_found:      faqsFound,
    errors:          perPageErrors,
    duration_ms:     Date.now() - startedMs
  });

  return {
    ok:             true,
    syncJobId,
    pagesCrawled:   crawlResult.pages.length,
    pagesAdded,
    pagesChanged,
    pagesUnchanged,
    productsFound,
    servicesFound,
    faqsFound,
    errors:         perPageErrors,
    duration_ms:    Date.now() - startedMs
  };
}

// ─── Supabase helpers ─────────────────────────────────────────────

async function loadBrain(sb: SupabaseClient, id: string): Promise<BusinessBrain | null> {
  const { data, error } = await sb.from("business_brains").select("*").eq("id", id).single();
  if (error || !data) return null;
  return data as BusinessBrain;
}

async function loadBusiness(sb: SupabaseClient, id: string): Promise<{ id: string; primary_domain: string } | null> {
  const { data, error } = await sb.from("business_brain_businesses").select("id, primary_domain").eq("id", id).single();
  if (error || !data) return null;
  return data as { id: string; primary_domain: string };
}

async function loadExistingHashes(sb: SupabaseClient, brainId: string): Promise<Map<string, string>> {
  const { data, error } = await sb.from("brain_pages").select("url, content_hash").eq("brain_id", brainId);
  const map = new Map<string, string>();
  if (error || !data) return map;
  for (const row of data as Array<{ url: string; content_hash: string }>) {
    map.set(row.url, row.content_hash);
  }
  return map;
}

async function openSyncJob(sb: SupabaseClient, r: {
  brain_id:     string;
  business_id:  string;
  triggered_by: string;
  started_at:   string;
}): Promise<string> {
  const { data, error } = await sb.from("brain_sync_jobs").insert({
    brain_id:     r.brain_id,
    business_id:  r.business_id,
    triggered_by: r.triggered_by,
    status:       "running",
    started_at:   r.started_at
  }).select("id").single();
  if (error || !data) throw new Error("sync_job_open_failed");
  return (data as { id: string }).id;
}

async function closeSyncJob(sb: SupabaseClient, id: string, r: {
  status:          SyncJobStatus;
  pages_crawled:   number;
  pages_added:     number;
  pages_changed:   number;
  pages_unchanged: number;
  products_found:  number;
  services_found:  number;
  faqs_found:      number;
  errors:          Array<{ url: string; error: string }>;
  duration_ms:     number;
}): Promise<void> {
  await sb.from("brain_sync_jobs").update({
    status:          r.status,
    finished_at:     new Date().toISOString(),
    pages_crawled:   r.pages_crawled,
    pages_added:     r.pages_added,
    pages_changed:   r.pages_changed,
    pages_unchanged: r.pages_unchanged,
    products_found:  r.products_found,
    services_found:  r.services_found,
    faqs_found:      r.faqs_found,
    errors:          r.errors,
    duration_ms:     r.duration_ms
  }).eq("id", id);
}

async function upsertPage(
  sb: SupabaseClient,
  brain: BusinessBrain,
  page: CrawledPage,
  category: string
): Promise<string> {
  const row: Partial<BrainPage> & { brain_id: string; business_id: string; url: string; content_hash: string } = {
    brain_id:      brain.id,
    business_id:   brain.business_id,
    url:           page.url,
    title:         page.title,
    description:   page.description,
    category:      category as BrainPage["category"],
    raw_html:      page.raw_html,
    clean_text:    page.clean_text,
    word_count:    page.word_count,
    content_hash:  page.content_hash,
    outlinks:      page.outlinks,
    media_count:   page.media.length,
    pdf_count:     page.pdf_links.length,
    last_crawled_at: page.fetched_at,
    vector_status: "pending"
  };
  const { data, error } = await sb.from("brain_pages")
    .upsert(row, { onConflict: "brain_id,url" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`page_upsert_failed:${error?.message ?? "unknown"}`);
  return (data as { id: string }).id;
}

async function upsertProduct(
  sb: SupabaseClient,
  brain: BusinessBrain,
  pageId: string,
  product: ReturnType<typeof extractProduct> & object
): Promise<void> {
  const slug = slugify(product.name);
  const row: Partial<BrainProduct> & { brain_id: string; business_id: string; slug: string; name: string } = {
    brain_id:         brain.id,
    business_id:      brain.business_id,
    source_page_id:   pageId,
    slug,
    name:             product.name,
    category:         product.category,
    materials:        product.materials,
    options:          product.options,
    price_from_pence: product.price_from_pence,
    price_display:    product.price_display,
    lead_time_text:   product.lead_time_text,
    description:      product.description,
    detection_method: product.detection_method,
    confidence_pct:   product.confidence_pct,
    last_seen_at:     new Date().toISOString()
  };
  const { error } = await sb.from("brain_products").upsert(row, { onConflict: "brain_id,slug" });
  if (error) throw new Error(`product_upsert_failed:${error.message}`);
}

async function upsertService(
  sb: SupabaseClient,
  brain: BusinessBrain,
  pageId: string,
  service: ReturnType<typeof extractService> & object
): Promise<void> {
  const slug = slugify(service.name);
  const row: Partial<BrainService> & { brain_id: string; business_id: string; slug: string; name: string } = {
    brain_id:         brain.id,
    business_id:      brain.business_id,
    source_page_id:   pageId,
    slug,
    name:             service.name,
    description:      service.description,
    detection_method: service.detection_method,
    confidence_pct:   service.confidence_pct,
    last_seen_at:     new Date().toISOString()
  };
  const { error } = await sb.from("brain_services").upsert(row, { onConflict: "brain_id,slug" });
  if (error) throw new Error(`service_upsert_failed:${error.message}`);
}

async function upsertFaq(
  sb: SupabaseClient,
  brain: BusinessBrain,
  pageId: string,
  faq: { question: string; answer: string; detection_method: string; confidence_pct: number }
): Promise<void> {
  // Deterministic dedupe key — same question text on same brain
  // shouldn't produce a duplicate row across crawls.
  const questionHash = createHash("sha256").update(faq.question.toLowerCase().trim()).digest("hex").slice(0, 16);
  const row: Partial<BrainFaq> & { brain_id: string; business_id: string; question_hash: string; question: string; answer: string } = {
    brain_id:         brain.id,
    business_id:      brain.business_id,
    source_page_id:   pageId,
    question_hash:    questionHash,
    question:         faq.question,
    answer:           faq.answer,
    detection_method: faq.detection_method as BrainFaq["detection_method"],
    confidence_pct:   faq.confidence_pct,
    last_seen_at:     new Date().toISOString()
  };
  const { error } = await sb.from("brain_faqs").upsert(row, { onConflict: "brain_id,question_hash" });
  if (error) throw new Error(`faq_upsert_failed:${error.message}`);
}

// ─── Re-extract only (no crawl) ───────────────────────────────────
//
// Runs the extractors against every already-stored brain_pages row.
// Cheap way to apply a new extractor heuristic to existing data
// without re-hitting the source website. Idempotent — upserts on
// slug / question_hash so re-running is safe.

export type ReextractResult = {
  ok:            boolean;
  pagesScanned:  number;
  productsFound: number;
  servicesFound: number;
  faqsFound:     number;
};

export async function reextractBrain(brainId: string): Promise<ReextractResult> {
  const supabase = serviceClient();
  const brain = await loadBrain(supabase, brainId);
  if (!brain) throw new Error("brain_not_found");

  const { data: pages, error } = await supabase
    .from("brain_pages")
    .select("id, url, title, description, category, clean_text, content_hash, outlinks, raw_html, word_count, media_count, pdf_count, last_crawled_at")
    .eq("brain_id", brainId);
  if (error) throw new Error(`load_pages_failed: ${error.message}`);

  const rows = (pages ?? []) as Array<{
    id: string; url: string; title: string | null; description: string | null;
    category: string; clean_text: string; content_hash: string; outlinks: string[];
    raw_html: string; word_count: number; media_count: number; pdf_count: number;
    last_crawled_at: string;
  }>;

  let productsFound = 0, servicesFound = 0, faqsFound = 0;
  for (const p of rows) {
    // Reconstruct the CrawledPage shape the extractors expect.
    const pageForExtract: CrawledPage = {
      url:          p.url,
      status:       200,
      contentType:  "text/html",
      title:        p.title,
      description:  p.description,
      raw_html:     p.raw_html ?? "",
      clean_text:   p.clean_text,
      word_count:   p.word_count,
      content_hash: p.content_hash,
      outlinks:     p.outlinks ?? [],
      media:        [],
      pdf_links:    [],
      fetched_at:   p.last_crawled_at
    };
    const category = p.category as PageCategory;

    const product = extractProduct(pageForExtract, category);
    if (product) {
      await upsertProduct(supabase, brain, p.id, product);
      productsFound++;
    }
    const service = extractService(pageForExtract, category);
    if (service) {
      await upsertService(supabase, brain, p.id, service);
      servicesFound++;
    }
    const faqs = extractFaqs(pageForExtract);
    for (const faq of faqs) {
      await upsertFaq(supabase, brain, p.id, faq);
      faqsFound++;
    }
  }

  return { ok: true, pagesScanned: rows.length, productsFound, servicesFound, faqsFound };
}

// PageCategory type re-imported for the reextract path only.
type PageCategory = import("./_types").PageCategory;

// ─── Next-sync scheduler ──────────────────────────────────────────

function computeNextSyncDue(frequency: BusinessBrain["sync_frequency"]): string {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const offset = (() => {
    switch (frequency) {
      case "hourly":   return 60 * 60 * 1000;
      case "daily":    return dayMs;
      case "weekly":   return 7 * dayMs;
      case "monthly":  return 30 * dayMs;
      case "manual":   return 365 * dayMs;   // effectively "not scheduled"
      default:         return 7 * dayMs;
    }
  })();
  return new Date(now + offset).toISOString();
}
