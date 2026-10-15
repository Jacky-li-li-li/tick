/**
 * Build argv for the `pi` CLI. No shell string concat.
 * Launch (new): omit --session / --session-id; pi creates the id; Adapter captures it.
 * Resume: pass --session <id|path> with existing id + spawn cwd.
 */
export function buildPiArgv(input: {
  /** Resume: official `--session <path|id>` */
  session?: string;
  /** New session only if smoke requires pre-allocated id — default omit */
  sessionId?: string;
  name?: string;
}): string[] {
  const argv: string[] = [];

  if (input.session && input.sessionId) {
    throw new Error("pi: --session and --session-id are mutually exclusive");
  }
  if (input.session) {
    argv.push("--session", input.session);
  } else if (input.sessionId) {
    argv.push("--session-id", input.sessionId);
  }
  if (input.name) {
    argv.push("--name", input.name);
  }
  return argv;
}
