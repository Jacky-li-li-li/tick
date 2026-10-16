# Tick

Tick 是一个始终置顶的桌面 Todo 面板（Electron monorepo），面板视觉是磨砂半透明玻璃（设计源在 `docs/ui/`）。

当前版本：`v0.1.5`（macOS）。

## 下载安装（macOS）

从 [Releases](https://github.com/Jacky-li-li-li/tick/releases) 下载对应芯片的安装包：

| 机器 | 文件 |
|------|------|
| Apple Silicon（M1/M2/M3/M4…） | `Tick-0.1.5-arm64.dmg` |
| Intel | `Tick-0.1.5-x64.dmg` |

打开 dmg，把 `Tick.app` 拖进「应用程序」。Release 里有 `SHA256SUMS.txt`，可用 `shasum -a 256 Tick-0.1.5-arm64.dmg` 对一下再装。

配了 Developer ID 的 Release 已签名 + 公证，双击即可打开。若拿到的是未签名的构建（本地打包、或仓库没配 Secrets 时 CI 出的包），首次打开会被 Gatekeeper 拦下来，任选一种放行：

- 右键点 App → 「打开」→ 对话框里再点「打开」（只需一次）
- 「系统设置 → 隐私与安全性」→ 找到 Tick 的提示 → 「仍要打开」
- 若提示的是「已损坏，无法打开」（个别系统对 ad-hoc 签名包也会这样），用命令行去隔离标记后再打开：
  `xattr -dr com.apple.quarantine /Applications/Tick.app`

要彻底消除这一步，需要在仓库 Secrets 里配 Developer ID（见下面「自己打包 / 发版」），配好后用户双击即可打开。

使用前提：

- AI 功能依赖本机已安装的 `pi` CLI；检测不到时「绑 AI」里不会列出该工具
- 面板对话需要先在面板里点「··· → 模型配置」填 API Key（Key 只存本机 pi 的 `~/.pi/agent/auth.json`，与 pi CLI 共享）

## Monorepo 结构

```
tick/
  apps/desktop/          # Electron 桌面应用（主入口）
  packages/shared/       # 共享类型（Todo / Session / AI）
  packages/ai/core/      # AI 核心（Registry / 契约 / session 命名空间）
  packages/ai/pi/        # PiAdapter（cwd / 剪贴板 / pi --session-id 与 --session）
```

## 安装

需要 Node.js 20+ 与 pnpm。测试脚本用 `tsx`，无测试框架：

```bash
pnpm install
```

## 运行桌面端

```bash
pnpm --filter @tick/desktop dev
# 或根目录：
pnpm desktop
```

## 类型检查与测试

```bash
pnpm typecheck   # 全部包 tsc --noEmit
pnpm test        # session 命名空间 / UUIDv7 / PiAdapter argv 行为
```

`pnpm test` 用 `tsx` 跑 `.mts` 测试，覆盖 CLI 与面板 session 命名空间隔离、`newCliSessionId` 的 UUIDv7 形状，以及 PiAdapter 的 `--session-id` / `--session` 行为。

## IPC v1

桌面端通过 preload 暴露 `window.tick`，通道如下：

### Todo

| Channel | 说明 |
|---------|------|
| `todo:list` | 列出全部 Todo |
| `todo:create` | 创建（`title` 必填，`content` 可选） |
| `todo:update` | 更新 title / content（不改 status） |
| `todo:setStatus` | 设置 `status: 'open' \| 'done'`（完成=软状态，不删除） |
| `todo:delete` | 删除 |

Todo 模型（`@tick/shared`）：

```ts
{
  id: string
  title: string
  content?: string
  status: 'open' | 'done'
  createdAt: string
  updatedAt: string
  ai?: {
    toolId: string
    sessionId: string
    cwd: string
    boundAt?: string   // 绑定时间（会话列表显示「今天 / 昨天」）
  }[]
}
```

> 无 `completed` 布尔字段。完成只能走 `todo:setStatus`。

### Window

| Channel | 说明 |
|---------|------|
| `window:getAlwaysOnTop` | 读取置顶状态（默认 `true`） |
| `window:setAlwaysOnTop` | 设置置顶 |
| `window:show` | 显示窗口 |
| `window:hide` | 隐藏窗口 |

### AI

| Channel | 说明 |
|---------|------|
| `ai:listTools` | 列出可用工具 |
| `ai:launch` | `{ toolId, cwd, todoId?, prompt? }` → 剪贴板 + spawn（P0 spawn 可 stub） |
| `ai:resume` | `{ toolId, sessionId, cwd }` |

### Session（CLI / 工具会话，非 chat）

| Channel | 说明 |
|---------|------|
| `session:list` | 列出会话 |
| `session:get` | 按 id 获取 |
| `session:bind` | 绑定 `{ sessionId, todoId }` |
| `session:isAlive` | E2 存活探针：`{ sessionId, pid?, alive }`（`process.kill(pid, 0)`） |

### Chat

`chat:*`（如 `chat:send`）使用独立命名空间，与 CLI session **隔离**。面板 session key 必须以 `panel:` 开头，CLI session id 必须是 UUID。两者在 Main 侧的 IPC 入口用 `parsePanelSessionKey` / `parseCliSessionId` 解析，形状不匹配直接拒绝。实现见 Main 侧 `ChatAgentHost`（`@earendil-works/pi-durable` + `pi-ai`，JSONL 存储），含 `create_todo` / `list_todos`。

## P0 范围

已实现：

- 始终置顶小面板（约 360×520，无边框）+ 置顶切换
- IPC v1 Todo CRUD + `setStatus` 软完成
- 列表默认显示 5 条未完成（open）；已完成（done）在展开后可见
- 置顶切换在面板 titlebar chrome 内（非设置页）
- 面板内编辑器新建 Todo（title 必填）
- `ai:*` / `session:*` / `chat:*` 通道已接通（launch / resume / chat 为真实实现）
- Renderer features：`todos`（列表 + 分段 + 添加）、`list`（行 + 竖条数字）、`sessions`（会话 sheet）、`editor`（AddTodoRow / TodoEditSheet）、`bind-wizard`、`chat`、`model-config`、`common`（遮罩 + 弹层）

已接 AI 包（本地）：

- `packages/ai/core`：`AiToolAdapter` / Registry / session 命名空间解析（`CliSessionId` / `PanelSessionKey` 品牌类型）
- `packages/ai/pi`：`PiAdapter`（clipboard + spawn `pi`；launch 预生成 UUIDv7 交给 `pi --session-id`；resume 只传已有 id + cwd）
- Main `ai:listTools|launch|resume` 已接到上述包（无 `pi` 二进制时 `available: false`）

仍占位：

- `clipboard:lastDelivered`（QA 可观测上次剪贴板投递）
- `todo:get` / `session:bind` / `session:get`（无 UI，仅 IPC 与 QA）
- 窗口位置记忆（F1）、新建 Todo 快捷键
- 飞书 / Feishu（明确不做）

## 自己打包 / 发版

```bash
pnpm install
pnpm --filter @tick/desktop dist       # 产出 apps/desktop/release/*.dmg + *.zip（arm64 + x64）
pnpm --filter @tick/desktop dist:dir   # 只出 .app，不压 dmg（本地调试更快）
```

打 tag 会触发 `.github/workflows/release.yml`：跑 typecheck + test，构建两个架构的 dmg/zip，挂到 GitHub Release。

```bash
git tag v0.1.5 && git push origin v0.1.5
```

签名 / 公证沿用 `Jacky-li-li-li/Look` 项目那套（Secrets 名字保持一致，值取自同一份 Developer ID 证书）。Secrets 是**仓库级**的，需要在 tick 仓库再建一次（值抄 Look 用的那份）：

| Secret | 内容 |
|--------|------|
| `MAC_CERTS` | Developer ID Application 证书 `.p12` 的 base64：Keychain Access → 选中「证书 + 私钥」→ 导出 `.p12` → `base64 -i 证书.p12 \| pbcopy` |
| `MAC_CERT_PASSWORD` | 导出 `.p12` 时设置的密码 |
| `APPLE_ID` | 公证用的 Apple ID |
| `APPLE_APP_SPECIFIC_PASSWORD` | 在 appleid.apple.com 生成的 App-Specific 密码 |
| `APPLE_TEAM_ID` | Apple Developer Team ID（10 位） |

配齐后 CI 会把证书导入临时 keychain，由 electron-builder 签名 + 公证（`build.mac.notarize: true`，公证偶发超时自动重试 3 次），产物即可双击打开；没配则自动退化为未签名包，走上面的 Gatekeeper 放行。

> 本机打包需要能访问 `github.com` 下载 Electron 运行时。网络受限时可复用已装的 Electron：
> `./node_modules/.bin/electron-builder --mac --dir -c.electronDist=<repo>/node_modules/.pnpm/electron@33.4.11/node_modules/electron/dist`

## License

Private / WIP.

## AI 依赖版本

桌面端使用 `@earendil-works/pi-durable` / `pi-ai` `^1.2.0`（实际版本锁在 `pnpm-lock.yaml`；smoke 通过版本为 1.2.0）。

## 平台说明

macOS 上 launch / resume 通过 `open -a Terminal <launch.command>` 在真实终端里运行 pi，脚本把 pid 写入 pidfile 回传；`open` 成功但 3 秒内没有 pid 视为失败。非 macOS 回退到 detached spawn，此时 pi 无 TTY 会立即退出，`ai:launch` 会按 pid 是否拿到如实报告 `ok`。
