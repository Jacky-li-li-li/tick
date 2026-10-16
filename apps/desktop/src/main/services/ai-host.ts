import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { clipboard } from "electron";
import {
  createAiToolRegistry,
  type AiToolRegistry,
  type CliSessionId,
  type LaunchContext,
} from "@tick/ai-core";
import { PiAdapter, registerPiAdapter } from "@tick/ai-pi";

export type AiHost = {
  registry: AiToolRegistry;
  pi: PiAdapter;
  /** sessionId → last known pid */
  pids: Map<string, number>;
  /** true if the last adapter clipboard write succeeded with non-empty text */
  consumeClipboardFlag: () => boolean;
  /** last text written for QA observability (may be empty) */
  peekLastClipboard: () => { text: string; at: string | null };
};

/** E2: true if process exists (signal 0). */
export function isPidAlive(pid: number | undefined | null): boolean {
  if (pid == null || !Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** A spawn outcome carries a real pid or the spawn failed. */
export type Spawned = { pid: number };

function spawnPiDetached(args: {
  bin: string;
  argv: string[];
  cwd: string;
  env?: Record<string, string>;
}): Promise<Spawned> {
  return new Promise((resolve, reject) => {
    const child = spawn(args.bin, args.argv, {
      cwd: args.cwd,
      env: { ...process.env, ...args.env },
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    const pid = child.pid;
    if (pid == null) {
      reject(new Error(`failed to spawn ${args.bin}`));
      return;
    }
    child.once("error", reject);
    child.unref();
    resolve({ pid });
  });
}

/** POSIX shell single-quote escaping. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Expand a leading `~` in user-supplied cwd (absolute paths pass through). */
function expandUserPath(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

async function pollPidFile(
  filePath: string,
  timeoutMs: number,
): Promise<number | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const raw = await readFile(filePath, "utf8");
      const pid = Number.parseInt(raw.trim(), 10);
      if (Number.isInteger(pid) && pid > 0) return pid;
    } catch {
      // pidfile not written yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return undefined;
}

/**
 * macOS: make pi visible in a real Terminal window via
 * `open -a Terminal <launch.command>` (no Apple Events permission needed).
 * The script records its own pid (kept by `exec pi`) into a pidfile so the
 * host still gets a real pid for `session:isAlive`. A missing pidfile means
 * the script never reached pi, so the launch fails instead of reporting a
 * bogus success.
 */
async function spawnPiInTerminal(args: {
  bin: string;
  argv: string[];
  cwd: string;
}): Promise<Spawned> {
  const id = randomUUID();
  const pidPath = path.join(os.tmpdir(), `tick-pi-${id}.pid`);
  const scriptPath = path.join(os.tmpdir(), `tick-pi-${id}.command`);
  const argvPart = args.argv.map(shellQuote).join(" ");
  const command = [
    "#!/bin/zsh",
    `cd ${shellQuote(args.cwd)} || exit 1`,
    `echo $$ > ${shellQuote(pidPath)}`,
    argvPart
      ? `exec ${shellQuote(args.bin)} ${argvPart}`
      : `exec ${shellQuote(args.bin)}`,
    "",
  ].join("\n");
  await writeFile(scriptPath, command, { mode: 0o700 });

  await new Promise<void>((resolve, reject) => {
    const child = spawn("open", ["-a", "Terminal", scriptPath], {
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`open -a Terminal exited with code ${code}`));
    });
  });

  const pid = await pollPidFile(pidPath, 3000);
  await unlink(pidPath).catch(() => {
    // best-effort cleanup
  });
  if (pid == null) {
    throw new Error("pi did not start in Terminal within 3s");
  }
  return { pid };
}

/**
 * Launch pi visibly on macOS. Terminal is the only path that gives pi a TTY,
 * so a failure there is reported rather than papered over with a detached
 * spawn that would exit silently.
 */
async function spawnPiVisible(args: {
  bin: string;
  argv: string[];
  cwd: string;
  env?: Record<string, string>;
}): Promise<Spawned> {
  if (process.platform === "darwin") {
    // env is intentionally not forwarded — Terminal runs the user's login
    // shell environment; PiAdapter currently passes no env anyway.
    return spawnPiInTerminal(args);
  }
  return spawnPiDetached(args);
}

export function createAiHost(): AiHost {
  const registry = createAiToolRegistry();
  const pids = new Map<string, number>();
  let lastClipboardOk = false;
  let lastClipboardText = "";
  let lastClipboardAt: string | null = null;
  const pi = registerPiAdapter(registry, {
    clipboard: {
      writeText: (text) => {
        try {
          clipboard.writeText(text);
          lastClipboardOk = typeof text === "string" && text.length > 0;
          lastClipboardText = typeof text === "string" ? text : "";
          lastClipboardAt = new Date().toISOString();
        } catch {
          lastClipboardOk = false;
          throw new Error("clipboard write failed");
        }
      },
    },
    spawnPi: spawnPiVisible,
  });
  return {
    registry,
    pi,
    pids,
    consumeClipboardFlag: () => {
      const v = lastClipboardOk;
      lastClipboardOk = false;
      return v;
    },
    peekLastClipboard: () => ({
      text: lastClipboardText,
      at: lastClipboardAt,
    }),
  };
}

export async function listToolsForIpc(host: AiHost) {
  const out: Array<{
    id: string;
    name: string;
    available: boolean;
    capabilities: {
      needsCwd: boolean;
      resumeSession: boolean;
      deliverPrompt: string;
      listSessions: boolean;
    };
  }> = [];
  for (const adapter of host.registry.list()) {
    out.push({
      id: adapter.id,
      name: adapter.id === "pi" ? "Pi" : adapter.id,
      available: await adapter.detect(),
      capabilities: { ...adapter.capabilities },
    });
  }
  return out;
}

function rememberPid(host: AiHost, sessionId: string, pid?: number) {
  if (pid != null && Number.isInteger(pid) && pid > 0) {
    host.pids.set(sessionId, pid);
  }
}

export async function launchViaHost(
  host: AiHost,
  input: {
    toolId: string;
    cwd: string;
    todoId?: string;
    prompt?: string;
    title?: string;
    body?: string;
  },
) {
  const adapter = host.registry.get(input.toolId);
  if (!adapter) throw new Error(`unknown tool: ${input.toolId}`);
  if (!(await adapter.detect())) {
    throw new Error(`tool not available: ${input.toolId}`);
  }
  const cwd = expandUserPath(input.cwd);
  if (!cwd) throw new Error("cwd is required");

  const promptTrim = input.prompt?.trim() ?? "";
  // E3: never invent a default "Todo" label for clipboard delivery
  const title =
    input.title?.trim() ||
    (promptTrim ? promptTrim.split("\n")[0] : "");
  if (!title) {
    throw new Error(
      "launch requires a title — pass todoId (with titled todo) or a non-empty prompt",
    );
  }
  const body =
    input.body?.trim() ||
    (promptTrim && promptTrim !== title ? promptTrim : undefined);

  const ctx: LaunchContext = {
    todoId: input.todoId ?? "",
    title,
    body,
    cwd,
  };
  // Reset flag so we only report this launch's write
  host.consumeClipboardFlag();
  const result = await adapter.launch(ctx);
  const clipboardOk = host.consumeClipboardFlag();
  rememberPid(host, result.sessionId, result.pid);

  return { ...result, clipboard: clipboardOk, title, body };
}

export async function resumeViaHost(
  host: AiHost,
  input: {
    toolId: string;
    sessionId: CliSessionId;
    cwd: string;
    todoId?: string;
  },
) {
  const adapter = host.registry.get(input.toolId);
  if (!adapter) throw new Error(`unknown tool: ${input.toolId}`);
  if (!(await adapter.detect())) {
    throw new Error(`tool not available: ${input.toolId}`);
  }
  const cwd = expandUserPath(input.cwd);
  if (!cwd) throw new Error("cwd is required");

  const ctx: LaunchContext = {
    todoId: input.todoId ?? "",
    title: "resume",
    cwd,
    sessionId: input.sessionId,
  };
  const result = await adapter.resume(input.sessionId, ctx);
  rememberPid(host, result.sessionId, result.pid);

  return result;
}

export function probeSessionAlive(
  host: AiHost,
  sessionId: string,
  persistedPid?: number,
): { sessionId: string; pid?: number; alive: boolean } {
  const pid = host.pids.get(sessionId) ?? persistedPid;
  return { sessionId, pid, alive: isPidAlive(pid) };
}
