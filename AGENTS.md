# AGENTS.md

pnpm workspace（Node ≥20，pnpm）。Electron 桌面应用 + AI Adapter 包。产品/架构文档在 `docs/已对齐/`。

## 常用命令

- 安装：`pnpm install`
- 开发（弹出置顶面板）：`pnpm dev`（= `pnpm --filter @tick/desktop dev`）
- 构建：`pnpm build`
- 类型检查：`pnpm --filter @tick/desktop typecheck`（各包亦有 `typecheck`，如 `pnpm --filter @tick/ai-pi typecheck`）
- 无 lint 脚本。测试：`pnpm test`（`tsx` 跑 `.mts`，无测试框架；覆盖 session 命名空间、UUIDv7、PiAdapter argv）
- 冒烟（需先 `pnpm install`，且环境变量 `DEEPSEEK_API_KEY`）：`node scripts/smoke-chat-deepseek.mts`、`node scripts/smoke-provider-switch.mts`

## 包与边界

- `apps/desktop`：唯一应用（Electron main + preload + React renderer）
- `packages/shared`：共享类型 / IPC 视图类型
- `packages/ai/core`：Adapter 接口、Registry、会话命名空间解析（`CliSessionId` / `PanelSessionKey`）；**不得依赖任何 `ai/<tool>`**
- `packages/ai/pi`：PiAdapter
- 依赖方向：`apps/desktop → shared / ai-core / ai-pi`；`ai/<tool> → shared`；禁止反向依赖
- 组合根：`apps/desktop/src/main/services/ai-host.ts`（实例化 PiAdapter 并注册进 core registry）

## 容易踩坑的接线

- Electron main 构建为 ESM（`dist-electron/main.mjs`），preload 为 CJS（`preload.cjs`）；见 `apps/desktop/vite.config.ts`，不要随意改动这两处格式
- `@earendil-works/*` 被打包进 main（因 ESM-only），未做 externalize
- IPC 面在 `apps/desktop/src/preload/index.ts`（暴露 `window.tick`）；新增通道要同时改 main 的 `ipcMain.handle` 与 preload
- 双会话命名空间必须隔离：CLI pi session id ≠ 面板 pi-durable conversation id。`@tick/ai-core` 的 `parseCliSessionId` 要求 UUID，`parsePanelSessionKey` 要求 `panel:` 前缀，两者在 Main 的 IPC 入口解析；面板 id 进不了 `ai:resume`（那还要能查到已存 CLI session），CLI id 也进不了 `chat:*`
- `ai:launch` / `ai:resume` 的成功状态来自真实 pid，不再硬编码 `ok: true`；macOS 上 Terminal launch 拿不到 pid 视为失败，非 macOS detached spawn 无 TTY 会退出，也会如实报 `ok: false`
- PiAdapter 把 prompt 写系统剪贴板（`deliverPrompt: 'clipboard'`）；launch 预生成 UUIDv7 session id（`packages/ai/pi/src/session-id.ts` 的 `newCliSessionId`）交给 `pi --session-id` 由 pi 落盘，不做事后捕获
- macOS 上 launch/resume 经 `open -a Terminal <launch.command>` 在真实终端里可见运行 pi（脚本将 pid 写入 pidfile 回传）；非 macOS 回退 detached spawn——注意：无 TTY 时 pi 会静默退出
- 面板 `ChatAgentHost` 用 `builtinModels({ credentials })`（`@earendil-works/pi-ai/providers/all`）；凭据经 `PiAuthFileCredentialStore` 读写 pi 的 `~/.pi/agent/auth.json`（**与 pi CLI 共享**）；模型选择存 tick 侧 `model-config.json`（`ModelConfigStore`，不动 pi settings）；`model:*` IPC：status / saveKey / test / setSelected
- 无可用凭据时 `ChatAgentHost` 回退到 pi-ai 的 `faux` provider，工具调用是正则模拟 stub
- `todo.ai` 是数组（一个 todo 可绑多个 CLI 会话，按 sessionId 去重；旧的单对象形态在 `TodoStore.load` 自动迁移）
- 面板 chat 多会话：`panel-sessions.json` 为 `{conversationId,title,updatedAt}`（旧的 bare-string 自动迁移）；会话标题取首条消息前 16 字；`chat:sessions` 供列表
- Renderer：`todos`（列表 + 详情展开 + 向导入口）/ `chat`（多会话）/ `bind-wizard` / `model-config` / `editor`（AddTodoRow + TodoEditModal）；旧的 `ai-picker`、`panel-chat`、`TodoEditor` 已移除
- 持久化为 Electron userData 下的 JSON：`todos.json`、`cli-sessions.json`、`panel-chat/*.jsonl`；无 SQLite

## 文档

- 产品需求：`docs/已对齐/PRD-tick.md`
- 技术架构：`docs/已对齐/TECH-ARCH-tick.md`
- 文档可能滞后于代码；冲突时以代码/配置为准（例：飞书日历为 P1、尚未实现）
