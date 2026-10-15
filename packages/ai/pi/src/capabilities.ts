import type { AiToolCapabilities } from "@tick/ai-core";

export const PI_TOOL_ID = "pi" as const;

export const PI_CAPABILITIES: AiToolCapabilities = {
  needsCwd: true,
  resumeSession: true,
  deliverPrompt: "clipboard",
  listSessions: true,
};
