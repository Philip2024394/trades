// Projection registration — imported for side effects by the emit
// module so every event dispatch has the full registry loaded.
//
// New projection handlers register themselves here. The pattern is
// intentional: one file lists every subscription so we can grep for
// "who reacts to job_completed" and get a complete answer.

import { registerProjection } from "../bus";
import { memoryProjection } from "./memory";
import { feedProjection } from "./feed";
import { publicationsProjection } from "./publications";
import { goldPathProjection } from "./goldpath";
import { storyArcProjection } from "./story-arc";

// Memory projection subscribes to every event that describes a
// durable business fact. If the handler doesn't have a case for an
// event type it returns { status: 'skipped' } — cheap enough to
// register broadly.
registerProjection(
  [
    "job_completed",
    "work_captured",
    "review_received",
    "testimonial_recorded",
    "staff_joined",
    "certification_earned",
    "service_added",
    "service_area_added"
  ],
  "memory_write",
  memoryProjection
);

// G1 — Website Live Feed projection. Only fires for content-worthy
// events with consent granted. Every other event type returns skipped.
registerProjection(
  [
    "work_captured",
    "job_completed",
    "review_received",
    "testimonial_recorded",
    "certification_earned",
    "milestone_reached"
  ],
  "website_update",
  feedProjection
);

// G2 — Publications projection (Instagram / Facebook / GBP via
// merchant channel connections). Skips gracefully if no connections
// are set up on the merchant.
registerProjection(
  [
    "work_captured",
    "job_completed",
    "review_received",
    "testimonial_recorded",
    "certification_earned",
    "milestone_reached"
  ],
  "publication",
  publicationsProjection
);

// G2 — Gold Path tasks. Every event that should surface as guidance
// in the weekly view lands here.
registerProjection(
  [
    "work_captured",
    "job_completed",
    "review_received",
    "testimonial_recorded",
    "certification_earned",
    "milestone_reached",
    "lead_received",
    "quote_sent"
  ],
  "gold_path_task",
  goldPathProjection
);

// G3 — Story arc detection + closure. Runs on every work_captured /
// job_completed. On closer events, fires a synthetic milestone_reached
// event with the composed case study which the feed + publications
// projections pick up and render across every channel automatically.
//
// IMPORTANT: register with a distinct projection_type so it doesn't
// collide with the memory_write registration.
registerProjection(
  ["work_captured", "job_completed"],
  "narrative_update",
  storyArcProjection
);

// Future registrations land here:
//   - follow_up (G4+)
//   - referral_request (G4+)
//   - maintenance_reminder (G4+)
