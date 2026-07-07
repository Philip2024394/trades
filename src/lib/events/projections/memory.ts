// Memory projection — the first + most important handler in the
// pipeline. Every event that describes something durable in the
// business world writes to memory_records so the Archive grows over
// time.
//
// Registered for:
//   work_captured       → material_used records + optional job record
//   job_completed       → job record (natural key = job_id)
//   review_received     → linked to a job record if project_id present
//   testimonial_recorded → linked to a job record
//   staff_joined        → staff_member record
//   certification_earned → certification record
//   service_added       → service record
//   service_area_added  → service_area record

import { upsertMemoryRecord } from "@/lib/memory/loader";
import { upsertEmbeddingForRecord } from "@/lib/memory/reindex";
import type { BusinessEvent, ProjectionResult } from "../types";

/** Fire-and-forget embedding refresh after a memory record upsert.
 *  Does NOT block the projection outcome — if OPENAI_API_KEY is
 *  missing or the request fails, the record still exists and is
 *  queryable via structured facets; only NL search degrades. */
function refreshEmbedding(recordId: string) {
  upsertEmbeddingForRecord(recordId).catch(() => {});
}

export async function memoryProjection(
  event: BusinessEvent
): Promise<ProjectionResult> {
  switch (event.eventType) {
    case "job_completed":
      return await handleJobCompleted(event);
    case "work_captured":
      return await handleWorkCaptured(event);
    case "review_received":
      return await handleReviewReceived(event);
    case "testimonial_recorded":
      return await handleTestimonialRecorded(event);
    case "staff_joined":
      return await handleStaffJoined(event);
    case "certification_earned":
      return await handleCertificationEarned(event);
    case "service_added":
      return await handleServiceAdded(event);
    case "service_area_added":
      return await handleServiceAreaAdded(event);
    default:
      return {
        status: "skipped",
        reason: `no memory projection for ${event.eventType}`
      };
  }
}

/** Job completion is the highest-value memory write — it consolidates
 *  everything we know about a completed customer job into one facet
 *  bundle so future queries ("all sandstone patios in LS6") work. */
async function handleJobCompleted(
  event: BusinessEvent
): Promise<ProjectionResult> {
  const p = event.eventPayload as {
    job_id?: string;
    trade?: string;
    service?: string;
    materials?: string[];
    colours?: string[];
    techniques?: string[];
    cost_band?: string;
    customer_name?: string;
    postcode?: string;
    latitude?: number;
    longitude?: number;
    started_at?: string;
    completed_at?: string;
    photo_urls?: string[];
    photo_ids?: string[];
    story_arc_id?: string;
  };
  if (!p.job_id) {
    return {
      status: "skipped",
      reason: "job_completed requires job_id in payload"
    };
  }
  const facets = {
    job_id: p.job_id,
    trade: p.trade,
    service: p.service,
    materials: p.materials ?? [],
    colours: p.colours ?? [],
    techniques: p.techniques ?? [],
    cost_band: p.cost_band,
    customer_name: p.customer_name,
    started_at: p.started_at,
    completed_at: p.completed_at ?? event.occurredAt,
    photo_urls: p.photo_urls ?? [],
    photo_ids: p.photo_ids ?? [],
    story_arc_id: p.story_arc_id,
    ...(event.aiUnderstanding ? { ai: event.aiUnderstanding } : {})
  };
  const rec = await upsertMemoryRecord({
    merchantId: event.merchantId,
    recordType: "job",
    facets,
    postcode: p.postcode?.toUpperCase(),
    latitude: p.latitude,
    longitude: p.longitude,
    linkEventId: event.id,
    naturalKey: { field: "job_id", value: p.job_id }
  });
  if (!rec) return { status: "failed", reason: "memory upsert failed" };
  refreshEmbedding(rec.id);
  return { status: "done", targetRef: { memoryRecordId: rec.id, recordType: "job" } };
}

async function handleWorkCaptured(
  event: BusinessEvent
): Promise<ProjectionResult> {
  const p = event.eventPayload as {
    job_id?: string;
    stage?: string;
    materials?: string[];
    photo_ids?: string[];
    postcode?: string;
    trade?: string;
    service?: string;
  };
  // Only touch memory if we have a job_id to link against (otherwise
  // it's just a photo dump not tied to a durable job).
  if (!p.job_id) {
    return { status: "skipped", reason: "no job_id on work_captured" };
  }
  const facets = {
    job_id: p.job_id,
    trade: p.trade,
    service: p.service,
    materials: p.materials ?? [],
    latest_stage: p.stage,
    photo_ids: p.photo_ids ?? [],
    last_captured_at: event.occurredAt,
    ...(event.aiUnderstanding ? { ai: event.aiUnderstanding } : {})
  };
  const rec = await upsertMemoryRecord({
    merchantId: event.merchantId,
    recordType: "job",
    facets,
    postcode: p.postcode?.toUpperCase(),
    linkEventId: event.id,
    naturalKey: { field: "job_id", value: p.job_id }
  });
  if (!rec) return { status: "failed", reason: "memory upsert failed" };
  return {
    status: "done",
    targetRef: { memoryRecordId: rec.id, recordType: "job" }
  };
}

