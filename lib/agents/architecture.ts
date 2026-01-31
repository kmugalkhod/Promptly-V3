/**
 * Architecture Agent
 *
 * Designs minimal app architecture based on user requirements.
 * Outputs architecture.md with app name, routes, components, and optional packages.
 *
 * Uses: write_file tool only
 * Model: Claude Haiku
 */

import { createAgent, tool } from "langchain";
import { ChatAnthropic } from "@langchain/anthropic";
import { z } from "zod";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { ARCHITECTURE_PROMPT } from "../prompts";
import { type SandboxActions } from "./tools";
import type { AgentResult, ToolContext, ToolCall } from "./types";

const MODEL_NAME = "claude-sonnet-4-20250514";

/**
 * Run the Architecture Agent to design app structure.
 *
 * @param userRequirements - User's description of the app to build
 * @param context - Tool context for file operations
 * @param sandboxActions - Sandbox action functions
 * @returns Agent result with architecture document
 */
export async function runArchitectureAgent(
  userRequirements: string,
  context: ToolContext,
  sandboxActions: SandboxActions
): Promise<AgentResult> {
  const toolCalls: ToolCall[] = [];
  const filesChanged: string[] = [];

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
        "Write content to a file. Creates the file if it doesn't exist. Used to save the architecture.md document.",
      schema: z.object({
        file_path: z.string().describe("Relative path from project root"),
        content: z.string().describe("Content to write to the file"),
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

    // Create the agent
    const agent = createAgent({
      model,
      tools: [writeFileTool],
      systemPrompt: ARCHITECTURE_PROMPT,
    });

    // Run the agent with recursion limit
    const result = await agent.invoke(
      {
        messages: [
          { role: "user", content: `Design the architecture for: ${userRequirements}` },
        ],
      },
      {
        recursionLimit: 25, // Architecture typically needs only 1-2 tool calls
      }
    );

    // If architecture.md was written, read it back
    let architectureContent = "";
    if (context.files.has("architecture.md")) {
      architectureContent = context.files.get("architecture.md") || "";
    }

    // Extract the final output from messages
    const lastMessage = result.messages[result.messages.length - 1];
    const responseText =
      typeof lastMessage?.content === "string"
        ? lastMessage.content
        : architectureContent;

    return {
      response: responseText || architectureContent,
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
      error: `Architecture agent failed: ${errorMessage}`,
    };
  }
}

/**
 * Create messages for a multi-turn architecture conversation.
 * Used for iterating on architecture design.
 */
export function createArchitectureMessages(
  requirements: string,
  previousResponse?: string,
  feedback?: string
): (SystemMessage | HumanMessage | AIMessage)[] {
  const messages: (SystemMessage | HumanMessage | AIMessage)[] = [
    new SystemMessage(ARCHITECTURE_PROMPT),
    new HumanMessage(`Design the architecture for: ${requirements}`),
  ];

  if (previousResponse) {
    messages.push(new AIMessage(previousResponse));
  }

  if (feedback) {
    messages.push(new HumanMessage(feedback));
  }

  return messages;
}
