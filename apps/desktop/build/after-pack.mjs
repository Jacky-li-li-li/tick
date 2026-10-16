/**
 * electron-builder afterPack 钩子：没有签名证书时给 .app 做 ad-hoc 签名。
 *
 * 为什么需要：Apple Silicon 上没有任何签名的包，用户下载后 macOS 会直接判定
 * 「已损坏，无法打开」；ad-hoc 签名（codesign --sign -）后至少是「无法验证开发者」，
 * 用户右键 → 打开 即可。做法与 yetone/magpie 一致。
 *
 * 时机：afterPack 在 electron-builder 打包完成、创建 dmg/zip 之前跑，
 * 所以 dmg 里装的是已签名的 app。有真实证书时（workflow 里 MAC_CERTS / CSC_LINK
 * 存在）直接跳过，交给 electron-builder 正常签名 + 公证。
 */
import { execFileSync } from "node:child_process";

export default async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  if (process.env.MAC_CERTS || process.env.CSC_LINK) {
    console.log("[after-pack] 检测到签名证书，跳过 ad-hoc 签名（由 electron-builder 正式签名）");
    return;
  }

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`;
  console.log(`[after-pack] 无证书：ad-hoc 签名 ${appPath}`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
    stdio: "inherit",
  });
  try {
    execFileSync("codesign", ["--verify", "--strict", "--verbose=2", appPath], {
      stdio: "inherit",
    });
  } catch {
    // 不在这里中断构建：workflow 的「校验产物」步骤会再验一次并给出上下文
    console.warn("[after-pack] ad-hoc 签名校验未通过，交给 workflow 的校验步骤判定");
  }
}
