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
- 面板 `ChatAgentHost` 用 `builtinModels({ credentials })`（`@earendil-works/pi-ai/providers/all`）；凭据经 `PiAuthFileCredentialStore` 读写 pi 的 `~/.pi/agent/auth.json`（**与 pi CLI 共享**）；模型选择存 tick 侧 `model-config.json`（`ModelConfigStore`，不动 pi settings）；`model:*` IPC：status / saveKey / clearKey（= `CredentialStore.delete`，登出）/ test / setSelected
- `model:status` 全量返回 42 个 builtin provider 的完整模型目录（openrouter 393 / vercel-ai-gateway 245 等，**不截断**），模型选择器靠搜索 + 滚动承载；`typesafe` 目录为空（动态目录），这类 provider 选不了模型。注意「已配置」只统计 auth.json 里的凭据，环境变量（如 `MOONSHOT_API_KEY`）提供的 ambient auth 会被 `models.getAvailable()` 选中但不显示为已配置
- 无可用凭据时 `ChatAgentHost` 回退到 pi-ai 的 `faux` provider，工具调用是正则模拟 stub
- `todo.ai` 是数组（一个 todo 可绑多个 CLI 会话，按 sessionId 去重；旧的单对象形态在 `TodoStore.load` 自动迁移）——绑定时 `TodoStore.bindAi` 补 `boundAt`（会话 sheet 显示「今天 / 昨天」）
- 面板 chat 多会话：`panel-sessions.json` 为 `{conversationId,title,updatedAt}`（旧的 bare-string 自动迁移）；会话标题取首条消息前 16 字；`chat:sessions` 供列表
- 玻璃面板：窗口是 `frame:false` + macOS `transparent:true` + `vibrancy:'under-window'`（`main/index.ts`，非 macOS 走不透明底色）；renderer 只叠半透明玻璃色，**不要在 `.panel` 上加 `backdrop-filter`**（会与 vibrancy 打架），弹层 `.menu` / `.sheet` 才用 `backdrop-filter` 模糊面板内容
- Renderer（19 帧设计源见 `docs/ui/`）：顶栏分段 `待办|对话` + `···` 菜单；`features/todos/TodosView`（页内分段 待办/已完成 + 列表 + 添加 + sheets）；`features/list/TodoList`（行 + 竖条数字）；`features/sessions/SessionsSheet`（竖条数字 → 会话列表 → 打开 / 再绑）；`features/editor`（AddTodoRow + TodoEditSheet）；`features/bind-wizard`；`features/chat`；`features/model-config`（整页视图）；`features/common/Sheet`（遮罩 + 弹层，遮罩必须在弹层之下）。旧的 `TodoEditModal`、`ai-picker`、`panel-chat`、`TodoEditor` 已移除
- 持久化为 Electron userData 下的 JSON：`todos.json`、`cli-sessions.json`、`panel-chat/*.jsonl`；无 SQLite

## 发版

- 本地出包：`pnpm --filter @tick/desktop dist`（dmg + zip，arm64/x64）→ `apps/desktop/release/`（已 gitignore）；`dist:dir` 只出 `.app`
- 打 tag（`v0.1.0`）触发 `.github/workflows/release.yml`（macos-14：typecheck + test → 构建 → 挂 GitHub Release）；手动 `workflow_dispatch` 只出 Artifacts
- 签名 / 公证靠仓库 Secrets：`CSC_LINK` / `CSC_KEY_PASSWORD` / `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`；未配置时 workflow 设 `CSC_IDENTITY_AUTO_DISCOVERY=false`，产出未签名包（README 有 Gatekeeper 放行说明）
- 图标 `apps/desktop/build/icon.png`（1024，electron-builder 转 icns）；entitlements 在 `apps/desktop/build/entitlements.mac.plist`；`build.mac.target` 决定架构
- 打包后 `extraResources` 把 `apps/desktop/resources` 放到 `Contents/Resources/resources`，main 侧统一走 `assetPath()` 兼容开发态与打包态（asar 内的 `nativeImage.createFromPath` 不可靠）
- `dist` 脚本带 `--publish never`：CI 环境下 electron-builder 会隐式 publish 去连 GitHub，显式关掉
- 本机打包要能下载 Electron（github.com）；受限时用 `-c.electronDist=<本地 electron/dist>` 复用已装运行时

## 文档

- 产品需求：`docs/已对齐/PRD-tick.md`
- 技术架构：`docs/已对齐/TECH-ARCH-tick.md`
- 文档可能滞后于代码；冲突时以代码/配置为准（例：飞书日历为 P1、尚未实现）
