/**
 * E2B Sandbox Types
 *
 * Type definitions for sandbox lifecycle and file operations.
 */

/**
 * Sandbox lifecycle states
 */
export enum SandboxState {
  IDLE = "idle",
  CREATING = "creating",
  READY = "ready",
  ERROR = "error",
  CLOSED = "closed",
}

/**
 * Sandbox error types for classification and retry logic
 */
export enum SandboxErrorType {
  TIMEOUT = "timeout",
  CONNECTION_FAILED = "connection_failed",
  COMMAND_FAILED = "command_failed",
  FILE_OPERATION_FAILED = "file_operation_failed",
  UNKNOWN = "unknown",
}

/**
 * Structured sandbox error with retry information
 */
export interface SandboxError {
  type: SandboxErrorType;
  message: string;
  retryable: boolean;
  originalError?: Error;
}

/**
 * Extended sandbox configuration for timeout and retry handling
 */
export interface ExtendedSandboxConfig {
  /** Sandbox timeout in seconds (default: 900) */
  timeout?: number;
  /** Extended timeout for long operations in seconds (default: 1200) */
  extendedTimeout?: number;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay between retries in milliseconds (default: 2000) */
  retryDelayMs?: number;
}

/**
 * Result of a sandbox command execution
 */
export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Sandbox configuration options
 */
export interface SandboxConfig {
  /** E2B template ID (default: nextjs16-tailwind4) */
  template?: string;
  /** Sandbox timeout in seconds (default: 600) */
  timeout?: number;
  /** Project directory in sandbox (default: /home/user) */
  projectDir?: string;
}

/**
 * Sandbox service interface for dependency injection
 */
export interface ISandboxService {
  /** Current sandbox state */
  readonly state: SandboxState;
  /** Sandbox ID if available */
  readonly sandboxId: string | null;
  /** Check if sandbox is ready */
  isReady(): boolean;
  /** Create a new sandbox */
  createSandbox(): Promise<string>;
  /** Recreate sandbox after timeout/crash */
  recreateSandbox(): Promise<string>;
  /** Connect to an existing sandbox */
  connectSandbox(sandboxId: string): Promise<void>;
  /** Write a file to sandbox (triggers hot reload) */
  writeFile(filePath: string, content: string): Promise<boolean>;
  /** Read a file from sandbox */
  readFile(filePath: string): Promise<string | null>;
  /** Check if file exists in sandbox */
  fileExists(filePath: string): Promise<boolean>;
  /** Get the preview URL */
  getPreviewUrl(): string;
  /** Run a command in sandbox */
  runCommand(command: string): Promise<CommandResult>;
  /** Close the sandbox */
  close(): Promise<void>;
}

/**
 * File operation result
 */
export interface FileOperationResult {
  success: boolean;
  path: string;
  error?: string;
}

/**
 * Sandbox creation result
 */
export interface SandboxCreationResult {
  sandboxId: string;
  previewUrl: string;
}
