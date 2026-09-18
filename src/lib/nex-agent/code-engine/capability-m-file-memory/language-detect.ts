// src/lib/nex-agent/code-engine/capability-m-file-memory/language-detect.ts
//
// NEX1 · CAPABILITY M-1 · Deterministic language classification from filename.
// Zero LLM. Pure extension + well-known-basename lookup.

/**
 * Detect a canonical language label from a filename. Case-insensitive.
 * Returns "unknown" when no match applies.
 */
export function detectLanguage(filename: string): string {
  const lower = filename.toLowerCase();

  // Well-known basenames without extension.
  const knownBasename: Record<string, string> = {
    dockerfile: "dockerfile",
    makefile: "make",
    justfile: "just",
    gemfile: "ruby",
    rakefile: "ruby",
    procfile: "procfile",
    codeowners: "text",
    license: "text",
    readme: "markdown",
    "readme.md": "markdown",
  };
  const baseOnly = lower.split(/[\\/]/).pop() ?? lower;
  if (baseOnly in knownBasename) return knownBasename[baseOnly]!;

  // Extension-based detection. Longer extensions first (defensive).
  const extensionMap: Array<[readonly string[], string]> = [
    [["ts", "tsx", "mts", "cts"], "typescript"],
    [["js", "jsx", "mjs", "cjs"], "javascript"],
    [["json", "jsonc"], "json"],
    [["yaml", "yml"], "yaml"],
    [["toml"], "toml"],
    [["md", "mdx"], "markdown"],
    [["env"], "env"],
    [["sh", "bash"], "bash"],
    [["zsh"], "zsh"],
    [["ps1", "psm1"], "powershell"],
    [["py", "pyw"], "python"],
    [["rs"], "rust"],
    [["go"], "go"],
    [["java"], "java"],
    [["kt", "kts"], "kotlin"],
    [["swift"], "swift"],
    [["rb"], "ruby"],
    [["php"], "php"],
    [["cs"], "csharp"],
    [["cpp", "cc", "cxx"], "cpp"],
    [["hpp", "hxx"], "cpp"],
    [["c"], "c"],
    [["h"], "c-header"],
    [["scss"], "scss"],
    [["sass"], "sass"],
    [["less"], "less"],
    [["css"], "css"],
    [["html", "htm"], "html"],
    [["xml"], "xml"],
    [["sql"], "sql"],
    [["prisma"], "prisma"],
    [["graphql", "gql"], "graphql"],
    [["proto"], "protobuf"],
    [["lock"], "lock"],
    [["nix"], "nix"],
    [["hcl", "tf", "tfvars"], "hcl"],
    [["dhall"], "dhall"],
    [["cue"], "cue"],
    [["jsonnet"], "jsonnet"],
    [["sol"], "solidity"],
    [["vy"], "vyper"],
    [["cairo"], "cairo"],
    [["wat"], "wat"],
    [["wgsl"], "wgsl"],
    [["glsl", "vert", "frag"], "glsl"],
    [["hlsl"], "hlsl"],
    [["r"], "r"],
    [["jl"], "julia"],
    [["ex", "exs"], "elixir"],
    [["erl"], "erlang"],
    [["hs"], "haskell"],
    [["ml", "mli"], "ocaml"],
    [["fs", "fsi", "fsx"], "fsharp"],
    [["clj", "cljs", "cljc"], "clojure"],
    [["lua"], "lua"],
    [["pl", "pm"], "perl"],
    [["dart"], "dart"],
    [["zig"], "zig"],
    [["nim"], "nim"],
  ];

  const lastDot = lower.lastIndexOf(".");
  if (lastDot < 0 || lastDot === lower.length - 1) return "unknown";
  const ext = lower.slice(lastDot + 1);
  for (const [exts, lang] of extensionMap) {
    if (exts.includes(ext)) return lang;
  }
  return "unknown";
}
