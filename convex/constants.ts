/**
 * Shared constants for sandbox configuration.
 * Centralizes values previously duplicated across generate.ts and sandbox.ts.
 */

/** E2B template with Next.js 16 + Tailwind v4 + shadcn/ui */
export const TEMPLATE = "nextjs16-tailwind4";
/** Project directory in sandbox */
export const PROJECT_DIR = "/home/user";

/** Sandbox configuration */
export const SANDBOX_CONFIG = {
  /** Base timeout in seconds (15 minutes) — used by generate.ts actions */
  TIMEOUT_SECONDS: 900,

  /** Short timeout for sandbox.ts functions (10 minutes) */
  SHORT_TIMEOUT_SECONDS: 600,
  /** Maximum retry attempts */
  MAX_RETRIES: 3,
  /** Base retry delay in milliseconds */
  RETRY_DELAY_MS: 2000,
} as const;

/** Key files to sync between sandbox and Convex storage */
export const KEY_FILES = [
  "app/globals.css", "app/layout.tsx", "app/page.tsx",
  "schema.sql", "tailwind.config.ts", "tailwind.config.js",
  "package.json", "next.config.ts", "next.config.mjs",
  "tsconfig.json", "postcss.config.mjs", "postcss.config.js",
] as const;

/** Default template files to remove on sandbox creation */
export const TEMPLATE_CLEANUP_FILES = [
  `${PROJECT_DIR}/app/page.tsx`,
  `${PROJECT_DIR}/app/layout.tsx`,
  `${PROJECT_DIR}/app/globals.css`,
  `${PROJECT_DIR}/components/ui/resizable.tsx`,
] as const;
