import type { AiToolAdapter, AiToolId } from "./adapter.js";

export interface AiToolRegistry {
  register(adapter: AiToolAdapter): void;
  get(id: AiToolId): AiToolAdapter | undefined;
  list(): AiToolAdapter[];
}

export function createAiToolRegistry(): AiToolRegistry {
  const byId = new Map<string, AiToolAdapter>();

  return {
    register(adapter) {
      byId.set(adapter.id, adapter);
    },
    get(id) {
      return byId.get(id);
    },
    list() {
      return [...byId.values()];
    },
  };
}
