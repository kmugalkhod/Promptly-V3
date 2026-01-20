/**
 * Utility for mapping file extensions to Monaco editor language identifiers
 */

const languageMap: Record<string, string> = {
  // TypeScript/JavaScript
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",

  // Web
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",

  // Data formats
  json: "json",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",

  // Documentation
  md: "markdown",
  mdx: "markdown",

  // Config files
  env: "plaintext",
  gitignore: "plaintext",
  dockerignore: "plaintext",

  // Other languages
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sql: "sql",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  ps1: "powershell",
  graphql: "graphql",
  gql: "graphql",
};

/**
 * Get Monaco editor language identifier from a file path
 * @param filePath - The file path (e.g., "app/page.tsx" or "styles.css")
 * @returns Monaco language identifier (e.g., "typescript", "css", "plaintext")
 */
export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  return languageMap[ext || ""] || "plaintext";
}
