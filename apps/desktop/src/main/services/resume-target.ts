import { parseCliSessionId, type CliSessionId } from "@tick/ai-core";

/** The fields resume needs from a persisted CLI session. */
export type KnownCliSession = {
  id: string;
  cwd?: string;
  toolId?: string;
  todoId?: string;
};

/**
 * Resolve an untrusted `ai:resume` request against the stored CLI sessions.
 * The session must already exist, which rejects panel session keys and any
 * other id we never created as a CLI session.
 */
export function resolveResumeTarget<T extends KnownCliSession>(
  lookup: (id: CliSessionId) => T | undefined,
  input: { sessionId: unknown; cwd?: string; toolId?: string },
): {
  sessionId: CliSessionId;
  existing: T;
  cwd: string;
  toolId: string;
  todoId?: string;
} {
  const sessionId = parseCliSessionId(input.sessionId);
  const existing = lookup(sessionId);
  if (!existing) {
    throw new Error(`unknown CLI session: ${sessionId}`);
  }
  const cwd = input.cwd?.trim() || existing.cwd;
  if (!cwd) {
    throw new Error("cwd is required to resume");
  }
  return {
    sessionId,
    existing,
    cwd,
    toolId: existing.toolId || input.toolId || "pi",
    todoId: existing.todoId,
  };
}
