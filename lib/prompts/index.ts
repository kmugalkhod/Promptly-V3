/**
 * Prompts Module
 *
 * Exports all system prompts for the three-agent architecture.
 */

export { ARCHITECTURE_PROMPT } from "./architecture";
export { CODER_PROMPT } from "./coder";
export {
  CHAT_PROMPT_WITH_EDIT_SCOPE,
  formatChatPromptWithEditScope,
} from "./chat";
export {
  COMMON_ERROR_FIXES,
  TAILWIND_V4_RULES,
  FONT_RULES,
  DESIGN_SYSTEM_VARS,
  COMMON_CODE_RULES,
  validateGlobalsCss,
} from "./shared";
export {
  DESIGN_SKILL_COMPACT,
  DESIGN_SKILL_FULL,
  FONT_PAIRINGS,
  COLOR_PALETTES,
  COLOR_PALETTES_DARK,
  COMPONENT_TEMPLATES,
  MOTION_PATTERNS,
  SPATIAL_PATTERNS,
  TEXTURE_PATTERNS,
  ANTI_PATTERNS,
  SPACING_SCALES,
  SHADOW_SYSTEMS,
  RADIUS_SYSTEMS,
} from "./design-skill";
