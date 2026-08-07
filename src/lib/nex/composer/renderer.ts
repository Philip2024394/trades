// NEX Composer · block → HTML + plain text renderer
//
// Email HTML MUST use table-based layout + inline styles to survive
// Gmail · Outlook · Apple Mail · Yahoo. We do NOT use flexbox/grid.
// Everything renders inside a max-600px table wrapper.

import type { Block, VariableContext } from "./types";
import { interpolate } from "./variables";

// ── HTML escaping ─────────────────────────────────────────────────
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function attrEsc(s: string): string { return esc(s); }

// ── Layout ────────────────────────────────────────────────────────
const WRAPPER_OPEN = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{SUBJECT}}</title>
</head>
<body style="margin:0;padding:0;background:#f5f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
<div style="display:none;max-height:0;overflow:hidden;">{{PREVIEW}}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f6f7;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="padding:0;">`;

const WRAPPER_CLOSE = `</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

// ── Block renderers ───────────────────────────────────────────────
function renderBlock(block: Block, ctx: VariableContext, opts: { resolveUnsubscribe: boolean }): string {
  const i = (s: string) => interpolate(s, ctx, { resolveUnsubscribe: opts.resolveUnsubscribe });
  const align = "align" in block && block.align ? block.align : "left";

  switch (block.type) {
    case "heading": {
      const size  = block.level === 1 ? "28px" : block.level === 2 ? "22px" : "18px";
      const tag   = `h${block.level}`;
      return `<div style="padding:16px 24px 4px;text-align:${align};"><${tag} style="margin:0;font-size:${size};line-height:1.25;font-weight:800;">${esc(i(block.text))}</${tag}></div>`;
    }
    case "paragraph": {
      return `<div style="padding:8px 24px;font-size:15px;line-height:1.55;text-align:${align};">${esc(i(block.text)).replace(/\n/g, "<br>")}</div>`;
    }
    case "image": {
      const w   = block.width_pct ?? 100;
      const img = `<img src="${attrEsc(block.src)}" alt="${attrEsc(i(block.alt))}" style="width:${w}%;max-width:100%;height:auto;display:block;border:0;" />`;
      const wrapped = block.href ? `<a href="${attrEsc(i(block.href))}" style="display:block;">${img}</a>` : img;
      return `<div style="padding:12px 24px;text-align:${align};">${wrapped}</div>`;
    }
    case "button": {
      const bg   = block.bg ?? "#1a73e8";
      const fg   = block.color ?? "#ffffff";
      return `<div style="padding:12px 24px;text-align:${align};"><a href="${attrEsc(i(block.href))}" style="display:inline-block;padding:12px 22px;background:${bg};color:${fg};text-decoration:none;font-weight:700;border-radius:6px;font-size:15px;">${esc(i(block.text))}</a></div>`;
    }
    case "divider": {
      const color = block.color ?? "#e5e7eb";
      return `<div style="padding:12px 24px;"><div style="height:1px;background:${color};line-height:1px;">&nbsp;</div></div>`;
    }
    case "spacer": {
      return `<div style="height:${Math.max(4, Math.min(120, block.height))}px;line-height:1px;">&nbsp;</div>`;
    }
    case "columns": {
      const cols = block.columns.length;
      const w = Math.floor(100 / Math.max(1, cols));
      const cells = block.columns.map((col) => `<td valign="top" width="${w}%" style="padding:0 8px;vertical-align:top;">${col.map((b) => renderBlock(b, ctx, opts)).join("")}</td>`).join("");
      return `<div style="padding:8px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table></div>`;
    }
    case "hero": {
      const bg = block.bg ?? "#0f172a";
      const img = block.src ? `<img src="${attrEsc(block.src)}" alt="" style="width:100%;height:auto;display:block;border:0;" />` : "";
      const sub = block.subheading ? `<div style="font-size:15px;color:#e5e7eb;margin-top:8px;">${esc(i(block.subheading))}</div>` : "";
      const cta = block.cta_text && block.cta_href
        ? `<div style="margin-top:16px;"><a href="${attrEsc(i(block.cta_href))}" style="display:inline-block;padding:12px 22px;background:#ffffff;color:${bg};text-decoration:none;font-weight:700;border-radius:6px;font-size:15px;">${esc(i(block.cta_text))}</a></div>`
        : "";
      return `<div>${img}<div style="padding:32px 24px;background:${bg};color:#ffffff;text-align:center;"><div style="font-size:26px;font-weight:800;line-height:1.2;">${esc(i(block.heading))}</div>${sub}${cta}</div></div>`;
    }
    case "feature_grid": {
      const items = block.features.map((f) => `<td valign="top" width="33%" style="padding:12px;vertical-align:top;text-align:center;">${f.icon ? `<div style="font-size:24px;margin-bottom:6px;">${esc(f.icon)}</div>` : ""}<div style="font-weight:700;font-size:15px;margin-bottom:4px;">${esc(i(f.title))}</div><div style="font-size:13px;color:#4b5563;">${esc(i(f.body))}</div></td>`).join("");
      return `<div style="padding:8px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${items}</tr></table></div>`;
    }
    case "cta": {
      const bg = block.bg ?? "#f3f4f6";
      const body = block.body ? `<div style="margin-top:6px;font-size:14px;color:#4b5563;">${esc(i(block.body))}</div>` : "";
      return `<div style="padding:16px 24px;"><div style="padding:24px;background:${bg};border-radius:8px;text-align:${align};"><div style="font-size:18px;font-weight:700;">${esc(i(block.heading))}</div>${body}<div style="margin-top:14px;"><a href="${attrEsc(i(block.cta_href))}" style="display:inline-block;padding:12px 22px;background:#1a73e8;color:#ffffff;text-decoration:none;font-weight:700;border-radius:6px;font-size:15px;">${esc(i(block.cta_text))}</a></div></div></div>`;
    }
    case "gallery": {
      // 3-per-row, wrap
      const cells = block.items.map((it) => {
        const img = `<img src="${attrEsc(it.src)}" alt="${attrEsc(i(it.alt))}" style="width:100%;height:auto;display:block;border:0;" />`;
        const wrapped = it.href ? `<a href="${attrEsc(i(it.href))}">${img}</a>` : img;
        return `<td valign="top" width="33%" style="padding:4px;vertical-align:top;">${wrapped}</td>`;
      });
      const rows: string[] = [];
      for (let n = 0; n < cells.length; n += 3) rows.push(`<tr>${cells.slice(n, n + 3).join("")}</tr>`);
      return `<div style="padding:8px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join("")}</table></div>`;
    }
    case "signature": {
      const photo = block.photo_src ? `<td width="72" style="padding-right:12px;vertical-align:top;"><img src="${attrEsc(block.photo_src)}" alt="" width="60" style="border-radius:30px;display:block;" /></td>` : "";
      const roleCompany = [block.role, block.company].filter(Boolean).join(" · ");
      const contact = [block.email, block.phone].filter(Boolean).map((c) => esc(String(c))).join(" · ");
      return `<div style="padding:16px 24px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${photo}<td style="vertical-align:top;font-size:13px;line-height:1.5;"><div style="font-weight:700;">${esc(block.name)}</div>${roleCompany ? `<div style="color:#4b5563;">${esc(roleCompany)}</div>` : ""}${contact ? `<div style="color:#6b7280;margin-top:4px;">${contact}</div>` : ""}</td></tr></table></div>`;
    }
    case "footer": {
      const unsub = block.unsubscribe_text ?? "Unsubscribe";
      const addr  = block.address ? `<div style="margin-top:6px;">${esc(block.address)}</div>` : "";
      return `<div style="padding:24px;background:#f9fafb;color:#6b7280;font-size:12px;text-align:center;line-height:1.6;"><div>© ${esc(String(new Date().getFullYear()))} ${esc(block.company)}${addr}</div><div style="margin-top:10px;"><a href="${opts.resolveUnsubscribe ? attrEsc(ctx.unsubscribe_link ?? "#") : "{{unsubscribe_link}}"}" style="color:#6b7280;text-decoration:underline;">${esc(unsub)}</a></div></div>`;
    }
    case "social_links": {
      const parts = block.links.map((l) => `<a href="${attrEsc(l.href)}" style="color:#6b7280;text-decoration:none;margin:0 8px;font-size:13px;">${esc(l.label ?? l.platform)}</a>`).join("");
      return `<div style="padding:12px 24px;text-align:center;">${parts}</div>`;
    }
  }
}

