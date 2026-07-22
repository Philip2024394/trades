// Web CSS exporter — DesignTokens → :root { --brand-*: ... }
// Per V3 Q15 platform exports.

import type { DesignTokens } from "../core";

export function exportWebCss(tokens: DesignTokens): string {
  const lines: string[] = [":root {"];

  // Core colours
  for (const [name, value] of Object.entries(tokens.core)) {
    lines.push(`  --brand-${kebab(name)}: ${value};`);
  }

  // Typography
  lines.push(`  --brand-font-heading: "${tokens.typography.headingFont}";`);
  lines.push(`  --brand-font-body:    "${tokens.typography.bodyFont}";`);
  lines.push(`  --brand-font-display: "${tokens.typography.displayFont}";`);

  // Spacing scale
  tokens.spacing.forEach((v, i) => lines.push(`  --brand-space-${i}: ${v}px;`));

  // Radius scale
  tokens.radius.forEach((v, i) => lines.push(`  --brand-radius-${i}: ${v}px;`));

  // Elevation shadows (web)
  tokens.elevation.forEach((e) => lines.push(`  --brand-elevation-${e.level}: ${e.webShadow};`));

  // Motion
  lines.push(`  --brand-motion-fast:   ${tokens.motion.fastMs}ms;`);
  lines.push(`  --brand-motion-normal: ${tokens.motion.normalMs}ms;`);
  lines.push(`  --brand-motion-slow:   ${tokens.motion.slowMs}ms;`);

  lines.push(`  /* token engine version: ${tokens.version} */`);
  lines.push("}");
  return lines.join("\n");
}

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
