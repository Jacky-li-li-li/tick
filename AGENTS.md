# AGENTS.md

pnpm workspace（Node ≥20，pnpm）。Electron 桌面应用 + AI Adapter 包。产品/架构文档在 `docs/已对齐/`。

## 常用命令

- 安装：`pnpm install`
- 开发（弹出置顶面板）：`pnpm dev`（= `pnpm --filter @tick/desktop dev`）
- 构建：`pnpm build`
- 类型检查：`pnpm --filter @tick/desktop typecheck`（各包亦有 `typecheck`，如 `pnpm --filter @tick/ai-pi typecheck`）
- 无 lint 脚本。唯一单测：`node packages/ai/pi/test/argv.test.mjs`（Node 原生跑，无测试框架）
- 冒烟（需先 `pnpm install`，且环境变量 `DEEPSEEK_API_KEY`）：`node scripts/smoke-chat-deepseek.mts`、`node scripts/smoke-provider-switch.mts`

## 包与边界

- `apps/desktop`：唯一应用（Electron main + preload + React renderer）
- `packages/shared`：共享类型 / IPC 视图类型
- `packages/ai/core`：Adapter 接口、Registry、SessionIndex、会话命名空间策略；**不得依赖任何 `ai/<tool>`**
- `packages/ai/pi`：PiAdapter
- 依赖方向：`apps/desktop → shared / ai-core / ai-pi`；`ai/<tool> → shared`；禁止反向依赖
- 组合根：`apps/desktop/src/main/services/ai-host.ts`（实例化 PiAdapter 并注册进 core registry）

## 容易踩坑的接线

- Electron main 构建为 ESM（`dist-electron/main.mjs`），preload 为 CJS（`preload.cjs`）；见 `apps/desktop/vite.config.ts`，不要随意改动这两处格式
- `@earendil-works/*` 被打包进 main（因 ESM-only），未做 externalize
- IPC 面在 `apps/desktop/src/preload/index.ts`（暴露 `window.tick`）；新增通道要同时改 main 的 `ipcMain.handle` 与 preload
- 双会话命名空间必须隔离：CLI pi session id ≠ 面板 pi-durable conversation id；用 `@tick/ai-core` 的 session-policy 守卫，禁止把面板 id 当 CLI id 存储
- PiAdapter 把 prompt 写系统剪贴板（`deliverPrompt: 'clipboard'`）并 spawn `pi`；新 session id 从 `~/.pi/agent/sessions/--<encoded-cwd>--/` 读回（best-effort，依赖 400ms settle，已知脆弱）
- 面板 `ChatAgentHost` 无 `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` 时回退到 pi-ai 的 `faux` provider，工具调用是正则模拟 stub
- 持久化为 Electron userData 下的 JSON：`todos.json`、`cli-sessions.json`、`panel-chat/*.jsonl`；无 SQLite

## 文档

- 产品需求：`docs/已对齐/PRD-tick.md`
- 技术架构：`docs/已对齐/TECH-ARCH-tick.md`
- 文档可能滞后于代码；冲突时以代码/配置为准（例：飞书日历为 P1、尚未实现）