// ── Public API ────────────────────────────────────────────────────
export type RenderOptions = {
  subject?: string;
  preview_text?: string;
  variables?: VariableContext;
  resolveUnsubscribe?: boolean;                // true for preview · false for send-time (Runtime injects per-recipient)
};

export function renderBlocksToHtml(blocks: Block[], opts: RenderOptions = {}): string {
  const ctx = opts.variables ?? {};
  const inner = blocks.map((b) => renderBlock(b, ctx, { resolveUnsubscribe: opts.resolveUnsubscribe === true })).join("");
  return WRAPPER_OPEN.replace("{{SUBJECT}}", esc(opts.subject ?? "")).replace("{{PREVIEW}}", esc(opts.preview_text ?? "")) + inner + WRAPPER_CLOSE;
}

export function renderBlocksToPlainText(blocks: Block[], opts: RenderOptions = {}): string {
  const ctx = opts.variables ?? {};
  const i = (s: string) => interpolate(s, ctx, { resolveUnsubscribe: opts.resolveUnsubscribe === true });
  const lines: string[] = [];
  const walk = (block: Block): void => {
    switch (block.type) {
      case "heading":      lines.push(""); lines.push(i(block.text).toUpperCase()); lines.push("=".repeat(Math.min(60, i(block.text).length))); break;
      case "paragraph":    lines.push(""); lines.push(i(block.text)); break;
      case "image":        if (block.alt) lines.push(`[image: ${i(block.alt)}]`); break;
      case "button":       lines.push(""); lines.push(`${i(block.text)}: ${i(block.href)}`); break;
      case "divider":      lines.push(""); lines.push("-".repeat(40)); break;
      case "spacer":       lines.push(""); break;
      case "columns":      block.columns.flat().forEach(walk); break;
      case "hero":         lines.push(""); lines.push(i(block.heading).toUpperCase()); if (block.subheading) lines.push(i(block.subheading)); if (block.cta_text && block.cta_href) lines.push(`${i(block.cta_text)}: ${i(block.cta_href)}`); break;
      case "feature_grid": block.features.forEach((f) => { lines.push(""); lines.push(`• ${i(f.title)}`); lines.push(`  ${i(f.body)}`); }); break;
      case "cta":          lines.push(""); lines.push(i(block.heading)); if (block.body) lines.push(i(block.body)); lines.push(`${i(block.cta_text)}: ${i(block.cta_href)}`); break;
      case "gallery":      block.items.forEach((it) => { if (it.alt) lines.push(`[${i(it.alt)}]`); }); break;
      case "signature":    lines.push(""); lines.push(`— ${block.name}${block.role ? `, ${block.role}` : ""}${block.company ? ` · ${block.company}` : ""}`); if (block.email) lines.push(block.email); if (block.phone) lines.push(block.phone); break;
      case "footer":       lines.push(""); lines.push(`© ${new Date().getFullYear()} ${block.company}`); if (block.address) lines.push(block.address); lines.push(`Unsubscribe: ${opts.resolveUnsubscribe ? (ctx.unsubscribe_link ?? "") : "{{unsubscribe_link}}"}`); break;
      case "social_links": lines.push(""); lines.push(block.links.map((l) => `${l.platform}: ${l.href}`).join("  ")); break;
    }
  };
  blocks.forEach(walk);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
