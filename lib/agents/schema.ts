/**
 * Schema Agent
 *
 * Generates schema.sql from a DATABASE specification extracted from architecture.md.
 * Runs BEFORE the Coder Agent so the database is ready when application code is generated.
 *
 * Uses: write_file, load_skill tools
 * Model: Claude Sonnet
 */

import { createAgent, tool, anthropicPromptCachingMiddleware } from "langchain";
import { ChatAnthropic } from "@langchain/anthropic";
import { z } from "zod";
import { SCHEMA_PROMPT, formatSchemaRetryPrompt } from "../prompts/schema";
import { extractTableNames, detectAuthUsage } from "../utils/database-extraction";
import { type SandboxActions } from "./tools";
import type { AgentResult, ToolContext, ToolCall } from "./types";
import { getSkillsMetadata, formatSkillsForPrompt, loadSkill } from "./skills";

const MODEL_NAME = "claude-sonnet-4-6";

/**
 * Run the Schema Agent to generate schema.sql from a DATABASE specification.
 *
 * @param databaseSection - DATABASE section extracted from architecture.md
 * @param context - Tool context for file operations
 * @param sandboxActions - Sandbox action functions
 * @param errorFeedback - For retry: previous error message
 * @returns Agent result with schema.sql content in context.files
 */
export async function runSchemaAgent(
  databaseSection: string,
  context: ToolContext,
  sandboxActions: SandboxActions,
  errorFeedback?: string
): Promise<AgentResult> {
  const toolCalls: ToolCall[] = [];
  const filesChanged: string[] = [];

  // Load skills metadata — use "coder" agent type to inherit coder's database skills
  // (rls-policies, database-queries) without modifying SKILL.md frontmatter
  const skills = await getSkillsMetadata();
  const skillsSection = formatSkillsForPrompt(skills, "coder");

  // Define tools
  const writeFileTool = tool(
    async ({ file_path, content }: { file_path: string; content: string }) => {
      try {
        context.files.set(file_path, content);
        context.recentFiles = [
          file_path,
          ...context.recentFiles.filter((f) => f !== file_path),
        ].slice(0, 10);

        await sandboxActions.writeFile(file_path, content);

        toolCalls.push({
          name: "write_file",
          input: { file_path, content },
          output: `Hot reload: ${file_path}`,
        });

        if (!filesChanged.includes(file_path)) {
          filesChanged.push(file_path);
        }

        return `Hot reload: ${file_path}`;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return `Failed to write: ${file_path} - ${msg}`;
      }
    },
    {
      name: "write_file",
      description:
        "Write content to a file. Creates the file if it doesn't exist. Used to save the schema.sql file.",
      schema: z.object({
        file_path: z.string().describe("Relative path from project root"),
        content: z.string().describe("Content to write to the file"),
      }),
    }
  );

  const loadSkillTool = tool(
    async ({ skill_name }: { skill_name: string }) => {
      const result = await loadSkill(skill_name);
      toolCalls.push({
        name: "load_skill",
        input: { skill_name },
        output: result.content,
      });
      return result.content;
    },
    {
      name: "load_skill",
      description:
        "Load specialized instructions for a skill. Use this when you need detailed guidance for a specific task type. Check <available_skills> in your system prompt to see what's available.",
      schema: z.object({
        skill_name: z
          .string()
          .describe("Name of the skill to load (e.g., 'rls-policies', 'database-queries')"),
      }),
    }
  );

  try {
    // Create the model instance
    const model = new ChatAnthropic({
      model: MODEL_NAME,
      temperature: 0,
      maxTokens: 8192,
    });

    // Build system prompt with skills metadata
    const systemPromptWithSkills = skillsSection
      ? `${SCHEMA_PROMPT}\n\n${skillsSection}`
      : SCHEMA_PROMPT;

    // Create the agent
    const agent = createAgent({
      model,
      tools: [writeFileTool, loadSkillTool],
      systemPrompt: systemPromptWithSkills,
      middleware: [
        anthropicPromptCachingMiddleware({ minMessagesToCache: 1 }),
      ],
    });

    // Count tables to determine if SECURITY DEFINER is needed
    const tableNames = extractTableNames(databaseSection);
    const tableCount = tableNames.length;

    // Check if database section has foreign key references
    const hasForeignKeys = /fk\s*->|references\s/i.test(databaseSection);

    // Build conditional SECURITY DEFINER instruction
    let securityDefinerInstruction = "";
    if (tableCount >= 3 && hasForeignKeys) {
      securityDefinerInstruction = `\n\n⚠️ CRITICAL: This schema has ${tableCount} tables (${tableNames.join(", ")}) with foreign key relationships. You MUST create a SECURITY DEFINER helper function (e.g., get_user_workspace_ids() or get_user_org_ids()) to prevent infinite recursion in RLS policies. Do NOT write cross-table subqueries directly in policies. See the rls-policies skill Pattern 8 for the exact template.`;
    }

    // Detect whether the app uses authentication
    const usesAuth = detectAuthUsage(databaseSection);

    let authInstruction = "";
    if (!usesAuth) {
      authInstruction = `\n\n⚠️ CRITICAL — NO AUTHENTICATION DETECTED: This DATABASE specification does NOT reference auth.users, has no profiles table, and no user_id foreign keys. This app does NOT use authentication. You MUST use public-access RLS policies for ALL tables:
- Use Pattern 5 (public CRUD) from the rls-policies skill
- Every policy MUST use USING (true) and/or WITH CHECK (true)
- Use "TO anon, authenticated" on every policy (allows both roles)
- NEVER use auth.uid() in any policy — it returns NULL for anon connections and will block ALL writes
- NEVER use "TO authenticated" alone — the app has no login, so users connect as anon`;
    } else {
      authInstruction = `\n\nThis DATABASE specification uses authentication (auth.users references detected). Tables with user_id or owner_id referencing auth.users should use auth-based RLS policies (Pattern 7: user-owned CRUD). Tables without a user_id column should use Pattern 5 (public CRUD) or Pattern 6 (draft/publish) as appropriate. Always use (select auth.uid()) wrapped in select for performance.`;
    }

    // Build user message — first attempt vs retry
    const userMessage = errorFeedback
      ? formatSchemaRetryPrompt(databaseSection, errorFeedback, 2, authInstruction)
      : `Generate schema.sql from this DATABASE specification:\n\n${databaseSection}${securityDefinerInstruction}${authInstruction}\n\nLoad the "rls-policies" and "database-queries" skills first, then generate schema.sql using write_file.`;

    // Run the agent with recursion limit
    // Schema agent needs ~5-10 calls: load 2 skills + write 1 file + verify
    const result = await agent.invoke(
      {
        messages: [{ role: "user", content: userMessage }],
      },
      {
        recursionLimit: 15,
      }
    );

    // Extract the final output from messages
    const lastMessage = result.messages[result.messages.length - 1];
    const responseText =
      typeof lastMessage?.content === "string"
        ? lastMessage.content
        : context.files.get("schema.sql") ? "schema.sql generated successfully" : "";

    return {
      response: responseText,
      toolCalls,
      filesChanged,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      response: "",
      toolCalls,
      filesChanged,
      error: `Schema agent failed: ${errorMessage}`,
    };
  }
}
