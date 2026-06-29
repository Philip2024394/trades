// Tiny server-side Markdown renderer for newsroom posts.
//
// We deliberately don't pull in `remark`/`remark-html` — the body
// vocabulary across the seed posts is small (h2 / h3 / paragraphs /
// bullet and numeric lists / **bold** / *italic* / [text](url)). A
// 100-line parser ships zero kB of client-side JS, no extra runtime
// dependency, and gives us full control over the HTML emitted.
//
// All output is HTML-escaped first, then re-decorated with the inline
// formatters. Links are restricted to http(s):// and / only — no
// javascript: schemes. Used by /news/[slug] via dangerouslySetInnerHTML
// (safe because we escape all input and only emit a known whitelist).

const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c] ?? c);
}

function safeHref(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith("/")) return v;
  if (/^mailto:/i.test(v)) return v;
  if (/^https?:\/\//i.test(v)) return v;
  return null;
}

// Inline formatting — bold, italic, links, simple code spans.
// Operates on already-HTML-escaped text so the markdown punctuation
// can be safely re-introduced as tags.
function inline(text: string): string {
  let out = text;
  // Links — [label](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const href = safeHref(url);
    if (!href) return escapeHtml(`[${label}](${url})`);
    return `<a href="${href}" class="text-neutral-900 underline underline-offset-2 hover:text-neutral-700" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  // Code spans — `code`
  out = out.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-neutral-100 px-1 py-0.5 text-[13px] text-neutral-800">$1</code>'
  );
  // Bold — **text**
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Italic — *text* (not when preceded/followed by an alpha to avoid
  // chewing into intra-word punctuation)
  out = out.replace(
    /(^|[^A-Za-z0-9])\*([^*\n]+)\*(?=[^A-Za-z0-9]|$)/g,
    "$1<em>$2</em>"
  );
  return out;
}

export function renderNewsMarkdown(input: string): string {
  if (!input) return "";
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i] ?? "";
    const line = raw.trimEnd();

    // Blank — close any open paragraph (handled implicitly by emit
    // boundaries) and skip.
    if (!line.trim()) {
      i++;
      continue;
    }

    // Headings — # / ## / ### (we cap at h3 for the body; h1 is the
    // post title and rendered separately).
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const txt = inline(escapeHtml(h[2]));
      const cls =
        level === 1
          ? "mt-10 text-2xl font-extrabold leading-snug text-neutral-900 sm:text-3xl"
          : level === 2
            ? "mt-10 text-xl font-extrabold leading-snug text-neutral-900 sm:text-2xl"
            : "mt-8 text-lg font-extrabold leading-snug text-neutral-900 sm:text-xl";
      out.push(`<h${level} class="${cls}">${txt}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote — > line
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? "")) {
        buf.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i++;
      }
      const inner = inline(escapeHtml(buf.join(" ")));
      out.push(
        `<blockquote class="my-6 rounded-2xl border-l-4 border-[#FFB300] bg-neutral-50 p-4 text-[14px] leading-relaxed text-neutral-800 sm:text-[15px]">${inner}</blockquote>`
      );
      continue;
    }

    // Unordered list — - item / * item
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^[-*]\s+/, ""));
        i++;
      }
      const lis = items
        .map((t) => `<li>${inline(escapeHtml(t))}</li>`)
        .join("");
      out.push(
        `<ul class="my-4 ml-5 list-disc space-y-2 text-[15px] leading-relaxed text-neutral-700 sm:text-base">${lis}</ul>`
      );
      continue;
    }

    // Ordered list — 1. item
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\d+\.\s+/, ""));
        i++;
      }
      const lis = items
        .map((t) => `<li>${inline(escapeHtml(t))}</li>`)
        .join("");
      out.push(
        `<ol class="my-4 ml-5 list-decimal space-y-2 text-[15px] leading-relaxed text-neutral-700 sm:text-base">${lis}</ol>`
      );
      continue;
    }

    // Paragraph — consecutive non-blank, non-special lines fuse.
    const buf: string[] = [line];
    i++;
    while (i < lines.length) {
      const peek = lines[i] ?? "";
      if (!peek.trim()) break;
      if (/^(#{1,3})\s+/.test(peek)) break;
      if (/^[-*]\s+/.test(peek)) break;
      if (/^\d+\.\s+/.test(peek)) break;
      if (/^>\s?/.test(peek)) break;
      buf.push(peek.trim());
      i++;
    }
    const para = inline(escapeHtml(buf.join(" ")));
    out.push(
      `<p class="mt-4 text-[15px] leading-relaxed text-neutral-700 sm:text-base">${para}</p>`
    );
  }

  return out.join("\n");
}

// Word-count → reading time in minutes (~200 wpm, ceiling 2 min floor).
export function readingMinutes(input: string): number {
  if (!input) return 2;
  const words = input
    .replace(/[`#*_>\[\](){}]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(2, Math.round(words / 200));
}
