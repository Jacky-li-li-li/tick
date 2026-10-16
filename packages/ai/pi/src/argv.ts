/**
 * Build argv for the `pi` CLI. No shell string concat.
 * Launch (new): pass `--session-id <uuid>` so pi creates the session under an
 * id we already hold. Resume: pass `--session <id>` for an existing session.
 */
export function buildPiArgv(input: {
  /** Resume: official `--session <path|id>` */
  session?: string;
  /** New session: pre-allocated id, pi creates the session under it */
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
