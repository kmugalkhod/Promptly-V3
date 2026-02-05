/**
 * Agents Module
 *
 * Exports all agents, tools, and utilities for the three-agent system.
 *
 * Agents:
 * - Architecture Agent: Full project generation/rebuild
 * - Coder Agent: Multi-file code changes
 * - Chat Agent: Simple code editing (user describes changes in plain English)
 */

// Agent runners
export { runArchitectureAgent, createArchitectureMessages } from "./architecture";
export { runCoderAgent } from "./coder";
export { runChatAgent, shouldRecommendArchitecture, type ChatAgentConfig } from "./chat";

// Context builder (used by Architecture and Coder agents)
export {
  ContextBuilder,
  RelevanceScorer,
  estimateTokens,
  detectFilePurpose,
  getContextConfigForComplexity,
  RequestComplexity,
  type DynamicContextConfig,
} from "./context-builder";

// Tools
export {
  ALLOWED_PACKAGES,
  validatePackageName,
  TOOL_DEFINITIONS,
  getToolsForAgent,
  executeTool,
  type SandboxActions,
} from "./tools";

// Types
export type {
  AgentName,
  ToolContext,
  ToolResult,
  AgentResult,
  ToolCall,
  AgentConfig,
  FileContent,
  FileSummary,
  SmartContext,
  SmartContextConfig,
  GenerationState,
  ModificationRequest,
  AnthropicTool,
} from "./types";

// Skills system
export {
  getSkillsMetadata,
  formatSkillsForPrompt,
  loadSkillTool,
  loadSkill,
  clearSkillsCache,
} from "./skills";
export type {
  SkillMetadata,
  SkillContent,
  SkillLoadResult,
  SkillsConfig,
} from "./skills.types";
