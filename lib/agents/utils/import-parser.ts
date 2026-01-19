/**
 * Import Parser Utility
 *
 * Extracts import statements from TypeScript/TSX files to build
 * a dependency graph for intelligent file resolution.
 */

/**
 * Represents a parsed import statement
 */
export interface ParsedImport {
  /** The import specifier (what's being imported) */
  specifier: string;
  /** Resolved file path (relative to project root) */
  resolvedPath: string | null;
  /** Named imports (e.g., { Button, Card }) */
  namedImports: string[];
  /** Default import name (e.g., React from 'react') */
  defaultImport: string | null;
  /** Whether this is a namespace import (import * as X) */
  isNamespace: boolean;
  /** Whether this is a type-only import */
  isTypeOnly: boolean;
  /** Whether this is an external package (node_modules) */
  isExternal: boolean;
  /** Original line number in the file */
  lineNumber: number;
}

/**
 * Result of parsing a file's imports
 */
export interface ImportParseResult {
  /** Path of the parsed file */
  filePath: string;
  /** All imports found in the file */
  imports: ParsedImport[];
  /** Local file imports (resolved paths) */
  localDependencies: string[];
  /** External package imports */
  externalDependencies: string[];
  /** Export statements (for reverse dependency tracking) */
  exports: ParsedExport[];
}

/**
 * Represents a parsed export statement
 */
export interface ParsedExport {
  /** Name being exported */
  name: string;
  /** Whether this is a default export */
  isDefault: boolean;
  /** Whether this is a type export */
  isType: boolean;
  /** Line number */
  lineNumber: number;
}

/**
 * Regex patterns for import parsing
 */
const IMPORT_PATTERNS = {
  // Standard import: import X from 'path' or import { X } from 'path'
  standard: /^import\s+(?:type\s+)?(?:(\*\s+as\s+\w+|\w+)?\s*,?\s*)?(?:\{([^}]+)\})?\s*from\s*['"]([^'"]+)['"]/gm,
  // Side-effect import: import 'path'
  sideEffect: /^import\s+['"]([^'"]+)['"]/gm,
  // Dynamic import: import('path')
  dynamic: /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Re-export: export { X } from 'path'
  reExport: /^export\s+(?:type\s+)?(?:\{([^}]+)\})?\s*from\s*['"]([^'"]+)['"]/gm,
  // Named export: export const X or export function X
  namedExport: /^export\s+(?:type\s+)?(const|let|var|function|class|interface|type|enum)\s+(\w+)/gm,
  // Default export: export default X
  defaultExport: /^export\s+default\s+(?:class\s+|function\s+)?(\w+)?/gm,
};

/**
 * Common path aliases in Next.js projects
 */
const PATH_ALIASES: Record<string, string> = {
  "@/": "",
  "~/": "",
  "@components/": "components/",
  "@lib/": "lib/",
  "@utils/": "utils/",
  "@hooks/": "hooks/",
  "@styles/": "styles/",
  "@types/": "types/",
};

/**
 * Known external packages (don't try to resolve these)
 */
const EXTERNAL_PACKAGES = new Set([
  "react",
  "react-dom",
  "next",
  "next/",
  "@next/",
  "@types/",
  "typescript",
  "tailwindcss",
  "@tailwindcss/",
  "postcss",
  "autoprefixer",
  "clsx",
  "class-variance-authority",
  "tailwind-merge",
  "lucide-react",
  "@radix-ui/",
  "@shadcn/",
  "zod",
  "zustand",
  "jotai",
  "framer-motion",
  "date-fns",
  "lodash",
  "axios",
  "@tanstack/",
  "swr",
  "convex",
  "@anthropic-ai/",
  "langchain",
  "@langchain/",
]);

/**
 * Check if an import specifier is an external package
 */
function isExternalPackage(specifier: string): boolean {
  // Relative imports are never external
  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    return false;
  }

  // Check against known external packages
  for (const pkg of EXTERNAL_PACKAGES) {
    if (specifier === pkg || specifier.startsWith(pkg)) {
      return true;
    }
  }

  // Scoped packages (@org/pkg) are typically external
  if (specifier.startsWith("@") && !specifier.startsWith("@/")) {
    return true;
  }

  // Bare specifiers without relative paths are usually external
  return !specifier.includes("/") || specifier.split("/").length <= 2;
}

