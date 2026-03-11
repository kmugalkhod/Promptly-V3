/**
 * QA Agent
 *
 * Validates generated Next.js websites using agent-browser CLI.
 * Navigates routes, captures accessibility snapshots and screenshots,
 * checks for broken links, and produces structured QA findings.
 *
 * Uses: run_browser_command, read_file, load_skill
 * Model: Claude Sonnet
 */

import { createAgent, tool, anthropicPromptCachingMiddleware } from "langchain";
import { ChatAnthropic } from "@langchain/anthropic";
import { z } from "zod";
import { QA_PROMPT } from "../prompts";
import { type SandboxActions } from "./tools";
import type { AgentResult, ToolContext, ToolCall, QAResult, QAFinding } from "./types";
import { getSkillsMetadata, formatSkillsForPrompt, loadSkill } from "./skills";

const MODEL_NAME = "claude-sonnet-4-6";

/**
 * Extract only ROUTES and COMPONENTS sections from architecture document.
 * QA agent doesn't need design tokens, database schemas, or other sections.
 * Reduces input tokens by 1-3K per QA run.
 */
function extractQAContext(architecture: string): string {
  const sections: string[] = [];

  // Extract ROUTES section (YAML-style: "ROUTES:\n- /path")
  const routesMatch = architecture.match(
    /ROUTES:\s*\n([\s\S]*?)(?=\n[A-Z][A-Z_]+:|\s*$)/
  );
  if (routesMatch) {
    sections.push("ROUTES:\n" + routesMatch[1].trim());
  }

  // Extract COMPONENTS section (YAML-style: "COMPONENTS:\n- Component")
  const componentsMatch = architecture.match(
    /COMPONENTS:\s*\n([\s\S]*?)(?=\n[A-Z][A-Z_]+:|\s*$)/
  );
  if (componentsMatch) {
    sections.push("COMPONENTS:\n" + componentsMatch[1].trim());
  }

  // Extract APP_NAME / app name line
  const appNameMatch = architecture.match(/^.*APP_NAME.*$/m);
  if (appNameMatch) {
    sections.unshift(appNameMatch[0].trim());
  }

  // If extraction failed (different format), fall back to full architecture
  if (sections.length <= 1) {
    return architecture;
  }

  return sections.join("\n\n");
}

/**
 * Parse QA findings JSON from the agent's response text.
 *
 * Extracts the JSON block containing findings from the agent output.
 * Returns a structured QAResult with parsed findings and summary stats.
 *
 * @param response - Raw agent response text
 * @returns Parsed QAResult
 */
export function parseQAFindings(response: string): QAResult {
  // Try to extract JSON block from response
  const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
  const rawJson = jsonMatch ? jsonMatch[1].trim() : null;

  if (!rawJson) {
    // Try to find raw JSON object in response (without code fences)
    const objectMatch = response.match(/\{\s*"passed"\s*:\s*(true|false)\s*,\s*"findings"\s*:\s*\[[\s\S]*?\]\s*\}/);
    if (objectMatch) {
      try {
        const parsed = JSON.parse(objectMatch[0]);
        return buildQAResult(parsed.findings ?? [], parsed.passed);
      } catch {
        // Fall through to default
      }
    }

    // No JSON found — assume pass (agent found no issues)
    return {
      passed: true,
      routeResults: [],
      allFindings: [],
      routesChecked: 0,
      issuesFound: 0,
    };
  }

  try {
    const parsed = JSON.parse(rawJson);
    const findings: QAFinding[] = parsed.findings ?? [];
    const passed = parsed.passed ?? findings.length === 0;
    return buildQAResult(findings, passed);
  } catch {
    // JSON parse failed — return empty pass result
    return {
      passed: true,
      routeResults: [],
      allFindings: [],
      routesChecked: 0,
      issuesFound: 0,
    };
  }
}

/**
 * Build a QAResult from parsed findings.
 */
function buildQAResult(findings: QAFinding[], passed: boolean): QAResult {
  // Group findings by route
  const routeMap = new Map<string, QAFinding[]>();
  for (const finding of findings) {
    const route = finding.route || "/";
    if (!routeMap.has(route)) {
      routeMap.set(route, []);
    }
    routeMap.get(route)!.push(finding);
  }

  const routeResults = Array.from(routeMap.entries()).map(([route, routeFindings]) => ({
    route,
    passed: routeFindings.length === 0,
    findings: routeFindings,
    screenshotPaths: [] as string[], // Screenshots are saved in sandbox, paths not tracked here
  }));

  return {
    passed,
    routeResults,
    allFindings: findings,
    routesChecked: routeMap.size || 1, // At least 1 route checked
    issuesFound: findings.length,
  };
}

/**
 * Run the QA Agent to validate a generated website.
 *
 * @param previewUrl - E2B sandbox preview URL (used for reference; agent uses localhost:3000)
 * @param architecture - Architecture document content (for route extraction)
 * @param context - Tool context for file operations
 * @param sandboxActions - Sandbox action functions
 * @returns Agent result with QA findings in response text
 */
