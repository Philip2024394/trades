// src/lib/nex-agent/format-suggestions.ts
//
// When a file is uploaded, suggest a set of "target format" options for NEX1
// to consider. First option is always "keep original" · last is always
// "discuss best format for this project". Middle options are family-specific.

export interface FormatOption {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly recommended: boolean;
}

const CODE_TS = ["ts", "tsx"];
const CODE_JS = ["js", "jsx", "mjs", "cjs"];
const CODE_WEB_JS_FAMILY = new Set([...CODE_TS, ...CODE_JS]);
const CODE_PY = ["py", "pyi"];
const CODE_SYSTEMS = ["rs", "go", "c", "cpp", "h", "hpp", "swift", "kt", "java", "cs"];
const DATA_TABULAR = ["csv", "tsv", "xlsx", "xls"];
const DATA_STRUCTURED = ["json", "yaml", "yml", "toml", "xml"];
const DOCS = ["md", "markdown", "txt", "rst", "rtf", "docx", "doc", "pdf"];
const IMAGES = ["png", "jpg", "jpeg", "webp", "gif", "svg", "heic", "heif"];
const CONFIG = ["env", "ini", "conf", "yml", "yaml", "toml"];

function extOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

export function detectHumanReadableFormat(filename: string, mimeType: string): string {
  const ext = extOf(filename);
  const map: Record<string, string> = {
    ts: "TypeScript", tsx: "TypeScript (React)",
    js: "JavaScript", jsx: "JavaScript (React)", mjs: "JavaScript (ESM)", cjs: "JavaScript (CommonJS)",
    py: "Python", pyi: "Python (stub)",
    rs: "Rust", go: "Go", c: "C", cpp: "C++", h: "C header", hpp: "C++ header",
    swift: "Swift", kt: "Kotlin", java: "Java", cs: "C#",
    json: "JSON", yaml: "YAML", yml: "YAML", toml: "TOML", xml: "XML",
    md: "Markdown", markdown: "Markdown", txt: "Plain text", rst: "reStructuredText",
    rtf: "Rich text", pdf: "PDF",
    csv: "CSV", tsv: "TSV", xlsx: "Excel workbook",
    sql: "SQL", prisma: "Prisma schema",
    html: "HTML", css: "CSS", scss: "SCSS", sass: "SASS", less: "LESS",
    sh: "Shell script", bash: "Bash script", zsh: "Zsh script",
    png: "PNG image", jpg: "JPEG image", jpeg: "JPEG image", webp: "WebP image",
    gif: "GIF image", svg: "SVG vector", heic: "HEIC image", heif: "HEIF image",
    env: ".env config", ini: "INI config", conf: "Config",
    zip: "ZIP archive", tar: "TAR archive", gz: "GZipped archive",
    vue: "Vue single-file component", svelte: "Svelte component",
  };
  if (map[ext]) return `${map[ext]} (.${ext})`;
  if (mimeType.startsWith("image/")) return `Image (${mimeType})`;
  if (mimeType.startsWith("text/")) return `Text (${mimeType})`;
  return `${mimeType || "unknown"} (.${ext || "?"})`;
}

export function suggestFormats(filename: string, mimeType: string): readonly FormatOption[] {
  const ext = extOf(filename);
  const opts: FormatOption[] = [];

  // 1 · Always allow keep-as-is
  opts.push({
    id: `keep-${ext || "original"}`,
    label: ext ? `Keep as .${ext}` : "Keep original format",
    detail: `Use the file exactly as uploaded · NEX1 processes ${detectHumanReadableFormat(filename, mimeType)}`,
    recommended: true,
  });

  // 2 · Family-specific conversion options
  if (CODE_WEB_JS_FAMILY.has(ext)) {
    for (const alt of ["ts", "tsx", "js", "jsx"]) {
      if (alt === ext) continue;
      opts.push({
        id: `convert-${alt}`,
        label: `Convert to .${alt}`,
        detail: `Rewrite in ${alt.toUpperCase()} · ${alt.includes("x") ? "keeps JSX" : "removes JSX"} · ${alt.startsWith("ts") ? "adds types" : "strips types"}`,
        recommended: false,
      });
    }
  } else if (CODE_PY.includes(ext) || CODE_SYSTEMS.includes(ext)) {
    opts.push({
      id: `convert-ts`,
      label: `Convert to TypeScript`,
      detail: `Rewrite as TypeScript · idiomatic Node types where applicable`,
      recommended: false,
    });
    opts.push({
      id: `convert-js`,
      label: `Convert to JavaScript`,
      detail: `Rewrite as JavaScript · plain ES2022`,
      recommended: false,
    });
  } else if (DOCS.includes(ext)) {
    if (ext !== "md") opts.push({ id: "convert-md", label: "Convert to .md", detail: "Markdown for embedding in docs/", recommended: false });
    if (ext !== "txt") opts.push({ id: "convert-txt", label: "Convert to .txt", detail: "Plain text", recommended: false });
  } else if (DATA_TABULAR.includes(ext)) {
    opts.push({ id: "convert-json", label: "Convert to .json", detail: "JSON array of objects · one row per record", recommended: false });
    opts.push({ id: "convert-sql", label: "Convert to SQL inserts", detail: "INSERT statements · target table asked separately", recommended: false });
    opts.push({ id: "convert-ts-types", label: "Generate TypeScript types", detail: "TypeScript interfaces matching the columns", recommended: false });
  } else if (DATA_STRUCTURED.includes(ext)) {
    opts.push({ id: "convert-ts-types", label: "Generate TypeScript types", detail: "Types derived from the schema", recommended: false });
    if (ext !== "json") opts.push({ id: "convert-json", label: "Convert to .json", detail: "JSON representation", recommended: false });
  } else if (IMAGES.includes(ext)) {
    if (ext !== "webp") opts.push({ id: "convert-webp", label: "Convert to .webp", detail: "Optimized WebP · smaller file · similar quality", recommended: false });
    if (ext !== "svg") opts.push({ id: "vectorize-svg", label: "Vectorize to .svg", detail: "Trace bitmap to vector · best for logos / line art", recommended: false });
    opts.push({ id: "extract-text", label: "OCR · extract text", detail: "Read any text visible in the image", recommended: false });
    opts.push({ id: "describe-image", label: "Describe · knowledge extract", detail: "NEX1 describes the image · never verbatim copy from source", recommended: false });
  } else if (CONFIG.includes(ext)) {
    opts.push({ id: "convert-json", label: "Convert to .json", detail: "JSON version of the config", recommended: false });
    opts.push({ id: "convert-env", label: "Convert to .env", detail: "Extract key/value pairs to .env format", recommended: false });
  }

  // 3 · Universal "discuss format" option · always last
  opts.push({
    id: "discuss-format",
    label: "Discuss best format for this project",
    detail: "NEX1 analyses the file + your repo + recommends the strongest option",
    recommended: false,
  });

  return opts;
}