/**
 * Resolve an import specifier to a file path
 */
function resolveImportPath(
  specifier: string,
  fromFilePath: string,
  existingFiles: string[]
): string | null {
  // External packages don't resolve to local files
  if (isExternalPackage(specifier)) {
    return null;
  }

  let resolvedSpec = specifier;

  // Handle path aliases
  for (const [alias, replacement] of Object.entries(PATH_ALIASES)) {
    if (specifier.startsWith(alias)) {
      resolvedSpec = specifier.replace(alias, replacement);
      break;
    }
  }

  // Handle relative imports
  if (resolvedSpec.startsWith(".")) {
    const fromDir = fromFilePath.split("/").slice(0, -1).join("/");
    resolvedSpec = normalizePath(fromDir + "/" + resolvedSpec);
  }

  // Try different extensions
  const extensions = [".tsx", ".ts", ".jsx", ".js", ""];
  const indexFiles = ["/index.tsx", "/index.ts", "/index.jsx", "/index.js"];

  for (const ext of extensions) {
    const candidate = resolvedSpec + ext;
    if (existingFiles.includes(candidate)) {
      return candidate;
    }
  }

  // Try index files
  for (const indexFile of indexFiles) {
    const candidate = resolvedSpec + indexFile;
    if (existingFiles.includes(candidate)) {
      return candidate;
    }
  }

  // Try without leading slash
  if (resolvedSpec.startsWith("/")) {
    const withoutSlash = resolvedSpec.slice(1);
    for (const ext of extensions) {
      const candidate = withoutSlash + ext;
      if (existingFiles.includes(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * Normalize a file path (resolve . and ..)
 */
function normalizePath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  const normalized: string[] = [];

  for (const part of parts) {
    if (part === "..") {
      normalized.pop();
    } else if (part !== ".") {
      normalized.push(part);
    }
  }

  return normalized.join("/");
}

/**
 * Parse named imports from a string like "Button, Card as MyCard, type ButtonProps"
 */
function parseNamedImports(namedStr: string): { names: string[]; hasTypes: boolean } {
  const names: string[] = [];
  let hasTypes = false;

  const items = namedStr.split(",").map((s) => s.trim()).filter(Boolean);

  for (const item of items) {
    // Handle "type X" syntax
    if (item.startsWith("type ")) {
      hasTypes = true;
      const name = item.replace("type ", "").split(" as ")[0].trim();
      names.push(name);
    } else {
      // Handle "X as Y" syntax - use the original name
      const name = item.split(" as ")[0].trim();
      names.push(name);
    }
  }

  return { names, hasTypes };
}

/**
 * Parse all imports from a TypeScript/TSX file
 */
export function parseImports(
  filePath: string,
  fileContent: string,
  existingFiles: string[] = []
): ImportParseResult {
  const imports: ParsedImport[] = [];
  const exports: ParsedExport[] = [];
  const lines = fileContent.split("\n");

  // Track line numbers for each import
  let lineNumber = 0;

  for (const line of lines) {
    lineNumber++;
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith("//") || trimmedLine.startsWith("/*")) {
      continue;
    }

    // Parse standard imports
    const standardMatch = trimmedLine.match(
      /^import\s+(type\s+)?(?:(\*\s+as\s+(\w+)|(\w+))?\s*,?\s*)?(?:\{([^}]+)\})?\s*from\s*['"]([^'"]+)['"]/
    );

    if (standardMatch) {
      const [, typeKeyword, , namespaceAs, defaultImport, namedStr, specifier] = standardMatch;
      const isTypeOnly = !!typeKeyword;
      const isNamespace = !!namespaceAs;
      const isExternal = isExternalPackage(specifier);

      let namedImports: string[] = [];
      if (namedStr) {
        const parsed = parseNamedImports(namedStr);
        namedImports = parsed.names;
      }

      const resolvedPath = resolveImportPath(specifier, filePath, existingFiles);

      imports.push({
        specifier,
        resolvedPath,
        namedImports,
        defaultImport: defaultImport || null,
        isNamespace,
        isTypeOnly,
        isExternal,
        lineNumber,
      });
      continue;
    }

    // Parse side-effect imports
    const sideEffectMatch = trimmedLine.match(/^import\s+['"]([^'"]+)['"]/);
    if (sideEffectMatch) {
      const [, specifier] = sideEffectMatch;
      const isExternal = isExternalPackage(specifier);
      const resolvedPath = resolveImportPath(specifier, filePath, existingFiles);

      imports.push({
        specifier,
        resolvedPath,
        namedImports: [],
        defaultImport: null,
        isNamespace: false,
        isTypeOnly: false,
        isExternal,
        lineNumber,
      });
      continue;
    }

    // Parse exports
    const namedExportMatch = trimmedLine.match(
      /^export\s+(type\s+)?(const|let|var|function|class|interface|type|enum)\s+(\w+)/
    );
    if (namedExportMatch) {
      const [, typeKeyword, , name] = namedExportMatch;
      exports.push({
        name,
        isDefault: false,
        isType: !!typeKeyword || ["interface", "type"].includes(namedExportMatch[2]),
        lineNumber,
      });
      continue;
    }

    const defaultExportMatch = trimmedLine.match(
      /^export\s+default\s+(?:class\s+|function\s+)?(\w+)?/
    );
    if (defaultExportMatch) {
      exports.push({
        name: defaultExportMatch[1] || "default",
        isDefault: true,
        isType: false,
        lineNumber,
      });
    }
  }

  // Also check for dynamic imports throughout the file
  const dynamicMatches = fileContent.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
  for (const match of dynamicMatches) {
    const specifier = match[1];
    const isExternal = isExternalPackage(specifier);
    const resolvedPath = resolveImportPath(specifier, filePath, existingFiles);

    // Check if we already have this import
    if (!imports.some((i) => i.specifier === specifier)) {
      imports.push({
        specifier,
        resolvedPath,
        namedImports: [],
        defaultImport: null,
        isNamespace: false,
        isTypeOnly: false,
        isExternal,
        lineNumber: 0, // Dynamic imports can be anywhere
      });
    }
  }

  // Build dependency lists
  const localDependencies = imports
    .filter((i) => !i.isExternal && i.resolvedPath)
    .map((i) => i.resolvedPath as string);

  const externalDependencies = [...new Set(
    imports
      .filter((i) => i.isExternal)
      .map((i) => {
        // Get package name (first part of scoped packages, or first segment)
        if (i.specifier.startsWith("@")) {
          const parts = i.specifier.split("/");
          return parts.slice(0, 2).join("/");
        }
        return i.specifier.split("/")[0];
      })
  )];

  return {
    filePath,
    imports,
    localDependencies: [...new Set(localDependencies)],
    externalDependencies,
    exports,
  };
}

/**
 * Build a dependency graph for all files in a project
 */
export function buildDependencyGraph(
  files: Map<string, string>
): Map<string, ImportParseResult> {
  const existingFiles = Array.from(files.keys());
  const graph = new Map<string, ImportParseResult>();

  for (const [filePath, content] of files.entries()) {
    // Only parse TypeScript/JavaScript files
    if (!/\.(tsx?|jsx?|mjs)$/.test(filePath)) {
      continue;
    }

    const result = parseImports(filePath, content, existingFiles);
    graph.set(filePath, result);
  }

  return graph;
}

/**
 * Get all files that import a specific file (reverse dependencies)
 */
export function getImporters(
  targetFile: string,
  graph: Map<string, ImportParseResult>
): string[] {
  const importers: string[] = [];

  for (const [filePath, result] of graph.entries()) {
    if (result.localDependencies.includes(targetFile)) {
      importers.push(filePath);
    }
  }

  return importers;
}

/**
 * Get the transitive closure of dependencies for a file
 */
export function getTransitiveDependencies(
  filePath: string,
  graph: Map<string, ImportParseResult>,
  visited = new Set<string>()
): string[] {
  if (visited.has(filePath)) {
    return [];
  }
  visited.add(filePath);

  const result = graph.get(filePath);
  if (!result) {
    return [];
  }

  const deps: string[] = [...result.localDependencies];

  for (const dep of result.localDependencies) {
    deps.push(...getTransitiveDependencies(dep, graph, visited));
  }

  return [...new Set(deps)];
}

/**
 * Get files that export a specific name
 */
export function findExporters(
  exportName: string,
  graph: Map<string, ImportParseResult>
): string[] {
  const exporters: string[] = [];

  for (const [filePath, result] of graph.entries()) {
    if (result.exports.some((e) => e.name === exportName)) {
      exporters.push(filePath);
    }
  }

  return exporters;
}
