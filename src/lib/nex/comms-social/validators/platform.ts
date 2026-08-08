// NEX Comms Centre · Social · Platform stage.
//
// Charter §S-VIII: Platform-validator enforces per-platform caps
// declared in the adapter capabilities (S-II · adapter-declared
// metadata, engine never embeds provider-specific rules).
//
// Phase 3 enforces:
//   * caption length ≤ capabilities.caption_max_chars
//   * hashtag count ≤ capabilities.hashtags_max
//   * unknown platform → fail_closed (no adapter registered)
//
// Media-count / aspect-ratio checks apply to the future publish path
// (Phase 4 worker attaches images to the subject); if `images` land on
// the subject shape later, Phase 3's check will extend without a stage
// re-plumb.

import { getAdapter, listRegisteredPlatforms } from "../adapters/registry";
import type { SafetyValidator, StageResult } from "./interface";
import type { SocialPlatform } from "../types";

export function createPlatformValidator(): SafetyValidator {
  return {
    stage: "platform",
    async run({ subject, timeout_ms }) {
      const started = Date.now();
      const rejections: StageResult["rejections"] = [];
      let outcome: StageResult["outcome"] = "pass";
      let failed_closed_reason: string | undefined;

      try {
        const platforms = listRegisteredPlatforms();
        if (!platforms.includes(subject.platform as SocialPlatform)) {
          return {
            stage: "platform",
            outcome: "fail_closed",
            ms: Date.now() - started,
            rejections: [],
            failed_closed_reason: `no adapter registered for platform '${subject.platform}'`,
          };
        }
        const adapter = getAdapter(subject.platform as SocialPlatform);
        const caps    = await withTimeout(() => Promise.resolve(adapter.capabilities()), timeout_ms);

        if (subject.caption.length > caps.caption_max_chars) {
          rejections.push({
            code: "platform_caption_over_limit",
            detail: `caption ${subject.caption.length} chars exceeds ${caps.caption_max_chars} for platform ${subject.platform}`,
            stage_specific: { length: subject.caption.length, limit: caps.caption_max_chars },
          });
        }
        if (subject.hashtags.length > caps.hashtags_max) {
          rejections.push({
            code: "platform_hashtags_over_limit",
            detail: `${subject.hashtags.length} hashtags exceeds ${caps.hashtags_max} for platform ${subject.platform}`,
            stage_specific: { count: subject.hashtags.length, limit: caps.hashtags_max },
          });
        }
        if (rejections.length > 0) outcome = "reject";
      } catch (e) {
        outcome = "fail_closed";
        failed_closed_reason = e instanceof Error ? e.message : String(e);
      }

      return { stage: "platform", outcome, ms: Date.now() - started, rejections, failed_closed_reason };
    },
  };
}

function withTimeout<T>(fn: () => Promise<T>, timeout_ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; reject(new Error(`stage timeout after ${timeout_ms}ms`)); } }, timeout_ms);
    fn().then((v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } })
        .catch((e) => { if (!settled) { settled = true; clearTimeout(timer); reject(e); } });
  });
}
