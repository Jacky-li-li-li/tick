import type { CliSessionId } from "./session-policy.js";

/** Stable tool id in Todo.ai.toolId */
export type AiToolId = "pi" | (string & {});

export type DeliverPromptMode = "clipboard" | "flag" | "stdin" | "none";

export interface AiToolCapabilities {
  needsCwd: boolean;
  resumeSession: boolean;
  deliverPrompt: DeliverPromptMode;
  listSessions: boolean;
}

/** Assembled by Main AiLaunchService; adapters must not invent todos */
export interface LaunchContext {
  todoId: string;
  title: string;
  body?: string;
  /** Absolute path; required when capabilities.needsCwd */
  cwd: string;
  /** When set, prefer resume over new session */
  sessionId?: CliSessionId;
  sessionName?: string;
  env?: Record<string, string>;
}

export interface LaunchResult {
  toolId: AiToolId;
  /** Native CLI session id — NEVER a panel pi-durable conversation id */
  sessionId: CliSessionId;
  cwd: string;
  /** OS pid of the spawned CLI process; absent means the spawn failed */
  pid?: number;
}

export interface SessionListItem {
  sessionId: string;
  cwd?: string;
  name?: string;
  path?: string;
  modifiedAt?: number;
}

export interface AiToolAdapter {
  readonly id: AiToolId;
  readonly capabilities: AiToolCapabilities;

  detect(): Promise<boolean>;
  launch(ctx: LaunchContext): Promise<LaunchResult>;
  resume(sessionId: CliSessionId, ctx: LaunchContext): Promise<LaunchResult>;
  listSessions?(cwd: string): Promise<SessionListItem[]>;
}
