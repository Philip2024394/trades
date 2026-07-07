// Gold Path projection — every meaningful event creates or updates a
// Gold Path task so the merchant's weekly view stays current.
//
// This is the bidirectional loop the design doc describes: events
// generate tasks; tasks reference back to the source event so
// completion feels immediate.

import { insertGoldPathTask } from "@/lib/gold-path/loader";
import type { BusinessEvent, ProjectionResult } from "../types";

export async function goldPathProjection(
  event: BusinessEvent
): Promise<ProjectionResult> {
  const p = event.eventPayload as Record<string, unknown>;

  switch (event.eventType) {
    case "review_received":
    case "testimonial_recorded": {
      const task = await insertGoldPathTask({
        merchantId: event.merchantId,
        taskKind: "reply_to_review",
        title: "New review — reply within 24h",
        bodyMarkdown:
          "Fast replies to reviews signal an active business and boost your Google ranking.",
        ctaKind: "open_reviews",
        ctaTarget: "/reviews",
        urgency: "high",
        sourceEventId: event.id,
        sourceProjectionType: "gold_path_task",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
      if (!task) return { status: "failed", reason: "task insert failed" };
      return { status: "done", targetRef: { taskId: task.id } };
    }

    case "work_captured": {
      // If the merchant records in-progress work, we suggest returning
      // to complete the arc later.
      const jobId = p.job_id as string | undefined;
      if (!jobId) return { status: "skipped", reason: "no job_id on capture" };
      const task = await insertGoldPathTask({
        merchantId: event.merchantId,
        taskKind: "complete_story_arc",
        title: "Finish the story — post a completion photo",
        bodyMarkdown: `You've started documenting a job. Post a completion photo to auto-generate a full case study.`,
        ctaKind: "open_capture",
        ctaTarget: `/capture?job=${encodeURIComponent(jobId)}`,
        urgency: "low",
        sourceEventId: event.id,
        sourceProjectionType: "gold_path_task",
        expiresAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString()
      });
      if (!task) return { status: "failed", reason: "task insert failed" };
      return { status: "done", targetRef: { taskId: task.id } };
    }

    case "job_completed": {
      // Completed job → prompt to ask for a review.
      const jobId = p.job_id as string | undefined;
      if (!jobId) return { status: "skipped", reason: "no job_id" };
      const task = await insertGoldPathTask({
        merchantId: event.merchantId,
        taskKind: "reply_lead",
        title: "Ask the customer for a review",
        bodyMarkdown:
          "Reviews right after a job land 3–5× more often than reviews chased weeks later. One tap to send.",
        ctaKind: "open_review_request",
        ctaTarget: `/reviews/request?job=${encodeURIComponent(jobId)}`,
        urgency: "normal",
        sourceEventId: event.id,
        sourceProjectionType: "gold_path_task",
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      });
      if (!task) return { status: "failed", reason: "task insert failed" };
      return { status: "done", targetRef: { taskId: task.id } };
    }

    case "certification_earned": {
      const task = await insertGoldPathTask({
        merchantId: event.merchantId,
        taskKind: "share_certification",
        title: "Share your new certification",
        bodyMarkdown:
          "New certifications are trust signals — post them to your website + socials.",
        ctaKind: "open_capture",
        ctaTarget: "/capture?type=certification",
        urgency: "normal",
        sourceEventId: event.id,
        sourceProjectionType: "gold_path_task"
      });
      if (!task) return { status: "failed", reason: "task insert failed" };
      return { status: "done", targetRef: { taskId: task.id } };
    }

    default:
      return {
        status: "skipped",
        reason: `no Gold Path projection for ${event.eventType}`
      };
  }
}
