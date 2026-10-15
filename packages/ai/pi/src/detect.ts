import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function resolvePiBinary(
  hint?: string,
): Promise<string | undefined> {
  const candidates = hint ? [hint] : ["pi"];
  for (const bin of candidates) {
    try {
      if (bin.includes("/") || bin.includes("\\")) {
        await access(bin, constants.X_OK);
        return bin;
      }
      await execFileAsync(bin, ["--version"], {
        timeout: 5000,
        windowsHide: true,
      });
      return bin;
    } catch {
      // try next
    }
  }
  return undefined;
}

export async function detectPi(hint?: string): Promise<boolean> {
  return (await resolvePiBinary(hint)) !== undefined;
}
