// Story arc projection — every event runs through the arc detector.
// When the event is a closer (job_completed) we close the arc + queue
// a case study.
//
// The case study itself is queued as a synthetic business_event
// (`milestone_reached` with a special payload) so the existing feed
// + publications projections pick it up for free — no new pipeline
// needed.

import { emitEvent } from "@/lib/events/emit";
import { composeCaseStudy } from "@/lib/story-arcs/caseStudyComposer";
import {
  attachEventToArcOrCreate
} from "@/lib/story-arcs/detector";
import {
  loadArcById,
  loadArcEvents,
  markArcClosed
} from "@/lib/story-arcs/loader";
import type { BusinessEvent, ProjectionResult } from "../types";

const ARC_TRIGGERS = ["work_captured", "job_completed"];

export async function storyArcProjection(
  event: BusinessEvent
): Promise<ProjectionResult> {
  if (!ARC_TRIGGERS.includes(event.eventType)) {
    return { status: "skipped", reason: `no arc projection for ${event.eventType}` };
  }
  const attach = await attachEventToArcOrCreate(event);
  if (!attach) {
    return { status: "failed", reason: "arc attachment failed" };
  }

  // On closer events: close the arc + fan out case study.
  if (attach.role === "closer") {
    const arc = await loadArcById(attach.arcId);
    if (!arc) {
      return { status: "failed", reason: "arc reload failed" };
    }
    const arcEvents = await loadArcEvents(attach.arcId);
    const eventIds = arcEvents.map((e) => e.eventId);
    const caseStudy = await composeCaseStudy(arc, eventIds);
    await markArcClosed(attach.arcId);
    if (caseStudy) {
      // Emit a synthetic milestone event that carries the case study
      // draft as payload. Existing feed + publication projections
      // pick it up and render it across channels.
      await emitEvent({
        merchantId: event.merchantId,
        eventType: "milestone_reached",
        payload: {
          milestone_kind: "case_study",
          trade: caseStudy.facets.trade,
          service: caseStudy.facets.service,
          materials: caseStudy.facets.materials,
          postcode: caseStudy.facets.postcode,
          photo_urls: caseStudy.photo_urls,
          consent_state: "granted", // arc events already consent-gated upstream
          case_study: {
            arc_id: attach.arcId,
            headline: caseStudy.headline,
            intro: caseStudy.intro,
            middle: caseStudy.middle,
            outro: caseStudy.outro,
            channel_hints: caseStudy.channel_hints
          }
        },
        source: "story_arc_close",
        idempotencyKey: `case-study-${attach.arcId}`
      });
    }
    return {
      status: "done",
      targetRef: {
        arcId: attach.arcId,
        role: attach.role,
        caseStudyComposed: Boolean(caseStudy)
      }
    };
  }

  return {
    status: "done",
    targetRef: {
      arcId: attach.arcId,
      role: attach.role,
      wasNew: attach.wasNew
    }
  };
}