async function handleReviewReceived(
  event: BusinessEvent
): Promise<ProjectionResult> {
  const p = event.eventPayload as {
    review_id?: string;
    project_id?: string;
    job_id?: string;
    author?: string;
    rating?: number;
    excerpt?: string;
    source?: string;
  };
  const jobId = p.job_id ?? p.project_id;
  if (!jobId) {
    return {
      status: "skipped",
      reason: "no job_id / project_id linked to review — nothing to attach"
    };
  }
  const rec = await upsertMemoryRecord({
    merchantId: event.merchantId,
    recordType: "job",
    facets: {
      job_id: jobId,
      review: {
        review_id: p.review_id,
        author: p.author,
        rating: p.rating,
        excerpt: p.excerpt,
        source: p.source
      }
    },
    linkEventId: event.id,
    naturalKey: { field: "job_id", value: jobId }
  });
  if (!rec) return { status: "failed", reason: "memory upsert failed" };
  return {
    status: "done",
    targetRef: { memoryRecordId: rec.id, recordType: "job" }
  };
}

async function handleTestimonialRecorded(
  event: BusinessEvent
): Promise<ProjectionResult> {
  return await handleReviewReceived(event);
}

async function handleStaffJoined(
  event: BusinessEvent
): Promise<ProjectionResult> {
  const p = event.eventPayload as {
    staff_id?: string;
    name?: string;
    role?: string;
    started_at?: string;
    photo_url?: string;
  };
  if (!p.staff_id) {
    return { status: "skipped", reason: "staff_joined needs staff_id" };
  }
  const rec = await upsertMemoryRecord({
    merchantId: event.merchantId,
    recordType: "staff_member",
    facets: {
      staff_id: p.staff_id,
      name: p.name,
      role: p.role,
      started_at: p.started_at ?? event.occurredAt,
      photo_url: p.photo_url,
      status: "active"
    },
    linkEventId: event.id,
    naturalKey: { field: "staff_id", value: p.staff_id }
  });
  if (!rec) return { status: "failed", reason: "memory upsert failed" };
  return {
    status: "done",
    targetRef: { memoryRecordId: rec.id, recordType: "staff_member" }
  };
}

async function handleCertificationEarned(
  event: BusinessEvent
): Promise<ProjectionResult> {
  const p = event.eventPayload as {
    certification_id?: string;
    name?: string;
    issuer?: string;
    earned_at?: string;
    expires_at?: string;
    certificate_url?: string;
  };
  if (!p.certification_id) {
    return {
      status: "skipped",
      reason: "certification_earned needs certification_id"
    };
  }
  const rec = await upsertMemoryRecord({
    merchantId: event.merchantId,
    recordType: "certification",
    facets: {
      certification_id: p.certification_id,
      name: p.name,
      issuer: p.issuer,
      earned_at: p.earned_at ?? event.occurredAt,
      expires_at: p.expires_at,
      certificate_url: p.certificate_url
    },
    linkEventId: event.id,
    naturalKey: { field: "certification_id", value: p.certification_id }
  });
  if (!rec) return { status: "failed", reason: "memory upsert failed" };
  return {
    status: "done",
    targetRef: { memoryRecordId: rec.id, recordType: "certification" }
  };
}

async function handleServiceAdded(
  event: BusinessEvent
): Promise<ProjectionResult> {
  const p = event.eventPayload as {
    service_id?: string;
    name?: string;
    description?: string;
    price_from_pence?: number;
    keywords?: string[];
  };
  if (!p.service_id) {
    return { status: "skipped", reason: "service_added needs service_id" };
  }
  const rec = await upsertMemoryRecord({
    merchantId: event.merchantId,
    recordType: "service",
    facets: {
      service_id: p.service_id,
      name: p.name,
      description: p.description,
      price_from_pence: p.price_from_pence,
      keywords: p.keywords ?? [],
      added_at: event.occurredAt
    },
    linkEventId: event.id,
    naturalKey: { field: "service_id", value: p.service_id }
  });
  if (!rec) return { status: "failed", reason: "memory upsert failed" };
  return {
    status: "done",
    targetRef: { memoryRecordId: rec.id, recordType: "service" }
  };
}

async function handleServiceAreaAdded(
  event: BusinessEvent
): Promise<ProjectionResult> {
  const p = event.eventPayload as {
    area_id?: string;
    postcode_prefix?: string;
    name?: string;
    radius_miles?: number;
  };
  if (!p.area_id) {
    return { status: "skipped", reason: "service_area_added needs area_id" };
  }
  const rec = await upsertMemoryRecord({
    merchantId: event.merchantId,
    recordType: "service_area",
    facets: {
      area_id: p.area_id,
      postcode_prefix: p.postcode_prefix,
      name: p.name,
      radius_miles: p.radius_miles,
      added_at: event.occurredAt
    },
    postcode: p.postcode_prefix?.toUpperCase(),
    linkEventId: event.id,
    naturalKey: { field: "area_id", value: p.area_id }
  });
  if (!rec) return { status: "failed", reason: "memory upsert failed" };
  return {
    status: "done",
    targetRef: { memoryRecordId: rec.id, recordType: "service_area" }
  };
}
