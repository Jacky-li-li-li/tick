import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import type {
  AiToolAdapter,
  AiToolCapabilities,
  ClipboardPort,
  LaunchContext,
  LaunchResult,
  SessionListItem,
} from "@tick/ai-core";
import { assertCliSessionId, formatTodoPrompt } from "@tick/ai-core";
import { buildPiArgv } from "./argv.js";
import { PI_CAPABILITIES, PI_TOOL_ID } from "./capabilities.js";
import { detectPi, resolvePiBinary } from "./detect.js";
import {
  captureNewestPiSessionId,
  listPiSessionsForCwd,
} from "./session-store.js";

export interface PiAdapterOptions {
  resolveBinary?: () => Promise<string>;
  clipboard: ClipboardPort;
  /**
   * Spawn detached interactive TUI. Host supplies Electron-friendly spawn.
   */
  spawnPi: (args: {
    bin: string;
    argv: string[];
    cwd: string;
    env?: Record<string, string>;
  }) => Promise<void | { pid?: number }>;
  /**
   * After a new launch, capture the session id pi produced (do not invent formats).
   * Typically: list newest session for cwd from pi's session store.
   */
  captureSessionId?: (cwd: string) => Promise<string | undefined>;
  listSessionsForCwd?: (cwd: string) => Promise<SessionListItem[]>;
  /** Optional absolute path hint for `pi` binary */
  binaryHint?: string;
}

async function assertCwd(cwd: string): Promise<void> {
  if (!cwd || !path.isAbsolute(cwd)) {
    throw new Error("PiAdapter requires an absolute cwd");
  }
  await access(cwd, constants.R_OK);
}

export class PiAdapter implements AiToolAdapter {
  readonly id = PI_TOOL_ID;
  readonly capabilities: AiToolCapabilities = PI_CAPABILITIES;

  constructor(private readonly options: PiAdapterOptions) {}

  async detect(): Promise<boolean> {
    if (this.options.resolveBinary) {
      try {
        await this.options.resolveBinary();
        return true;
      } catch {
        return false;
      }
    }
    return detectPi(this.options.binaryHint);
  }

  private async bin(): Promise<string> {
    if (this.options.resolveBinary) return this.options.resolveBinary();
    const found = await resolvePiBinary(this.options.binaryHint);
    if (!found) throw new Error("pi binary not found on PATH");
    return found;
  }

  async launch(ctx: LaunchContext): Promise<LaunchResult> {
    await assertCwd(ctx.cwd);
    const bin = await this.bin();
    const text = formatTodoPrompt({ title: ctx.title, body: ctx.body });
    await this.options.clipboard.writeText(text);

    // New session: let pi create the id (no --session-id by default).
    const argv = buildPiArgv({ name: ctx.sessionName });
    const spawned = await this.options.spawnPi({
      bin,
      argv,
      cwd: ctx.cwd,
      env: ctx.env,
    });
    const pid = spawned && typeof spawned === "object" ? spawned.pid : undefined;

    // Brief settle so pi can create the session file before we read the store.
    await new Promise((r) => setTimeout(r, 400));
    const sessionId = await this.guessNewestSessionId(ctx.cwd);

    if (!sessionId) {
      throw new Error(
        "pi launched but session id could not be captured from the session store",
      );
    }
    assertCliSessionId(sessionId);

    return { toolId: this.id, sessionId, cwd: ctx.cwd, pid };
  }

  async resume(sessionId: string, ctx: LaunchContext): Promise<LaunchResult> {
    assertCliSessionId(sessionId);
    await assertCwd(ctx.cwd);
    const bin = await this.bin();
    const argv = buildPiArgv({ session: sessionId, name: ctx.sessionName });
    const spawned = await this.options.spawnPi({
      bin,
      argv,
      cwd: ctx.cwd,
      env: ctx.env,
    });
    const pid = spawned && typeof spawned === "object" ? spawned.pid : undefined;
    return { toolId: this.id, sessionId, cwd: ctx.cwd, pid };
  }

  async listSessions(cwd: string): Promise<SessionListItem[]> {
    if (this.options.listSessionsForCwd) {
      return this.options.listSessionsForCwd(cwd);
    }
    return listPiSessionsForCwd(cwd);
  }

  private async guessNewestSessionId(cwd: string): Promise<string | undefined> {
    if (this.options.captureSessionId) {
      return this.options.captureSessionId(cwd);
    }
    const fromHook = await captureNewestPiSessionId(cwd);
    if (fromHook) return fromHook;
    const items = await this.listSessions(cwd);
    return items[0]?.sessionId;
  }
}
