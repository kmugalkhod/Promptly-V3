/**
 * Skills System
 *
 * Implements the LangChain skills pattern for progressive disclosure.
 * Skills are markdown files with YAML frontmatter stored in /skills folder.
 * Agents receive skill metadata upfront and load full instructions on-demand.
 */

import { tool } from "langchain";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import type { AgentName } from "./types";
import type {
  SkillMetadata,
  SkillContent,
  SkillLoadResult,
} from "./skills.types";

// Skills directory relative to project root
const SKILLS_DIR = path.join(process.cwd(), "skills");

// Cache for skill metadata (populated on first call)
let skillsMetadataCache: SkillMetadata[] | null = null;

/**
 * Recursively scan skills directory for SKILL.md files
 * @param dir Directory to scan
 * @returns Array of skill metadata
 */
async function scanSkillsDirectory(dir: string): Promise<SkillMetadata[]> {
  const skills: SkillMetadata[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(dir, entry.name, "SKILL.md");

        try {
          const content = await fs.readFile(skillPath, "utf-8");
          const { data } = matter(content);

          // Validate required fields
          if (data.name && data.description) {
            skills.push({
              name: data.name,
              description: data.description,
              category: data.category || "general",
              agents: data.agents || ["all"],
            });
          }
        } catch {
          // Not a skill directory or missing SKILL.md, recurse into subdirectory
          const subSkills = await scanSkillsDirectory(
            path.join(dir, entry.name)
          );
          skills.push(...subSkills);
        }
      }
    }
  } catch (error) {
    console.warn(`[skills] Failed to scan directory ${dir}:`, error);
  }

  return skills;
}

/**
 * Get metadata for all available skills
 * @param forceRefresh Force refresh cache
 * @returns Array of skill metadata
 */
export async function getSkillsMetadata(
  forceRefresh = false
): Promise<SkillMetadata[]> {
  if (skillsMetadataCache && !forceRefresh) {
    return skillsMetadataCache;
  }

  skillsMetadataCache = await scanSkillsDirectory(SKILLS_DIR);
  console.log(`[skills] Loaded ${skillsMetadataCache.length} skills`);

  return skillsMetadataCache;
}

/**
 * Format skills metadata for inclusion in system prompt
 * @param skills Skills metadata array
 * @param agentType Which agent is requesting (filters skills)
 * @returns Formatted string for system prompt
 */
export function formatSkillsForPrompt(
  skills: SkillMetadata[],
  agentType: AgentName
): string {
  // Filter skills relevant to this agent
  const relevantSkills = skills.filter(
    (s) => s.agents.includes(agentType) || s.agents.includes("all")
  );

  if (relevantSkills.length === 0) {
    return "";
  }

  const skillsList = relevantSkills
    .map(
      (s) =>
        `<skill name="${s.name}" category="${s.category}">\n  ${s.description}\n</skill>`
    )
    .join("\n");

  return `<available_skills>
${skillsList}
</available_skills>

Use the load_skill tool to load full instructions when you need a skill's expertise.`;
}

/**
 * Find and load a skill by name
 * @param skillName Name of skill to load
 * @returns Skill content or null if not found
 */
async function findAndLoadSkill(
  skillName: string
): Promise<SkillContent | null> {
  async function searchDirectory(dir: string): Promise<SkillContent | null> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Check if this is the skill we're looking for
          if (entry.name === skillName) {
            const skillPath = path.join(dir, entry.name, "SKILL.md");

            try {
              const fileContent = await fs.readFile(skillPath, "utf-8");
              const { data, content } = matter(fileContent);

              return {
                metadata: {
                  name: data.name || skillName,
                  description: data.description || "",
                  category: data.category || "general",
                  agents: data.agents || ["all"],
                },
                instructions: content.trim(),
              };
            } catch {
              return null;
            }
          }

          // Recurse into subdirectory
          const found = await searchDirectory(path.join(dir, entry.name));
          if (found) return found;
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return null;
  }

  return searchDirectory(SKILLS_DIR);
}

/**
 * Load a skill's full instructions
 * @param skillName Name of skill to load
 * @returns Load result with instructions or error
 */
export async function loadSkill(skillName: string): Promise<SkillLoadResult> {
  const skill = await findAndLoadSkill(skillName);

  if (!skill) {
    return {
      success: false,
      skillName,
      content: `Skill "${skillName}" not found. Available skills are listed in your system prompt under <available_skills>.`,
    };
  }

  console.log(`[skills] Loaded skill: ${skillName}`);

  return {
    success: true,
    skillName,
    content: `<skill_instructions name="${skillName}" category="${skill.metadata.category}">
${skill.instructions}
</skill_instructions>`,
  };
}

/**
 * LangChain tool for loading skills
 * Use this tool in agent tool arrays.
 */
export const loadSkillTool = tool(
  async ({ skill_name }: { skill_name: string }): Promise<string> => {
    const result = await loadSkill(skill_name);
    return result.content;
  },
  {
    name: "load_skill",
    description:
      "Load specialized instructions for a skill. Use this when you need detailed guidance for a specific task type. Skills provide expertise for tasks like react-component creation, form building, Supabase RLS policies, bug fixing, etc. Check <available_skills> in your system prompt to see what's available.",
    schema: z.object({
      skill_name: z
        .string()
        .describe(
          "Name of the skill to load (e.g., 'react-component', 'rls-policies', 'fix-bug')"
        ),
    }),
  }
);

/**
 * Clear the skills metadata cache
 * Useful for development/testing
 */
export function clearSkillsCache(): void {
  skillsMetadataCache = null;
}
