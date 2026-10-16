# Tick

Tick 是一个始终置顶的桌面 Todo 面板（Electron monorepo）。

P0 目标：打开一个小窗口，完成本地 Todo 的增删改查与完成状态切换（软完成）。

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
  ai?: { toolId: string; sessionId: string; cwd: string }
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
- Renderer features：`list`、`editor`、`ai-picker`、`panel-chat`

已接 AI 包（本地）：

- `packages/ai/core`：`AiToolAdapter` / Registry / session 命名空间解析（`CliSessionId` / `PanelSessionKey` 品牌类型）
- `packages/ai/pi`：`PiAdapter`（clipboard + spawn `pi`；launch 预生成 UUIDv7 交给 `pi --session-id`；resume 只传已有 id + cwd）
- Main `ai:listTools|launch|resume` 已接到上述包（无 `pi` 二进制时 `available: false`）

仍占位：

- `clipboard:lastDelivered`（QA 可观测上次剪贴板投递）
- `todo:get` / `session:bind` / `session:get`（无 UI，仅 IPC 与 QA）
- 窗口位置记忆（F1）、新建 Todo 快捷键
- 飞书 / Feishu（明确不做）

## License

Private / WIP.

## AI 依赖版本

桌面端使用 `@earendil-works/pi-durable` / `pi-ai` `^1.2.0`（实际版本锁在 `pnpm-lock.yaml`；smoke 通过版本为 1.2.0）。

## 平台说明

macOS 上 launch / resume 通过 `open -a Terminal <launch.command>` 在真实终端里运行 pi，脚本把 pid 写入 pidfile 回传；`open` 成功但 3 秒内没有 pid 视为失败。非 macOS 回退到 detached spawn，此时 pi 无 TTY 会立即退出，`ai:launch` 会按 pid 是否拿到如实报告 `ok`。
