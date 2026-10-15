import type { DeliverPromptMode } from "./adapter.js";

export interface PromptDelivery {
  mode: DeliverPromptMode;
  deliver(text: string): Promise<void>;
}

export function formatTodoPrompt(input: { title: string; body?: string }): string {
  const title = input.title.trim();
  const body = input.body?.trim();
  if (!body) return title;
  return `${title}\n\n${body}`;
}

/** Host-provided clipboard (Electron clipboard.writeText in Main). */
export interface ClipboardPort {
  writeText(text: string): void | Promise<void>;
}

export function createClipboardPromptDelivery(clipboard: ClipboardPort): PromptDelivery {
  return {
    mode: "clipboard",
    async deliver(text) {
      await clipboard.writeText(text);
    },
  };
}