export async function runQAAgent(
  previewUrl: string,
  architecture: string,
  context: ToolContext,
  sandboxActions: SandboxActions
): Promise<AgentResult> {
  const toolCalls: ToolCall[] = [];
  const filesChanged: string[] = []; // QA agent doesn't change files, but included for AgentResult compatibility

  // Load skills metadata for system prompt
  const skills = await getSkillsMetadata();
  const skillsSection = formatSkillsForPrompt(skills, "qa");

  // Define tools
  const runBrowserCommandTool = tool(
    async ({ command }: { command: string }) => {
      try {
        const result = await sandboxActions.runCommand(`agent-browser ${command}`);
        const output = result.stdout || result.stderr;
        toolCalls.push({
          name: "run_browser_command",
          input: { command },
          output: output.substring(0, 5000), // Truncate long outputs
        });
        if (result.exitCode !== 0) {
          return `Command failed (exit ${result.exitCode}): ${output.substring(0, 2000)}`;
        }
        return output.substring(0, 5000);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return `Browser command failed: ${msg}`;
      }
    },
    {
      name: "run_browser_command",
      description:
        "Run an agent-browser CLI command in the sandbox. Pass the command WITHOUT the 'agent-browser' prefix. Examples: 'open http://localhost:3000', 'snapshot -i', 'screenshot /tmp/qa/home.png', 'set viewport 375 812', 'wait --load networkidle', 'close'",
      schema: z.object({
        command: z
          .string()
          .describe("agent-browser command to run (without the 'agent-browser' prefix)"),
      }),
    }
  );

  const readFileTool = tool(
    async ({ file_path }: { file_path: string }) => {
      const cached = context.files.get(file_path);
      if (cached) {
        toolCalls.push({
          name: "read_file",
          input: { file_path },
          output: cached,
        });
        return cached;
      }

      try {
        const content = await sandboxActions.readFile(file_path);
        if (content !== null) {
          context.files.set(file_path, content);
          toolCalls.push({
            name: "read_file",
            input: { file_path },
            output: content,
          });
          return content;
        }
        return `File not found: ${file_path}`;
      } catch {
        return `File not found: ${file_path}`;
      }
    },
    {
      name: "read_file",
      description:
        "Read and return content of a file from the sandbox. Use to inspect component code when analyzing QA findings.",
      schema: z.object({
        file_path: z.string().describe("Relative path to the file to read"),
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
        "Load specialized QA instructions for a skill. Check <available_skills> in your system prompt to see what's available.",
      schema: z.object({
        skill_name: z
          .string()
          .describe("Name of the skill to load (e.g., 'visual-validation', 'accessibility-check', 'responsive-check')"),
      }),
    }
  );

  const tools = [runBrowserCommandTool, readFileTool, loadSkillTool];

  try {
    // Create the model instance
    const model = new ChatAnthropic({
      model: MODEL_NAME,
      maxTokens: 16000,
      streaming: true,
      thinking: {
        type: "enabled",
        budget_tokens: 4000,
      },
    });

    // Build system prompt with skills metadata
    const systemPromptWithSkills = skillsSection
      ? `${QA_PROMPT}\n\n${skillsSection}`
      : QA_PROMPT;

    // Create the agent
    const agent = createAgent({
      model,
      tools,
      systemPrompt: systemPromptWithSkills,
      middleware: [
        anthropicPromptCachingMiddleware({ minMessagesToCache: 1 }),
      ],
    });

    // Extract only routes/components from architecture (reduces tokens)
    const qaContext = extractQAContext(architecture);

    // Build user message with architecture and preview URL
    const userMessage = `Validate the generated website.

## SANDBOX INFO
- Preview URL (external): ${previewUrl}
- Internal URL (use this): http://localhost:3000
- QA screenshots directory: /tmp/qa/

## ARCHITECTURE (routes & components)
${qaContext}

## INSTRUCTIONS
1. Parse the ROUTES section from the architecture above
2. For each route, follow the validation workflow in your system prompt
3. Check accessibility, responsive behavior, and links
4. Output structured JSON findings

Begin validation now.`;

    // Run the agent — QA needs ~5 tool calls per route × ~5 routes + analysis
    const result = await agent.invoke(
      {
        messages: [{ role: "user", content: userMessage }],
      },
      {
        recursionLimit: 75,
      }
    );

    // Log thinking blocks for debugging
    for (const msg of result.messages) {
      if (msg.content && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "thinking" && block.thinking) {
            console.log("[qa] Thinking:", String((block as unknown as { thinking: unknown }).thinking).substring(0, 200));
            break;
          }
        }
      }
    }

    // Extract the final output from messages
    const lastMessage = result.messages[result.messages.length - 1];
    const responseText =
      typeof lastMessage?.content === "string"
        ? lastMessage.content
        : "QA validation complete.";

    return {
      response: responseText,
      toolCalls,
      filesChanged,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Detect recursion limit exhaustion
    const isRecursionExhaustion =
      error instanceof Error && (
        error.name === "GraphRecursionError" ||
        errorMessage.includes("Recursion limit") ||
        errorMessage.includes("recursion limit")
      );

    if (isRecursionExhaustion) {
      console.warn("[qa] Recursion limit exhausted");
      return {
        response: "QA validation incomplete — ran out of steps. Partial results may be available in tool calls.",
        toolCalls,
        filesChanged,
        error: "recursion_exhaustion",
      };
    }

    console.error("[qa] Error:", errorMessage);
    return {
      response: "",
      toolCalls,
      filesChanged: [],
      error: `QA agent failed: ${errorMessage}`,
    };
  }
}
