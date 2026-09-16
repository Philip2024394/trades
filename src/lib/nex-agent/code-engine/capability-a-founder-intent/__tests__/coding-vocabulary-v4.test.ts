// NEX1 · CAPABILITY A · v4.0.0 vocabulary tests · media / responsive / cloud / git / PR / spec / team.

import { describe, it, expect } from "vitest";
import { classifyFounderIntent } from "../classifier";
import {
  CODE_CONCEPT_LEXEMES,
  FRAMEWORK_LEXEMES,
  TOOL_LEXEMES,
  VOCABULARY_VERSION,
  WELL_KNOWN_CONFIG_FILES,
} from "../vocabulary";
import type { Nex1IntentClassified } from "../types";

function classified(result: ReturnType<typeof classifyFounderIntent>): Nex1IntentClassified {
  if (result.kind !== "classified") throw new Error(`expected classified, got ${result.kind}`);
  return result;
}

describe("capability-a v4 · vocabulary version + baseline sizes", () => {
  it("VOCABULARY_VERSION is v4.0.0 or a v5.0.0-alpha successor", () => {
    // v5.0.0-alpha.* increments preserve v4 baselines (add-only, never remove).
    expect(VOCABULARY_VERSION).toMatch(/^v(4\.0\.0|5\.0\.0(-alpha\.\d+)?)$/);
  });

  it("registries meet v4 baselines", () => {
    expect(TOOL_LEXEMES.size).toBeGreaterThanOrEqual(180);
    expect(FRAMEWORK_LEXEMES.size).toBeGreaterThanOrEqual(250);
    expect(CODE_CONCEPT_LEXEMES.size).toBeGreaterThanOrEqual(650);
  });

  it("provider-config filenames present in WELL_KNOWN_CONFIG_FILES", () => {
    expect(WELL_KNOWN_CONFIG_FILES.has("vercel.json")).toBe(true);
    expect(WELL_KNOWN_CONFIG_FILES.has("netlify.toml")).toBe(true);
    expect(WELL_KNOWN_CONFIG_FILES.has("fly.toml")).toBe(true);
    expect(WELL_KNOWN_CONFIG_FILES.has("firebase.json")).toBe(true);
    expect(WELL_KNOWN_CONFIG_FILES.has("turbo.json")).toBe(true);
    expect(WELL_KNOWN_CONFIG_FILES.has("CODEOWNERS")).toBe(true);
    expect(WELL_KNOWN_CONFIG_FILES.has(".github/CODEOWNERS")).toBe(true);
  });
});

