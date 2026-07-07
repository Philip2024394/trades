// Vision preprocessing pipeline — the pre-event pass that runs on
// every uploaded photo before an event is emitted.
//
// Composes three vision layers (all pluggable):
//   1. face + plate blur — privacy-critical
//   2. quality score — governs channel-specific thresholds
//   3. subject tags — feeds ai_understanding on the event
//
// Returns a structured findings object + a suggested action:
//   'publish' — good enough to autoflow through all projections
//   'review' — held with a reason for merchant to decide
//   'reject' — outright unfit (illegal content / customer face visible /
//              no consent + person present)

import { blurFacesAndPlates } from "./faceBlur";
import { scoreQuality } from "./qualityScore";
import { detectSubjectTags } from "./subjectTags";

export type PreprocessResult = {
  buffer: Buffer;
  findings: {
    quality: {
      sharpness: number;
      brightness: number;
      composition: number;
      overall: number;
    };
    faces_blurred: number;
    plates_blurred: number;
    competitor_brands: string[];
    subject_tags: string[];
    safety_signals: string[];
  };
  ai_understanding: {
    trade: string | null;
    service: string | null;
    materials: string[];
    stage: string | null;
  };
  suggested_action: "publish" | "review" | "reject";
  suggested_reason: string;
};

export async function preprocessImage(
  input: Buffer,
  options?: { consentGranted?: boolean }
): Promise<PreprocessResult> {
  // Run vision layers.
  const blurred = await blurFacesAndPlates(input);
  const quality = await scoreQuality(blurred.buffer);
  const subject = await detectSubjectTags(blurred.buffer);

  const consentGranted = options?.consentGranted ?? false;
  let suggested_action: PreprocessResult["suggested_action"] = "review";
  let suggested_reason = "default_review — merchant to confirm";

  // Reject rules — non-negotiable.
  if (blurred.facesBlurred > 0 && !consentGranted) {
    suggested_action = "reject";
    suggested_reason =
      "face_detected_without_consent — never publish. Ask permission or reshoot.";
  } else if (subject.competitor_brands.length > 0) {
    suggested_action = "review";
    suggested_reason = `competitor_brand_visible — ${subject.competitor_brands.join(", ")}`;
  } else if (quality.overall < 0.35) {
    suggested_action = "review";
    suggested_reason = `low_quality — overall ${quality.overall}`;
  } else if (quality.overall >= 0.7) {
    suggested_action = "publish";
    suggested_reason = `high_quality — overall ${quality.overall}`;
  } else {
    suggested_action = "publish";
    suggested_reason = `acceptable_quality — overall ${quality.overall}`;
  }

  const findings = {
    quality,
    faces_blurred: blurred.facesBlurred,
    plates_blurred: blurred.platesBlurred,
    competitor_brands: subject.competitor_brands,
    subject_tags: [
      ...(subject.trade ? [subject.trade] : []),
      ...(subject.service ? [subject.service] : []),
      ...subject.materials,
      ...(subject.stage ? [subject.stage] : [])
    ],
    safety_signals: subject.safety_signals
  };

  return {
    buffer: blurred.buffer,
    findings,
    ai_understanding: {
      trade: subject.trade,
      service: subject.service,
      materials: subject.materials,
      stage: subject.stage
    },
    suggested_action,
    suggested_reason
  };
}
