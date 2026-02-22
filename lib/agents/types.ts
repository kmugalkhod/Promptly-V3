/**
 * Agent System Type Definitions
 *
 * Types for the three-agent architecture including tool context,
 * agent configuration, and smart context structures.
 */

import { Id } from "../../convex/_generated/dataModel";

/**
 * Agent names for the three-agent system
 */
export type AgentName = "architecture" | "schema" | "coder" | "chat";

/**
 * Tool context passed to agent tools for file operations
 */
export interface ToolContext {
  /** Convex session ID */
  sessionId: Id<"sessions">;
  /** E2B sandbox ID for live preview */
  sandboxId: string | null;
  /** Generated files cache (path -> content) */
  files: Map<string, string>;
  /** Recently modified file paths (for recency scoring) */
  recentFiles: string[];
}

/**
 * Result of a tool execution
 */
export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * Agent execution result
 */
export interface AgentResult {
  /** Final text response from agent */
  response: string;
  /** Tool calls made during execution */
  toolCalls: ToolCall[];
  /** Files created/modified */
  filesChanged: string[];
  /** Any errors encountered */
  error?: string;
}

/**
 * A single tool call made by an agent
 */
export interface ToolCall {
  /** Tool name */
  name: string;
  /** Tool input arguments */
  input: Record<string, unknown>;
  /** Tool output result */
  output: string;
}

/**
 * Configuration for creating an agent
 */
export interface AgentConfig {
  /** Agent identifier */
  name: AgentName;
  /** System prompt for the agent */
  systemPrompt: string;
  /** Tool names this agent can use */
  tools: string[];
  /** Model to use (default: claude-haiku-4-5-20251001) */
  model?: string;
}

/**
 * File content with full content included (for smart context)
 */
export interface FileContent {
  /** File path relative to project root */
  path: string;
  /** Full file content */
  content: string;
  /** Relevance score (0.0-1.0) */
  score: number;
}

/**
 * File summary for files not included in full (for smart context)
 */
export interface FileSummary {
  /** File path relative to project root */
  path: string;
  /** Number of lines in file */
  lineCount: number;
  /** Brief description of file purpose */
  purpose: string;
  /** Relevance score (0.0-1.0) */
  score: number;
}

/**
 * Smart context for the Chat Agent
 * Contains relevance-scored files to reduce tool calls
 */
export interface SmartContext {
  /** Files included with full content (top scored) */
  fullFiles: FileContent[];
  /** Files included as summaries only */
  summaries: FileSummary[];
  /** Estimated total tokens used */
  tokenCount: number;
}

/**
 * Configuration for smart context building
 */
export interface SmartContextConfig {
  /** Maximum tokens for full file content (default: 4000) */
  maxTokens?: number;
  /** Maximum number of files to include in full (default: 5) */
  maxFullFiles?: number;
  /** Minimum score threshold to include file (default: 0.1) */
  minScoreThreshold?: number;
}

/**
 * Generation workflow state
 */
export interface GenerationState {
  /** Current phase of generation */
  phase: "architecture" | "schema" | "coder" | "complete" | "error";
  /** Architecture document content */
  architecture?: string;
  /** App name extracted from architecture */
  appName?: string;
  /** E2B preview URL */
  previewUrl?: string;
  /** Error message if phase is "error" */
  error?: string;
  /** Files generated so far */
  files: string[];
}

/**
 * Modification request for Chat Agent
 */
export interface ModificationRequest {
  /** User's modification request */
  message: string;
  /** Whether to use smart context */
  useSmartContext?: boolean;
}

/**
 * Anthropic tool definition for function calling
 */
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
    }>;
    required: string[];
  };
}
