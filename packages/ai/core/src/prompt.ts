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
