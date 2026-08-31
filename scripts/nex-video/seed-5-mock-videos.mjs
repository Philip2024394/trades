// scripts/nex-video/seed-5-mock-videos.mjs
//
// Generates 5 short mock videos locally using ffmpeg-static (test patterns +
// sine tone · CC0 · no third-party download) and uploads each to NEX Media
// Foundation via /api/nex-media/upload with visibility=public so /nex-video
// and NEX LIVE can swipe through them.
//
// Philip 2026-08-27 · one-off dev seed for the LIVE surface prototype.

import { spawn } from "node:child_process";
import { readFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";

process.env.NEX_OBJECT_BACKEND = "postgres";
const BASE = "http://localhost:3008";
const OWNER = "nex-live-mock";

const VIDEOS = [
  { title: "NEX LIVE · orange field",  filter: "color=c=0xf97316:s=720x1280,drawtext=text='NEX LIVE 1':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2", desc: "Test pattern 1 · orange" },
  { title: "NEX LIVE · deep blue",     filter: "color=c=0x1e3a8a:s=720x1280,drawtext=text='NEX LIVE 2':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2", desc: "Test pattern 2 · blue" },
  { title: "NEX LIVE · emerald",       filter: "color=c=0x10b981:s=720x1280,drawtext=text='NEX LIVE 3':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2", desc: "Test pattern 3 · green" },
  { title: "NEX LIVE · magenta",       filter: "color=c=0xdb2777:s=720x1280,drawtext=text='NEX LIVE 4':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2", desc: "Test pattern 4 · magenta" },
  { title: "NEX LIVE · slate",         filter: "color=c=0x334155:s=720x1280,drawtext=text='NEX LIVE 5':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2", desc: "Test pattern 5 · slate" },
];

async function findFfmpeg() {
  try {
    const mod = await import("ffmpeg-static");
    return (mod).default ?? mod;
  } catch { return null; }
}

function runFfmpeg(bin, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err += d.toString(); });
    p.on("error", reject);
    p.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code} · ${err.slice(-200)}`)));
  });
}

async function generateVideo(bin, index, filter, outPath) {
  // 5-second test pattern MP4 · 720x1280 vertical (feed-friendly) · H.264 + AAC
  // Uses the drawtext filter which requires the fontfile filter option not to be set —
  // ffmpeg will use its default font if available. If drawtext fails, we fall back
  // to a plain color source without text.
  const args = [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", filter + `,format=yuv420p`,
    "-f", "lavfi", "-i", `sine=frequency=${300 + index * 60}:duration=5`,
    "-c:v", "libx264", "-t", "5", "-r", "30", "-preset", "veryfast",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart",
    outPath,
  ];
  try {
    await runFfmpeg(bin, args);
  } catch (e) {
    // drawtext requires libfreetype; retry without drawtext
    const plainFilter = filter.split(",drawtext=")[0];
    const args2 = [
      "-y", "-hide_banner", "-loglevel", "error",
      "-f", "lavfi", "-i", plainFilter + ",format=yuv420p",
      "-f", "lavfi", "-i", `sine=frequency=${300 + index * 60}:duration=5`,
      "-c:v", "libx264", "-t", "5", "-r", "30", "-preset", "veryfast",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      outPath,
    ];
    await runFfmpeg(bin, args2);
  }
}

async function main() {
  console.log("═══════ NEX LIVE · seed 5 mock videos ═══════");
  const ff = await findFfmpeg();
  if (!ff) { console.error("ffmpeg-static not installed"); process.exit(1); }
  console.log("  ffmpeg:", ff);

  const dir = path.join(tmpdir(), "nex-mock-videos");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const uploaded = [];
  for (let i = 0; i < VIDEOS.length; i++) {
    const v = VIDEOS[i];
    const out = path.join(dir, `nex-mock-${i + 1}.mp4`);
    console.log(`\n  [${i + 1}/5] Generating ${v.title}…`);
    try {
      await generateVideo(ff, i, v.filter, out);
      const bytes = readFileSync(out);
      console.log(`      generated · ${bytes.length} bytes`);

      // Upload via NEX Media Foundation direct multipart endpoint.
      const fd = new FormData();
      fd.append("file", new File([bytes], `nex-mock-${i + 1}.mp4`, { type: "video/mp4" }));
      fd.append("owner_id", OWNER);
      fd.append("object_type", "video");
      fd.append("visibility", "public");
      fd.append("context_type", "feed");
      fd.append("title", v.title);
      fd.append("description", v.desc);
      fd.append("duration_ms", "5000");
      fd.append("width_px", "720");
      fd.append("height_px", "1280");
      fd.append("codec", "h264");

      const res = await fetch(`${BASE}/api/nex-media/upload`, { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(`upload failed · ${j.error ?? res.status}`);
      console.log(`      uploaded · media_id=${j.media.media_id.slice(0, 8)} · state=${j.media.state}`);
      uploaded.push(j.media);

      // Fire-and-forget poster
      void fetch(`${BASE}/api/nex-media/thumbnail/${j.media.media_id}`, { method: "POST" }).catch(() => {});
    } catch (e) {
      console.error(`      failed · ${e.message}`);
    } finally {
      try { unlinkSync(out); } catch {}
    }
  }

  console.log("\n═══════════════════════════════════════");
  console.log(`  Uploaded: ${uploaded.length}/${VIDEOS.length}`);
  console.log(`  Owner: ${OWNER}`);
  console.log(`  Visibility: public · will appear in /nex-video + NEX LIVE surface`);
  console.log("═══════════════════════════════════════");
  process.exit(uploaded.length === VIDEOS.length ? 0 : 1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(2); });
