/**
 * Prompts Module
 *
 * Exports all system prompts for the three-agent architecture.
 */

export { ARCHITECTURE_PROMPT } from "./architecture";
export { CODER_PROMPT, formatCoderRetryPrompt } from "./coder";
export { SCHEMA_PROMPT, formatSchemaRetryPrompt } from "./schema";
export { validateGlobalsCss } from "./shared";
