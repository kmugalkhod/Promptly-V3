/**
 * Skills System Type Definitions
 *
 * Types for the skills-based agent architecture including
 * skill metadata, loading results, and configuration.
 */

import type { AgentName } from "./types";

/**
 * Skill metadata from YAML frontmatter
 */
export interface SkillMetadata {
  /** Unique skill identifier (matches folder name) */
  name: string;
  /** Brief description for agent to decide when to load */
  description: string;
  /** Category for organization (e.g., 'frontend', 'supabase', 'chat') */
  category: string;
  /** Which agents can use this skill */
  agents: (AgentName | "all")[];
}

/**
 * Full skill content including instructions
 */
export interface SkillContent {
  /** Skill metadata */
  metadata: SkillMetadata;
  /** Full instruction content (markdown body) */
  instructions: string;
}

/**
 * Result of loading a skill
 */
export interface SkillLoadResult {
  /** Whether skill was found and loaded */
  success: boolean;
  /** Skill name that was requested */
  skillName: string;
  /** Formatted instructions (if success) or error message */
  content: string;
}

/**
 * Configuration for skills system
 */
export interface SkillsConfig {
  /** Root directory for skills (default: 'skills') */
  skillsDir?: string;
  /** Cache skill metadata on startup */
  cacheMetadata?: boolean;
}
