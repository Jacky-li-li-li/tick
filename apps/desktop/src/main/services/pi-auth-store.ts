/**
 * File-backed CredentialStore over pi's auth.json (~/.pi/agent/auth.json).
 *
 * Shared with the pi CLI: credentials configured on either side are visible
 * to both. The file shape matches pi's own store — one type-tagged credential
 * per provider id, e.g. `{ "deepseek": { "type": "api_key", "key": "..." } }`.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  AuthOperationOptions,
  Credential,
  CredentialInfo,
  CredentialStore,
} from "@earendil-works/pi-ai";

type AuthFileShape = Record<string, Credential>;

export function defaultPiAuthFilePath(): string {
  return path.join(os.homedir(), ".pi", "agent", "auth.json");
}

export class PiAuthFileCredentialStore implements CredentialStore {
  /** Serialize writes (modify/delete) through one chain per store instance. */
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string = defaultPiAuthFilePath()) {}

  async read(
    providerId: string,
    _options?: AuthOperationOptions,
  ): Promise<Credential | undefined> {
    const { data } = await this.readFile();
    return data[providerId];
  }

  async list(
    _options?: AuthOperationOptions,
  ): Promise<readonly CredentialInfo[]> {
    const { data } = await this.readFile();
    return Object.entries(data).map(([providerId, credential]) => ({
      providerId,
      type: credential.type,
    }));
  }

  async modify(
    providerId: string,
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
    _options?: AuthOperationOptions,
  ): Promise<Credential | undefined> {
    return this.enqueue(async () => {
      const { data, corrupt } = await this.readFile();
      if (corrupt) {
        throw new Error(`pi auth.json 无法解析，拒绝写入：${this.filePath}`);
      }
      const next = await fn(data[providerId]);
      // undefined = leave the entry unchanged (CredentialStore contract).
      if (next === undefined) return data[providerId];
      data[providerId] = next;
      await this.writeFile(data);
      return next;
    });
  }

  async delete(
    providerId: string,
    _options?: AuthOperationOptions,
  ): Promise<void> {
    await this.enqueue(async () => {
      const { data, corrupt } = await this.readFile();
      if (corrupt) {
        throw new Error(`pi auth.json 无法解析，拒绝写入：${this.filePath}`);
      }
      if (!(providerId in data)) return;
      delete data[providerId];
      await this.writeFile(data);
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.chain.then(task, task);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async readFile(): Promise<{ data: AuthFileShape; corrupt: boolean }> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, "utf8");
    } catch {
      return { data: {}, corrupt: false }; // missing file is fine
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { data: parsed as AuthFileShape, corrupt: false };
      }
      return { data: {}, corrupt: true };
    } catch {
      return { data: {}, corrupt: true };
    }
  }

  private async writeFile(data: AuthFileShape): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tick-tmp`;
    await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
    await rename(tmp, this.filePath);
  }
}
