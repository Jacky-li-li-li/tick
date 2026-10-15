import { spawn } from "node:child_process";
import { clipboard } from "electron";
import {
  createAiToolRegistry,
  createSessionIndex,
  rejectCrossNamespaceSessionId,
  type AiToolRegistry,
  type LaunchContext,
  type SessionIndex,
} from "@tick/ai-core";
import { PiAdapter, registerPiAdapter } from "@tick/ai-pi";

export type AiHost = {
  registry: AiToolRegistry;
  sessionIndex: SessionIndex;
  pi: PiAdapter;
  /** sessionId → last known pid */
  pids: Map<string, number>;
  /** true if the last adapter clipboard write succeeded with non-empty text */
  consumeClipboardFlag: () => boolean;
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

function spawnPiDetached(args: {
  bin: string;
  argv: string[];
  cwd: string;
  env?: Record<string, string>;
}): Promise<{ pid?: number }> {
  return new Promise((resolve, reject) => {
    try {
      const child = spawn(args.bin, args.argv, {
        cwd: args.cwd,
        env: { ...process.env, ...args.env },
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      });
      child.on("error", reject);
      const pid = child.pid;
      child.unref();
      resolve({ pid });
    } catch (err) {
      reject(err);
    }
  });
}

export function createAiHost(): AiHost {
  const registry = createAiToolRegistry();
  const sessionIndex = createSessionIndex();
  const pids = new Map<string, number>();
  let lastClipboardOk = false;
  const pi = registerPiAdapter(registry, {
    clipboard: {
      writeText: (text) => {
        try {
          clipboard.writeText(text);
          lastClipboardOk = typeof text === "string" && text.length > 0;
        } catch {
          lastClipboardOk = false;
          throw new Error("clipboard write failed");
        }
      },
    },
    spawnPi: spawnPiDetached,
  });
  return {
    registry,
    sessionIndex,
    pi,
    pids,
    consumeClipboardFlag: () => {
      const v = lastClipboardOk;
      lastClipboardOk = false;
      return v;
    },
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
  if (!input.cwd) throw new Error("cwd is required");

  const promptTrim = input.prompt?.trim() ?? "";
  const title =
    input.title?.trim() ||
    (promptTrim ? promptTrim.split("\n")[0] : "") ||
    "Todo";
  const body =
    input.body?.trim() ||
    (promptTrim && promptTrim !== title ? promptTrim : undefined);

  const ctx: LaunchContext = {
    todoId: input.todoId ?? "",
    title,
    body,
    cwd: input.cwd,
  };
  // Reset flag so we only report this launch's write
  host.consumeClipboardFlag();
  const result = await adapter.launch(ctx);
  const clipboardOk = host.consumeClipboardFlag();
  rejectCrossNamespaceSessionId("cli", result.sessionId);
  rememberPid(host, result.sessionId, result.pid);

  await host.sessionIndex.upsert({
    toolId: result.toolId,
    sessionId: result.sessionId,
    cwd: result.cwd,
    todoId: input.todoId,
    lastOpenedAt: Date.now(),
    kind: "cli",
  });

  return { ...result, clipboard: clipboardOk, title, body };
}

export async function resumeViaHost(
  host: AiHost,
  input: { toolId: string; sessionId: string; cwd: string; todoId?: string },
) {
  rejectCrossNamespaceSessionId("cli", input.sessionId);
  const adapter = host.registry.get(input.toolId);
  if (!adapter) throw new Error(`unknown tool: ${input.toolId}`);
  if (!(await adapter.detect())) {
    throw new Error(`tool not available: ${input.toolId}`);
  }
  if (!input.cwd) throw new Error("cwd is required");

  const ctx: LaunchContext = {
    todoId: input.todoId ?? "",
    title: "resume",
    cwd: input.cwd,
    sessionId: input.sessionId,
  };
  const result = await adapter.resume(input.sessionId, ctx);
  rememberPid(host, result.sessionId, result.pid);

  await host.sessionIndex.upsert({
    toolId: result.toolId,
    sessionId: result.sessionId,
    cwd: result.cwd,
    todoId: input.todoId,
    lastOpenedAt: Date.now(),
    kind: "cli",
  });

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
