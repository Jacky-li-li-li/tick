# Tick

Tick 是一个始终置顶的桌面 Todo 面板（Electron monorepo）。

P0 目标：打开一个小窗口，完成本地 Todo 的增删改查与完成状态切换（软完成）。

## Monorepo 结构

```
tick/
  apps/desktop/          # Electron 桌面应用（主入口）
  packages/shared/       # 共享类型（Todo / Session / AI）
  packages/ai/core/      # AI 核心（占位）
  packages/ai/pi/        # Pi adapter（占位）
```

## 安装

需要 Node.js 20+ 与 pnpm：

```bash
pnpm install
```

## 运行桌面端

```bash
pnpm --filter @tick/desktop dev
# 或根目录：
pnpm desktop
```

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

### Chat

`chat:*`（如 `chat:send`）使用独立的 `sessionId` 命名空间，与 CLI session **隔离**。P0 为 stub。

## P0 范围

已实现：

- 始终置顶小面板（约 360×520，无边框）+ 置顶切换
- IPC v1 Todo CRUD + `setStatus` 软完成
- 列表默认显示 5 条未完成（open）；已完成（done）在展开后可见
- 置顶切换在面板 titlebar chrome 内（非设置页）
- 面板内编辑器新建 Todo（title 必填）
- `ai:*` / `session:*` / `chat:send` 通道已挂载（launch/resume/chat 为 stub）
- Renderer features：`list`、`editor`、`ai-picker`、`panel-chat`

占位：

- `packages/ai/core`、`packages/ai/pi`
- 真实 AI spawn / panel chat
- 飞书 / Feishu（明确不做）

## License

Private / WIP.
