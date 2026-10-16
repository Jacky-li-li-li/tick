#!/usr/bin/env node
/**
 * 把 Casks/tick.rb 对齐到某个已发布的版本。
 *
 * 为什么需要这一步发生在发布之后：cask 里的 sha256 只能从产物算出来，而产物是 tag
 * 推上去之后 CI 才构建的。手抄四个哈希很容易抄错，所以直接读 Release 上的
 * SHA256SUMS.txt，重新生成整份 cask。
 *
 * 用法：node scripts/update-cask.mjs 0.1.5
 */
import { writeFileSync } from "node:fs";

const version = (process.argv[2] ?? "").replace(/^v/, "");
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("用法: node scripts/update-cask.mjs <version>，例如 0.1.5");
  process.exit(2);
}

const base = `https://github.com/Jacky-li-li-li/tick/releases/download/v${version}`;
let sums;
try {
  const response = await fetch(`${base}/SHA256SUMS.txt`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  sums = await response.text();
} catch (error) {
  console.error(`取不到 ${base}/SHA256SUMS.txt（${error.message}）。Release 发出来了吗？`);
  process.exit(1);
}

function sha256(arch) {
  const name = `Tick-${version}-${arch}.dmg`;
  const line = sums.split("\n").find((l) => l.endsWith(name));
  if (!line) {
    console.error(`SHA256SUMS.txt 里没有 ${name}`);
    process.exit(1);
  }
  return line.split(/\s+/)[0];
}

const asset = (arch) =>
  `https://github.com/Jacky-li-li-li/tick/releases/download/v#{version}/Tick-#{version}-${arch}.dmg`;

// url 上不写 verified：Homebrew 已废弃这个参数，默认行为就是拿下载地址的域名
// 跟 homepage 的域名比对，走 github.com 时本来就过。
writeFileSync(
  new URL("../Casks/tick.rb", import.meta.url),
  `cask "tick" do
  version "${version}"

  on_arm do
    sha256 "${sha256("arm64")}"
    url "${asset("arm64")}"
  end

  on_intel do
    sha256 "${sha256("x64")}"
    url "${asset("x64")}"
  end

  name "Tick"
  desc "Always-on-top todo panel"
  homepage "https://github.com/Jacky-li-li-li/tick"

  app "Tick.app"
end
`,
);

console.log(`Casks/tick.rb 已对齐到 ${version}`);
