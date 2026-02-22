/**
 * Agent Tools
 *
 * Tool definitions and implementations for the three-agent system.
 * Tools are used by agents for file operations and package installation.
 *
 * Ported from: reference-code/backend-v2/tools.py
 */

/**
 * Whitelist of allowed packages (matches PACKAGE REFERENCE in architecture prompt)
 */
export const ALLOWED_PACKAGES = new Set([
  // Games
  "phaser",
  "pixi.js",
  // Charts
  "recharts",
  "@tremor/react",
  "d3",
  // Animation
  "framer-motion",
  "gsap",
  "@react-spring/web",
  // Forms
  "react-hook-form",
  "zod",
  "@hookform/resolvers",
  // Rich Content
  "@tiptap/react",
  "@tiptap/starter-kit",
  "react-markdown",
  // State
  "zustand",
  "@tanstack/react-query",
  // Interaction
  "@hello-pangea/dnd",
  "react-window",
  // Date
  "date-fns",
  "react-day-picker",
  // 3D
  "three",
  "@react-three/fiber",
  "@react-three/drei",
  // Maps
  "react-leaflet",
  "leaflet",
  // Types (auto-added when needed)
  "@types/three",
  "@types/leaflet",
  // Database
  "@supabase/supabase-js",
  "@supabase/ssr",
]);

/**
 * Validate package name format and whitelist
 */
export function validatePackageName(name: string): boolean {
  // Check format (npm package name pattern)
  const npmPattern = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
  if (!npmPattern.test(name)) {
    return false;
  }
  // Check whitelist
  return ALLOWED_PACKAGES.has(name);
}

/**
 * Interface for sandbox actions (to be injected from Convex)
 *
 * These are closures that capture sessionId/sandboxId from the outer scope.
 * This allows the tool execution functions to work without knowing the specific IDs.
 */
export interface SandboxActions {
  /** Write file to sandbox (triggers hot reload) and backup to Convex */
  writeFile: (path: string, content: string) => Promise<void>;
  /** Read file from sandbox, returns null if not found */
  readFile: (path: string) => Promise<string | null>;
  /** Delete file from sandbox */
  deleteFile: (path: string) => Promise<void>;
  /** Run command in sandbox */
  runCommand: (command: string) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  /** List files in directory */
  listFiles: (directory: string) => Promise<string[]>;
}
