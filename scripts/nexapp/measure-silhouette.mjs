import sharp from "sharp";
import path from "node:path";
const FRAME = path.join(process.cwd(), "public", "nex", "hud-frame-v12.png");
const img = sharp(FRAME).ensureAlpha();
const { width, height } = await img.metadata();
const raw = await img.raw().toBuffer();

// Find leftmost and rightmost columns that have ANY opaque pixel
let leftX = width, rightX = -1, topY = height, bottomY = -1;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const alpha = raw[(y * width + x) * 4 + 3];
    if (alpha > 8) {
      if (x < leftX) leftX = x;
      if (x > rightX) rightX = x;
      if (y < topY) topY = y;
      if (y > bottomY) bottomY = y;
    }
  }
}

const silhWidth = rightX - leftX + 1;
const silhHeight = bottomY - topY + 1;
console.log(`PNG dimensions       : ${width} × ${height}`);
console.log(`Silhouette bounds    : x [${leftX}..${rightX}]  y [${topY}..${bottomY}]`);
console.log(`Silhouette size      : ${silhWidth} × ${silhHeight}  aspect ${(silhWidth/silhHeight).toFixed(4)}`);
console.log(`Padding L/R          : ${leftX} / ${width - 1 - rightX}`);
console.log(`Padding T/B          : ${topY} / ${height - 1 - bottomY}`);
console.log(`\nPNG aspect (current) : ${(width/height).toFixed(4)}`);
console.log(`Silhouette aspect    : ${(silhWidth/silhHeight).toFixed(4)}`);
if (leftX > 0 || rightX < width - 1 || topY > 0 || bottomY < height - 1) {
  console.log("\n⚠  PNG has transparent padding — CSS aspect ratio should use silhouette dims, not PNG dims.");
}
