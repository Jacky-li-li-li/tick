import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import type {
  AiToolAdapter,
  AiToolCapabilities,
  ClipboardPort,
  CliSessionId,
  LaunchContext,
  LaunchResult,
  SessionListItem,
} from "@tick/ai-core";
import { formatTodoPrompt } from "@tick/ai-core";
import { buildPiArgv } from "./argv.js";
import { PI_CAPABILITIES, PI_TOOL_ID } from "./capabilities.js";
import { detectPi, resolvePiBinary } from "./detect.js";
import { newCliSessionId } from "./session-id.js";
import { listPiSessionsForCwd } from "./session-store.js";

export interface PiAdapterOptions {
  resolveBinary?: () => Promise<string>;
  clipboard: ClipboardPort;
  /**
   * Spawn pi in a real terminal. Must resolve with the pi process pid, or
   * reject when the process could not be started.
   */
  spawnPi: (args: {
    bin: string;
    argv: string[];
    cwd: string;
    env?: Record<string, string>;
  }) => Promise<{ pid: number }>;
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

    // Pre-allocate the session id: `pi --session-id <id>` creates the session
    // under this exact id if missing (verified with pi 1.2.0), so the
    // todo→session binding is deterministic and needs no post-launch capture.
    const sessionId = newCliSessionId();

    const argv = buildPiArgv({ sessionId, name: ctx.sessionName });
    const { pid } = await this.options.spawnPi({
      bin,
      argv,
      cwd: ctx.cwd,
      env: ctx.env,
    });

    return { toolId: this.id, sessionId, cwd: ctx.cwd, pid };
  }

  async resume(sessionId: CliSessionId, ctx: LaunchContext): Promise<LaunchResult> {
    await assertCwd(ctx.cwd);
    const bin = await this.bin();
    const argv = buildPiArgv({ session: sessionId, name: ctx.sessionName });
    const { pid } = await this.options.spawnPi({
      bin,
      argv,
      cwd: ctx.cwd,
      env: ctx.env,
    });
    return { toolId: this.id, sessionId, cwd: ctx.cwd, pid };
  }

  async listSessions(cwd: string): Promise<SessionListItem[]> {
    if (this.options.listSessionsForCwd) {
      return this.options.listSessionsForCwd(cwd);
    }
    return listPiSessionsForCwd(cwd);
  }
}
