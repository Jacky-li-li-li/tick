/**
 * Read pi's on-disk session store. We do not invent the file format —
 * only list ids from filenames under ~/.pi/agent/sessions (or overrides).
 *
 * Layout (pi docs): ~/.pi/agent/sessions/--<encoded-cwd>--/<timestamp>_<session-id>.jsonl
 */
import { readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { SessionListItem } from "@tick/ai-core";

/** Encode cwd the way pi groups session dirs (best-effort per public docs). */
export function encodePiSessionCwd(cwd: string): string {
  const normalized = path.resolve(cwd);
  const withoutRoot = normalized.replace(/^[/\\]/, "");
  return withoutRoot.replace(/[/\\:]/g, "-");
}

export function defaultPiSessionRoot(): string {
  return (
    process.env.PI_CODING_AGENT_SESSION_DIR ||
    path.join(os.homedir(), ".pi", "agent", "sessions")
  );
}

export async function listPiSessionsForCwd(
  cwd: string,
  sessionRoot = defaultPiSessionRoot(),
): Promise<SessionListItem[]> {
  const dir = path.join(sessionRoot, `--${encodePiSessionCwd(cwd)}--`);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }

  const items: SessionListItem[] = [];
  for (const name of names) {
    if (!name.endsWith(".jsonl")) continue;
    // <timestamp>_<session-id>.jsonl — session id may contain underscores
    const base = name.slice(0, -".jsonl".length);
    const underscore = base.indexOf("_");
    if (underscore < 0) continue;
    const sessionId = base.slice(underscore + 1);
    if (!sessionId) continue;
    const full = path.join(dir, name);
    let modifiedAt: number | undefined;
    try {
      modifiedAt = (await stat(full)).mtimeMs;
    } catch {
      // ignore
    }
    items.push({
      sessionId,
      cwd,
      path: full,
      modifiedAt,
    });
  }
  return items.sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0));
}
