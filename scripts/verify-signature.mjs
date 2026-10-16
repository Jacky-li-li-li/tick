#!/usr/bin/env node
/**
 * 闸门：确认 .app 里每一个 Mach-O 都由 Developer ID 签过。
 *
 * 为什么需要：notarytool 只在几分钟后回一句 "The binary is not signed with a valid
 * Developer ID certificate"，不说是哪一步漏的。2026-10-16 的 v0.1.1 连挂三次就是
 * 这样：electron-builder 报了签字成功，产物里 Electron Framework 下面那批二进制
 * 其实还是 adhoc。把这条检查放在签名和公证之间，失败时直接给出文件清单。
 *
 * 用法：node scripts/verify-signature.mjs <path/to/App.app> [...]
 * 退出码 0 = 全部有 Developer ID；1 = 有漏签的，清单打到 stdout。
 */
import { spawnSync } from "node:child_process";
import { closeSync, openSync, readdirSync, readSync } from "node:fs";
import path from "node:path";

const MACHO_MAGICS = new Set([
  0xfeedface, 0xfeedfacf, // 32/64 位，小端机器上按大端读出
  0xcefaedfe, 0xcffaedfe,
  0xcafebabe, 0xcafebabf, // fat
]);

function isMachO(file) {
  let fd;
  try {
    fd = openSync(file, "r");
    const head = Buffer.alloc(4);
    if (readSync(fd, head, 0, 4, 0) < 4) return false;
    return MACHO_MAGICS.has(head.readUInt32BE(0));
  } catch {
    return false;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else if (entry.isFile()) yield full;
  }
}

function describe(file) {
  const run = spawnSync("/usr/bin/codesign", ["-dv", "--verbose=4", file], { encoding: "utf8" });
  const text = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  const authorities = [...text.matchAll(/^Authority=(.+)$/gm)].map((m) => m[1].trim());
  if (authorities.some((a) => a.startsWith("Developer ID Application"))) return "developer-id";
  if (authorities.length > 0) return `other:${authorities[0]}`;
  if (/not signed at all/.test(text)) return "unsigned";
  if (/adhoc/.test(text)) {
    // linker-signed 说明链接器写进去之后没人动过它；不带这个标记说明 codesign
    // 显式签过。两者都是 adhoc，但前者表示签名那一步根本没走到这个文件。
    return /linker-signed/.test(text) ? "never-touched" : "adhoc-resigned";
  }
  return "unknown";
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("用法: node scripts/verify-signature.mjs <path/to/App.app> [...]");
  process.exit(2);
}

for (const target of targets) {
  const missing = [];
  let checked = 0;
  for (const file of files(target)) {
    if (!isMachO(file)) continue;
    checked += 1;
    const verdict = describe(file);
    if (verdict !== "developer-id") missing.push([verdict, path.relative(target, file)]);
  }
  console.log(`${target}: 检查 ${checked} 个 Mach-O`);
  if (missing.length === 0) {
    console.log("全部由 Developer ID 签名");
    continue;
  }
  console.log(`缺 Developer ID 签名的有 ${missing.length} 个:`);
  for (const [verdict, rel] of missing) console.log(`  ${verdict.padEnd(14)} ${rel}`);
  process.exitCode = 1;
}
