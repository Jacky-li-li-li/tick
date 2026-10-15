/**
 * AI core placeholder.
 * Future: Registry, SessionIndex, model routing, etc.
 */

export interface Registry {
  // stub — register providers / tools later
  list(): string[];
}

export interface SessionIndex {
  // stub — session lookup later
  get(id: string): unknown | undefined;
}

export function createRegistry(): Registry {
  return {
    list: () => [],
  };
}

export function createSessionIndex(): SessionIndex {
  return {
    get: () => undefined,
  };
}
