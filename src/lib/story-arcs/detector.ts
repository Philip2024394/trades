// Arc detector — matches an incoming event to an existing arc, or
// creates a new one. Two rules:
//
//   1. Natural key match: if the event's payload has a job_id and an
//      arc with the same job_id + merchant already exists, attach.
//
//   2. Contextual match: same trade + postcode within the last 21
//      days = probable same job. This catches the case where the
//      merchant forgot to set job_id on the first photo but named
//      the same trade + postcode.
//
// If neither rule matches, a new arc is created.

import {
  attachEventToArc,
  createArc,
  findArcByNaturalKey,
  findOpenArcForContext
} from "./loader";
import type { BusinessEvent } from "@/lib/events/types";

export type ArcAttachment = {
  arcId: string;
  role: "opener" | "progress" | "climax" | "closer";
  wasNew: boolean;
};

export async function attachEventToArcOrCreate(
  event: BusinessEvent
): Promise<ArcAttachment | null> {
  const p = event.eventPayload as Record<string, unknown>;
  const jobId = p.job_id as string | undefined;
  const trade = p.trade as string | undefined;
  const postcode = (p.postcode as string | undefined)?.toUpperCase();
  const stage = p.stage as string | undefined;

  const role: ArcAttachment["role"] =
    event.eventType === "job_completed" || stage === "completed"
      ? "closer"
      : event.eventType === "work_captured" && stage === "started"
      ? "opener"
      : "progress";

  const mergedFacets = mergeFacets(p);

  // Rule 1: natural key (job_id).
  if (jobId) {
    const existing = await findArcByNaturalKey(event.merchantId, jobId);
    if (existing) {
      await attachEventToArc(
        existing.id,
        event.id,
        role,
        event.occurredAt,
        { ...existing.facets, ...mergedFacets }
      );
      return { arcId: existing.id, role, wasNew: false };
    }
    // No existing — create with this job_id.
    const created = await createArc({
      merchantId: event.merchantId,
      naturalKey: jobId,
      facets: mergedFacets
    });
    if (!created) return null;
    await attachEventToArc(
      created.id,
      event.id,
      role === "closer" ? "closer" : "opener",
      event.occurredAt,
      mergedFacets
    );
    return { arcId: created.id, role, wasNew: true };
  }

  // Rule 2: contextual match on trade + postcode within 21d.
  if (trade && postcode) {
    const existing = await findOpenArcForContext({
      merchantId: event.merchantId,
      trade,
      postcode,
      withinDays: 21
    });
    if (existing) {
      await attachEventToArc(
        existing.id,
        event.id,
        role,
        event.occurredAt,
        { ...existing.facets, ...mergedFacets }
      );
      return { arcId: existing.id, role, wasNew: false };
    }
  }

  // No match — spawn a new arc with no natural key.
  const created = await createArc({
    merchantId: event.merchantId,
    facets: mergedFacets
  });
  if (!created) return null;
  await attachEventToArc(
    created.id,
    event.id,
    "opener",
    event.occurredAt,
    mergedFacets
  );
  return { arcId: created.id, role, wasNew: true };
}

function mergeFacets(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const facets: Record<string, unknown> = {};
  if (typeof payload.trade === "string") facets.trade = payload.trade;
  if (typeof payload.service === "string") facets.service = payload.service;
  if (typeof payload.postcode === "string")
    facets.postcode = (payload.postcode as string).toUpperCase();
  if (Array.isArray(payload.materials)) facets.materials = payload.materials;
  if (Array.isArray(payload.colours)) facets.colours = payload.colours;
  if (typeof payload.cost_band === "string") facets.cost_band = payload.cost_band;
  return facets;
}