describe("capability-a v4 · image + media formats", () => {
  it("recognises image formats", () => {
    const r = classified(
      classifyFounderIntent("author an svg to webp converter with png and avif fallbacks"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("svg");
    expect(concepts).toContain("webp");
    expect(concepts).toContain("png");
    expect(concepts).toContain("avif");
  });

  it("recognises image processing operations", () => {
    const r = classified(
      classifyFounderIntent("author a crop resize and thumbnail pipeline with a watermark step"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("crop");
    expect(concepts).toContain("resize");
    expect(concepts).toContain("thumbnail");
    expect(concepts).toContain("watermark");
  });

  it("recognises image processing tools", () => {
    const r = classified(
      classifyFounderIntent("author an ffmpeg and sharp pipeline plus imagemagick fallback"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("ffmpeg:tool");
    expect(cats).toContain("sharp:tool");
    expect(cats).toContain("imagemagick:tool");
  });

  it("recognises audio formats + processing", () => {
    const r = classified(
      classifyFounderIntent("author a wav to mp3 encoder with flac fallback at 48 sample-rate"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("wav");
    expect(concepts).toContain("mp3");
    expect(concepts).toContain("flac");
    expect(concepts).toContain("encoder");
    expect(concepts).toContain("sample-rate");
  });

  it("recognises video formats + codecs", () => {
    const r = classified(
      classifyFounderIntent(
        "author an mp4 to webm transcoder using h265 and vp9 codec choices with hls output",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("mp4");
    expect(concepts).toContain("webm");
    expect(concepts).toContain("h265");
    expect(concepts).toContain("vp9");
    expect(concepts).toContain("codec");
    expect(concepts).toContain("hls");
  });

  it("recognises archive + document formats", () => {
    const r = classified(
      classifyFounderIntent(
        "author a zip and tar exporter with pdf and csv output alongside parquet dumps",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("zip");
    expect(concepts).toContain("tar");
    expect(concepts).toContain("pdf");
    expect(concepts).toContain("csv");
    expect(concepts).toContain("parquet");
  });

  it("recognises font + model + binary formats", () => {
    const r = classified(
      classifyFounderIntent("author a woff2 loader and an onnx runtime plus an apk installer"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("woff2");
    expect(concepts).toContain("onnx");
    expect(concepts).toContain("apk");
  });
});

describe("capability-a v4 · responsive design + screen size vocabulary", () => {
  it("recognises device categories", () => {
    const r = classified(
      classifyFounderIntent("author a mobile and tablet and desktop layout for the iphone and ipad"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("mobile");
    expect(concepts).toContain("tablet");
    expect(concepts).toContain("desktop");
    expect(concepts).toContain("iphone");
    expect(concepts).toContain("ipad");
  });

  it("recognises breakpoint tokens", () => {
    const r = classified(
      classifyFounderIntent("author sm md lg and xl breakpoints with mobile-first defaults"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("sm");
    expect(concepts).toContain("md");
    expect(concepts).toContain("lg");
    expect(concepts).toContain("xl");
    expect(concepts).toContain("mobile-first");
  });

  it("recognises viewport units + density concepts", () => {
    const r = classified(
      classifyFounderIntent(
        "refactor the layout using rem vh and dvh units with a retina hidpi fallback",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("rem");
    expect(concepts).toContain("vh");
    expect(concepts).toContain("dvh");
    expect(concepts).toContain("retina");
    expect(concepts).toContain("hidpi");
  });

  it("recognises safe-area + dynamic-island + notch", () => {
    const r = classified(
      classifyFounderIntent(
        "author a safe-area layout that respects the notch and dynamic-island on iphone",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("safe-area");
    expect(concepts).toContain("notch");
    expect(concepts).toContain("dynamic-island");
  });

  it("recognises layout systems", () => {
    const r = classified(
      classifyFounderIntent("author a grid with subgrid and flexbox fallback using masonry sections"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("grid");
    expect(concepts).toContain("subgrid");
    expect(concepts).toContain("flexbox");
    expect(concepts).toContain("masonry");
  });

  it("recognises dark-mode + color-scheme", () => {
    const r = classified(
      classifyFounderIntent(
        "author a dark-mode toggle with prefers-color-scheme and prefers-reduced-motion",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("dark-mode");
    expect(concepts).toContain("prefers-color-scheme");
    expect(concepts).toContain("prefers-reduced-motion");
  });
});

describe("capability-a v4 · upload / download / streaming protocols", () => {
  it("recognises upload verbs + drag-drop", () => {
    const r = classified(
      classifyFounderIntent("author an upload flow with drag-and-drop and file-picker fallback"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("upload");
    expect(concepts).toContain("drag-and-drop");
    expect(concepts).toContain("file-picker");
  });

  it("recognises multipart + tus + presigned-url", () => {
    const r = classified(
      classifyFounderIntent("author a multipart resumable tus upload with a presigned-url s3 target"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("multipart");
    expect(concepts).toContain("resumable");
    expect(concepts).toContain("tus");
    expect(concepts).toContain("presigned-url");
    // s3 must be recognised as framework
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("s3:framework");
  });

  it("recognises upload libraries", () => {
    const r = classified(
      classifyFounderIntent("author an uppy config with filepond and dropzone integrations"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("uppy:framework");
    expect(cats).toContain("filepond:framework");
    expect(cats).toContain("dropzone:framework");
  });

  it("recognises streams api", () => {
    const r = classified(
      classifyFounderIntent(
        "author a fetch-stream pipeline with readable-stream and transform-stream steps",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("fetch-stream");
    expect(concepts).toContain("readable-stream");
    expect(concepts).toContain("transform-stream");
  });
});

describe("capability-a v4 · UI alert / notification / preview vocabulary", () => {
  it("recognises alert component types", () => {
    const r = classified(
      classifyFounderIntent(
        "author a toast plus snackbar and a modal dialog with a tooltip and popover",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("toast");
    expect(concepts).toContain("snackbar");
    expect(concepts).toContain("modal");
    expect(concepts).toContain("dialog");
    expect(concepts).toContain("tooltip");
    expect(concepts).toContain("popover");
  });

  it("recognises severity levels", () => {
    const r = classified(
      classifyFounderIntent(
        "author a warning info and success alerts with critical severity for the error case",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("warning");
    expect(concepts).toContain("info");
    expect(concepts).toContain("success");
    expect(concepts).toContain("critical");
    expect(concepts).toContain("severity");
  });

  it("recognises preview + iframe + service-worker", () => {
    const r = classified(
      classifyFounderIntent(
        "author a preview iframe with sandbox postmessage bridge and a service-worker cache",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("preview");
    expect(concepts).toContain("iframe");
    expect(concepts).toContain("sandbox");
    expect(concepts).toContain("postmessage");
    expect(concepts).toContain("service-worker");
  });

  it("recognises toast/notification frameworks", () => {
    const r = classified(
      classifyFounderIntent("author a sonner toast and react-hot-toast fallback with cmdk palette"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("sonner:framework");
    expect(cats).toContain("react-hot-toast:framework");
    expect(cats).toContain("cmdk:framework");
  });
});

describe("capability-a v4 · cloud providers + services", () => {
  it("recognises major cloud vendors", () => {
    const r = classified(
      classifyFounderIntent(
        "author an aws lambda function with gcp cloud-run fallback on azure aks",
      ),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("aws:framework");
    expect(cats).toContain("lambda:framework");
    expect(cats).toContain("gcp:framework");
    expect(cats).toContain("cloud-run:framework");
    expect(cats).toContain("azure:framework");
    expect(cats).toContain("aks:framework");
  });

  it("recognises AWS core services", () => {
    const r = classified(
      classifyFounderIntent(
        "author an s3 bucket with rds aurora and cloudfront edge caching plus sqs sns",
      ),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("s3:framework");
    expect(cats).toContain("rds:framework");
    expect(cats).toContain("aurora:framework");
    expect(cats).toContain("cloudfront:framework");
    expect(cats).toContain("sqs:framework");
    expect(cats).toContain("sns:framework");
  });

  it("recognises edge/serverless platforms", () => {
    const r = classified(
      classifyFounderIntent(
        "author a cloudflare-workers backend using vercel-edge and cloudflare-r2 storage",
      ),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("cloudflare-workers:framework");
    expect(cats).toContain("vercel-edge:framework");
    expect(cats).toContain("cloudflare-r2:framework");
  });

  it("recognises storage + CDN services", () => {
    const r = classified(
      classifyFounderIntent(
        "author a cloudinary transform pipeline with imgix fallback and fastly caching",
      ),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("cloudinary:framework");
    expect(cats).toContain("imgix:framework");
    expect(cats).toContain("fastly:framework");
  });
});

describe("capability-a v4 · git operations + versioning", () => {
  it("recognises core git operations", () => {
    const r = classified(
      classifyFounderIntent(
        "author a rebase and cherry-pick strategy with reflog inspection and bisect fallback",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("rebase");
    expect(concepts).toContain("cherry-pick");
    expect(concepts).toContain("reflog");
    expect(concepts).toContain("bisect");
  });

  it("recognises hooks + conventional commits", () => {
    const r = classified(
      classifyFounderIntent(
        "author pre-commit and post-commit hooks with conventional-commits and semver support",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("pre-commit");
    expect(concepts).toContain("post-commit");
    expect(concepts).toContain("conventional-commits");
    expect(concepts).toContain("semver");
  });

  it("recognises release tokens", () => {
    const r = classified(
      classifyFounderIntent(
        "author a canary release with a prerelease tag then nightly and stable channels",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("canary");
    expect(concepts).toContain("prerelease");
    expect(concepts).toContain("nightly");
    expect(concepts).toContain("stable");
  });

  it("recognises worktree + submodule + lfs", () => {
    const r = classified(
      classifyFounderIntent(
        "author a worktree plus submodule strategy with git-lfs for large binaries",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("worktree");
    expect(concepts).toContain("submodule");
    expect(concepts).toContain("git-lfs");
  });
});

describe("capability-a v4 · PR / MR / review workflow", () => {
  it("recognises pull-request + review states", () => {
    const r = classified(
      classifyFounderIntent(
        "author a pull-request template with codeowners and required-checks for auto-merge",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("pull-request");
    expect(concepts).toContain("codeowners");
    expect(concepts).toContain("required-checks");
    expect(concepts).toContain("auto-merge");
  });

  it("recognises reviewer terms", () => {
    const r = classified(
      classifyFounderIntent(
        "author a code-review policy with a reviewer and approver plus lgtm and nit conventions",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("code-review");
    expect(concepts).toContain("reviewer");
    expect(concepts).toContain("approver");
    expect(concepts).toContain("lgtm");
    expect(concepts).toContain("nit");
  });

  it("recognises merge-queue + stacked-pr", () => {
    const r = classified(
      classifyFounderIntent(
        "author a merge-queue with stacked-pr support and required-reviewers gates",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("merge-queue");
    expect(concepts).toContain("stacked-pr");
    expect(concepts).toContain("required-reviewers");
  });

  it("recognises CI bots", () => {
    const r = classified(
      classifyFounderIntent(
        "author a dependabot config with renovate fallback plus mergify auto-merge rules",
      ),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("dependabot:tool");
    expect(cats).toContain("renovate:tool");
    expect(cats).toContain("mergify:tool");
  });
});

describe("capability-a v4 · software specification vocabulary", () => {
  it("recognises spec doc types", () => {
    const r = classified(
      classifyFounderIntent(
        "author an rfc plus an adr and a prd summarising the mvp scope and acceptance-criteria",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("rfc");
    expect(concepts).toContain("adr");
    expect(concepts).toContain("prd");
    expect(concepts).toContain("mvp");
    expect(concepts).toContain("acceptance-criteria");
  });

  it("recognises agile planning terms", () => {
    const r = classified(
      classifyFounderIntent(
        "author a sprint plan for the next milestone with an epic breakdown and a user-story backlog",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("sprint");
    expect(concepts).toContain("milestone");
    expect(concepts).toContain("epic");
    expect(concepts).toContain("user-story");
    expect(concepts).toContain("backlog");
  });

  it("recognises design artefacts", () => {
    const r = classified(
      classifyFounderIntent(
        "author a wireframe plus mockup with a user-flow storyboard and journey-map",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("wireframe");
    expect(concepts).toContain("mockup");
    expect(concepts).toContain("user-flow");
    expect(concepts).toContain("storyboard");
    expect(concepts).toContain("journey-map");
  });

  it("recognises DoD / DoR / OKR / KPI", () => {
    const r = classified(
      classifyFounderIntent(
        "author a definition-of-done alongside definition-of-ready and okr with kpi targets",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("definition-of-done");
    expect(concepts).toContain("definition-of-ready");
    expect(concepts).toContain("okr");
    expect(concepts).toContain("kpi");
  });
});

describe("capability-a v4 · team communication + incident vocabulary", () => {
  it("recognises collaboration tools", () => {
    const r = classified(
      classifyFounderIntent(
        "author a slack channel bot with linear ticket sync and figma preview embeds",
      ),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("slack:tool");
    expect(cats).toContain("linear:tool");
    expect(cats).toContain("figma:tool");
  });

  it("recognises incident vocabulary", () => {
    const r = classified(
      classifyFounderIntent(
        "author a pagerduty escalation with a runbook and a blameless postmortem template",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("escalation");
    expect(concepts).toContain("runbook");
    expect(concepts).toContain("blameless");
    expect(concepts).toContain("postmortem");
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("pagerduty:tool");
  });

  it("recognises on-call + rotation + sla/slo", () => {
    const r = classified(
      classifyFounderIntent(
        "author an on-call rotation policy with sla slo sli and an error-budget dashboard",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("on-call");
    expect(concepts).toContain("sla");
    expect(concepts).toContain("slo");
    expect(concepts).toContain("sli");
    expect(concepts).toContain("error-budget");
  });
});

describe("capability-a v4 · release management vocabulary", () => {
  it("recognises deployment patterns", () => {
    const r = classified(
      classifyFounderIntent(
        "author a canary-release plus blue-green-deploy strategy with a kill-switch fallback",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("canary-release");
    expect(concepts).toContain("blue-green-deploy");
    expect(concepts).toContain("kill-switch");
  });

  it("recognises feature-flag terminology", () => {
    const r = classified(
      classifyFounderIntent(
        "author a feature-flag rollout with launchdarkly plus gradual-rollout to percent-rollout",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("feature-flag");
    expect(concepts).toContain("gradual-rollout");
    expect(concepts).toContain("percent-rollout");
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("launchdarkly:tool");
  });

  it("recognises versioning tokens", () => {
    const r = classified(
      classifyFounderIntent(
        "author a changelog with breaking-change and deprecation entries plus lts support-window",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("changelog");
    expect(concepts).toContain("breaking-change");
    expect(concepts).toContain("deprecation");
    expect(concepts).toContain("lts");
    expect(concepts).toContain("support-window");
  });
});

describe("capability-a v4 · provider config-file detection", () => {
  it("detects vercel.json + netlify.toml + fly.toml", () => {
    const r = classified(
      classifyFounderIntent(
        "modify vercel.json and netlify.toml plus fly.toml to expose the new env vars",
      ),
    );
    const paths = r.file_references.map((f) => f.path);
    expect(paths).toContain("vercel.json");
    expect(paths).toContain("netlify.toml");
    expect(paths).toContain("fly.toml");
  });

  it("detects .github/CODEOWNERS + turbo.json + firebase.json", () => {
    const r = classified(
      classifyFounderIntent(
        "modify .github/CODEOWNERS and turbo.json plus firebase.json for the release wave",
      ),
    );
    const paths = r.file_references.map((f) => f.path);
    expect(paths).toContain(".github/CODEOWNERS");
    expect(paths).toContain("turbo.json");
    expect(paths).toContain("firebase.json");
  });
});

describe("capability-a v4 · determinism + regression", () => {
  it("byte-identical output on repeat call after v4 expansion", () => {
    const goal =
      "Author a nextjs page in typescript that uses react hooks for state, tailwind for styling, prisma for the postgres schema, vitest for tests, uploads via uppy to s3 with a presigned-url, shows a sonner toast on success, and deploys to vercel-edge with a canary-release and feature-flag.";
    const a = classifyFounderIntent(goal);
    const b = classifyFounderIntent(goal);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("world-class end-to-end goal exercises 10+ categories", () => {
    const goal =
      "Author a nextjs page in typescript with react hooks and tailwind, upload images via uppy to s3 with a presigned-url, transcode video via ffmpeg to hls, show a sonner toast on success, use dependabot and merge-queue for the pull-request, deploy to vercel-edge with a canary-release feature-flag, and page pagerduty on sev1 incidents.";
    const r = classified(classifyFounderIntent(goal));
    const concepts = r.coding_concepts.map((c) => c.token);
    // Sample coverage across categories
    expect(concepts).toContain("nextjs");
    expect(concepts).toContain("typescript");
    expect(concepts).toContain("react");
    expect(concepts).toContain("hooks");
    expect(concepts).toContain("tailwind");
    expect(concepts).toContain("upload");
    expect(concepts).toContain("s3");
    expect(concepts).toContain("presigned-url");
    expect(concepts).toContain("ffmpeg");
    expect(concepts).toContain("hls");
    expect(concepts).toContain("sonner");
    expect(concepts).toContain("dependabot");
    expect(concepts).toContain("merge-queue");
    expect(concepts).toContain("pull-request");
    expect(concepts).toContain("vercel-edge");
    expect(concepts).toContain("canary-release");
    expect(concepts).toContain("feature-flag");
    expect(concepts).toContain("pagerduty");
    expect(concepts).toContain("sev1");
  });
});
