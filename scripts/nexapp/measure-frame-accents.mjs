// scripts/nexapp/measure-frame-accents.mjs
//
// Scan the top strip of hud-frame-v12.png to find where the ORANGE accent
// pixels are (used for the NEX wordmark + any top-centre strip). Reports
// bounding boxes as percentages of the frame image so we can clip-preserve
// them in cinema mode.

import sharp from "sharp";
import path from "node:path";

const FRAME_PATH = path.join(process.cwd(), "public", "nex", "hud-frame-v12.png");

function isOrangeish(r, g, b, a) {
  if (a < 60) return false;
  // Orange-ish: R clearly > G > B, and reasonably saturated.
  return r > 180 && g > 60 && g < 220 && b < 140 && r - b > 60 && r - g > 15;
}

async function main() {
  const { width, height } = await sharp(FRAME_PATH).metadata();
  const raw = await sharp(FRAME_PATH).ensureAlpha().raw().toBuffer();
  console.log(`Frame: ${width} × ${height}`);
  console.log("");

  // Detect orange 2-D bounding boxes by flood-fill · captures ANY orange
  // cluster anywhere in the frame, not just the top strip.
  const visited = new Uint8Array(width * height);
  const isOrange = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const i = (y * width + x) * 4;
    return isOrangeish(raw[i], raw[i+1], raw[i+2], raw[i+3]);
  };

  const clusters = [];
  const stack = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isOrange(x, y) || visited[y * width + x]) continue;
      // Flood fill (iterative)
      let minX = x, maxX = x, minY = y, maxY = y, count = 0;
      stack.push([x, y]);
      while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        const idx = cy * width + cx;
        if (visited[idx]) continue;
        if (!isOrange(cx, cy)) continue;
        visited[idx] = 1;
        count++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        stack.push([cx + 1, cy]); stack.push([cx - 1, cy]);
        stack.push([cx, cy + 1]); stack.push([cx, cy - 1]);
      }
      // Ignore tiny stray pixels.
      if (count >= 40) clusters.push({ minX, maxX, minY, maxY, count });
    }
  }

  // Sort largest first.
  clusters.sort((a, b) => b.count - a.count);

  console.log(`Found ${clusters.length} orange cluster(s):`);
  for (const c of clusters) {
    const w = c.maxX - c.minX + 1;
    const h = c.maxY - c.minY + 1;
    const leftPct   = (c.minX / width) * 100;
    const rightPct  = ((width - 1 - c.maxX) / width) * 100;
    const topPct    = (c.minY / height) * 100;
    const bottomPct = ((height - 1 - c.maxY) / height) * 100;
    console.log(`  x ${c.minX}–${c.maxX} · y ${c.minY}–${c.maxY} · ${w}×${h} · ${c.count} px`);
    console.log(`    inset ${topPct.toFixed(2)}%  ${rightPct.toFixed(2)}%  ${bottomPct.toFixed(2)}%  ${leftPct.toFixed(2)}%   (top right bottom left)`);
  }
  console.log("");

  // Special call-out for right-side clusters (leftmost x > 60% of width).
  const rightSideClusters = clusters.filter((c) => c.minX > width * 0.60);
  console.log(`=== RIGHT-SIDE orange clusters (x > 60%) ===`);
  for (const c of rightSideClusters) {
    const w = c.maxX - c.minX + 1;
    const h = c.maxY - c.minY + 1;
    const leftPct   = (c.minX / width) * 100;
    const rightPct  = ((width - 1 - c.maxX) / width) * 100;
    const topPct    = (c.minY / height) * 100;
    const bottomPct = ((height - 1 - c.maxY) / height) * 100;
    console.log(`  ${w}×${h} · inset(${topPct.toFixed(2)}% ${rightPct.toFixed(2)}% ${bottomPct.toFixed(2)}% ${leftPct.toFixed(2)}%)`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
