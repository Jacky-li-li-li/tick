import type { AiToolId } from "./adapter.js";

/** Indexes CLI / external-tool sessions. MUST NOT store panel chat ids. */
export interface CliSessionRecord {
  toolId: AiToolId;
  sessionId: string;
  cwd: string;
  todoId?: string;
  lastOpenedAt: number;
  kind: "cli";
}

export interface SessionIndex {
  upsert(record: CliSessionRecord): Promise<void>;
  get(toolId: AiToolId, sessionId: string): Promise<CliSessionRecord | undefined>;
  listByTodo(todoId: string): Promise<CliSessionRecord[]>;
  listByTool(toolId: AiToolId): Promise<CliSessionRecord[]>;
  listAll(): Promise<CliSessionRecord[]>;
}

function key(toolId: string, sessionId: string): string {
  return `${toolId}\0${sessionId}`;
}

export function createSessionIndex(): SessionIndex {
  const store = new Map<string, CliSessionRecord>();

  return {
    async upsert(record) {
      if (record.kind !== "cli") {
        throw new Error("SessionIndex only accepts kind: cli");
      }
      store.set(key(record.toolId, record.sessionId), { ...record, kind: "cli" });
    },
    async get(toolId, sessionId) {
      return store.get(key(toolId, sessionId));
    },
    async listByTodo(todoId) {
      return [...store.values()].filter((r) => r.todoId === todoId);
    },
    async listByTool(toolId) {
      return [...store.values()].filter((r) => r.toolId === toolId);
    },
    async listAll() {
      return [...store.values()];
    },
  };
}
