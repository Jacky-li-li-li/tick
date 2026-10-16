export { PI_TOOL_ID, PI_CAPABILITIES } from "./capabilities.js";
export { buildPiArgv } from "./argv.js";
export { newCliSessionId } from "./session-id.js";
export { detectPi, resolvePiBinary } from "./detect.js";
export { PiAdapter } from "./pi-adapter.js";
export type { PiAdapterOptions } from "./pi-adapter.js";
export {
  encodePiSessionCwd,
  defaultPiSessionRoot,
  listPiSessionsForCwd,
} from "./session-store.js";

import type { AiToolRegistry } from "@tick/ai-core";
import { PiAdapter, type PiAdapterOptions } from "./pi-adapter.js";

/** Register PiAdapter on a core registry (Main wiring helper). */
export function registerPiAdapter(
  registry: AiToolRegistry,
  options: PiAdapterOptions,
): PiAdapter {
  const adapter = new PiAdapter(options);
  registry.register(adapter);
  return adapter;
}
