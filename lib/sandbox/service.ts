/**
 * E2B Sandbox Service
 *
 * Manages sandbox lifecycle and provides file operations that trigger
 * Next.js hot reload automatically.
 *
 * Ported from Python reference: reference-code/backend-v2/services/sandbox.py
 */

import { Sandbox } from "e2b";
import {
  SandboxState,
  type ISandboxService,
  type CommandResult,
  type SandboxConfig,
} from "./types";

/**
 * Manages E2B sandbox for website generation.
 *
 * Key features:
 * - Uses pre-built template with Next.js + Tailwind + shadcn
 * - Dev server already running (hot reload enabled)
 * - Direct file writes trigger instant preview updates
 */
export class SandboxService implements ISandboxService {
  /** E2B template with Next.js 16 + Tailwind v4 + shadcn/ui */
  private readonly TEMPLATE: string;
  /** Project directory in sandbox */
  private readonly PROJECT_DIR: string;
  /** Sandbox timeout in seconds */
  private readonly TIMEOUT: number;

  private sandbox: Sandbox | null = null;
  private _state: SandboxState = SandboxState.IDLE;

  constructor(config: SandboxConfig = {}) {
    this.TEMPLATE = config.template ?? "nextjs16-tailwind4";
    this.PROJECT_DIR = config.projectDir ?? "/home/user";
    this.TIMEOUT = config.timeout ?? 600;
  }

  /** Current sandbox state */
  get state(): SandboxState {
    return this._state;
  }

  /** Get the sandbox ID if available */
  get sandboxId(): string | null {
    return this.sandbox?.sandboxId ?? null;
  }

  /** Check if sandbox is ready for file operations */
  isReady(): boolean {
    return this.sandbox !== null && this._state === SandboxState.READY;
  }

  /**
   * Create a new sandbox using custom template.
   * @returns Sandbox ID for reference
   */
  async createSandbox(): Promise<string> {
    this._state = SandboxState.CREATING;
    console.log(`Creating sandbox with template: ${this.TEMPLATE}`);

    try {
      this.sandbox = await Sandbox.create(this.TEMPLATE, {
        timeoutMs: this.TIMEOUT * 1000,
      });

      // Clean up default page.tsx to avoid conflicts
      console.log("Cleaning up default files...");
      await this.sandbox.commands.run(`rm -f ${this.PROJECT_DIR}/app/page.tsx`);

      // Remove broken shadcn/ui components that cause build errors
      await this.cleanupBrokenComponents();

      this._state = SandboxState.READY;
      console.log(`Sandbox ready: ${this.sandbox.sandboxId}`);
      return this.sandbox.sandboxId;
    } catch (error) {
      this._state = SandboxState.ERROR;
      console.error(`Failed to create sandbox: ${error}`);
      throw error;
    }
  }

  /**
   * Recreate sandbox after timeout/crash.
   * Used for auto-recovery when sandbox times out during generation.
   * @returns New sandbox ID
   */
  async recreateSandbox(): Promise<string> {
    console.log("Recreating sandbox after timeout...");
    this._state = SandboxState.CREATING;

    try {
      this.sandbox = await Sandbox.create(this.TEMPLATE, {
        timeoutMs: this.TIMEOUT * 1000,
      });

      // Clean up default page.tsx to avoid conflicts
      await this.sandbox.commands.run(`rm -f ${this.PROJECT_DIR}/app/page.tsx`);

      // Remove broken shadcn/ui components
      await this.cleanupBrokenComponents();

      this._state = SandboxState.READY;
      console.log(`Sandbox recreated: ${this.sandbox.sandboxId}`);
      return this.sandbox.sandboxId;
    } catch (error) {
      this._state = SandboxState.ERROR;
      console.error(`Failed to recreate sandbox: ${error}`);
      throw error;
    }
  }

  /**
   * Remove shadcn/ui components that have compatibility issues.
   */
  private async cleanupBrokenComponents(): Promise<void> {
    if (!this.sandbox) return;

    // These components have type errors with current package versions
    const brokenComponents = [
      "resizable.tsx", // react-resizable-panels incompatibility
    ];

    for (const component of brokenComponents) {
      const path = `${this.PROJECT_DIR}/components/ui/${component}`;
      await this.sandbox.commands.run(`rm -f ${path}`);
    }
  }

  /**
   * Connect to an existing sandbox.
   */
  async connectSandbox(sandboxId: string): Promise<void> {
    this.sandbox = await Sandbox.connect(sandboxId);
    await this.cleanupBrokenComponents();
    this._state = SandboxState.READY;
  }

  /**
   * Write a single file to sandbox (triggers hot reload).
   * @param filePath Relative path from project root (e.g., "app/page.tsx")
   * @param content File content
   * @returns True if write succeeded, false otherwise
   */
  async writeFile(filePath: string, content: string): Promise<boolean> {
    if (!this.isReady() || !this.sandbox) {
      console.log(`Sandbox not ready, skipping write: ${filePath}`);
      return false;
    }

    try {
      const fullPath = `${this.PROJECT_DIR}/${filePath}`;

      // Create directory if needed
      const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
      if (dirPath) {
        await this.sandbox.commands.run(`mkdir -p ${dirPath}`);
      }

      await this.sandbox.files.write(fullPath, content);
      console.log(`Hot reload: ${filePath}`);
      return true;
    } catch (error) {
      console.error(`Write failed for ${filePath}: ${error}`);
      return false;
    }
  }

  /**
   * Read a file from the sandbox.
   * @param filePath Relative path from project root
   * @returns File content or null if not found
   */
  async readFile(filePath: string): Promise<string | null> {
    if (!this.isReady() || !this.sandbox) {
      return null;
    }

    try {
      const fullPath = `${this.PROJECT_DIR}/${filePath}`;
      const content = await this.sandbox.files.read(fullPath);
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Check if a file exists in the sandbox.
   */
  async fileExists(filePath: string): Promise<boolean> {
    if (!this.isReady() || !this.sandbox) {
      return false;
    }

    try {
      const fullPath = `${this.PROJECT_DIR}/${filePath}`;
      const result = await this.sandbox.commands.run(`test -f ${fullPath}`);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Get the dev server URL for hot reload preview.
   *
   * The Next.js dev server is already running via the E2B template's
   * set_start_cmd. This returns the URL for immediate preview.
   */
  getPreviewUrl(): string {
    if (!this.sandbox) {
      throw new Error("Sandbox not initialized.");
    }

    return `https://${this.sandbox.getHost(3000)}`;
  }

  /**
   * Run a command in the sandbox.
   * @returns Command result with exit code, stdout, stderr
   */
  async runCommand(command: string): Promise<CommandResult> {
    if (!this.sandbox) {
      throw new Error("Sandbox not initialized.");
    }

    const result = await this.sandbox.commands.run(command);
    return {
      exitCode: result.exitCode,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  }

  /**
   * Terminate the sandbox.
   */
  async close(): Promise<void> {
    if (this.sandbox) {
      console.log(`Closing sandbox: ${this.sandbox.sandboxId}`);
      await this.sandbox.kill();
      this.sandbox = null;
      this._state = SandboxState.CLOSED;
    }
  }
}
