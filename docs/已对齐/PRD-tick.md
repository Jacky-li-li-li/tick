# PRD · Tick 置顶 Todo 工作台（AI Session）

| 字段 | 内容 |
|------|------|
| 状态 | v0.2 修订中 |
| 版本 | v0.2 |
| 日期 | 2026-10-16 |
| 平台 | macOS 优先（Electron）；安装形态后期对齐 `install.sh` + `.app` |
| 会话执行层 | pi（`@earendil-works/pi-durable` + 完整 `pi-ai` + 本机 `pi` CLI） |
| 原则 | 上层产品我们定义；不违背 pi 的 session / provider / 消息与工具语义 |
| 首版范围 | 本地 Todo + pi 拉起 + 面板对话；**飞书日历移至 P1** |

---

## 1. 背景与问题

### 1.1 现状痛点

1. **任务 → AI 成本高**：看到待办事项后，手工复制标题/描述到 AI 工具，约 **5 分钟/次**（飞书日历来源为 P1）。
2. **事后找回难**：多个 AI 会话并存时，只能靠标题猜测对应哪次任务，再次定位更耗时。
3. **工具割裂**：Todo、来源、AI 会话分属不同界面，缺少「选中任务 → 立刻开/回会话」的闭环。

### 1.2 机会

做一个 **常驻置顶的轻量 Todo 面板**：本地建 todo，一键绑定并拉起 AI 会话；面板内也可用对话建 todo。飞书日历拉取（授权后点选建 todo）作为 **P1**。首版 AI 只接 **pi**，架构预留多工具 Adapter。

---

## 2. 目标与非目标

### 2.1 目标（首版）

| ID | 目标 | 度量（定性） |
|----|------|----------------|
| G1 | Todo → 打开/跳回 pi 会话，明显短于手工复制（飞书来源为 P1） | 主路径点击次数少、文案自动进剪贴板 |
| G2 | Todo 与 pi session 可绑定，事后可跳回 | 每条 todo 可存 `piSessionId` + `cwd` |
| G3 | 置顶悬浮、默认轻量 | 默认展示 5 条，可展开 |
| G4 | 面板内对话可建 todo | pi-durable Agent + tools |
| G5 | 不违背 pi 定义 | 使用官方/社区 pi 包与 CLI 约定，不自造并行协议 |
| G6（P1） | 飞书日程 → Todo → AI，减少复制成本 | 授权后按日点选生成 todo |

### 2.2 非目标（首版不做）

- **飞书日历全部功能（OAuth / 拉日程 / 点选建 todo / 写回）→ 移至 P1**
- 飞书「当前选中日程」系统级钩子（飞书无此 API）→ 改为授权后列表点选（P1）
- 向 pi 输入框预填且不发送（CLI 无能力）→ **剪贴板投递**
- 完成 todo 时默认写回飞书 → **有日期时询问，不默认**（P1）
- 内嵌模型 Gateway / 改写各 Agent 全局配置
- 首版接入除 pi 以外的 AI 工具（架构预留）
- 自研业务 CLI（`apps/cli`）；`install.sh` 仅作安装通道

---

## 3. 用户与场景

### 3.1 用户

日常排期并到 AI 工具干活的个人开发者 / 知识工作者（飞书日历用户为 P1 重点）。

### 3.2 核心场景

| 场景 | 流程摘要 |
|------|----------|
| S1 从日历开工（**P1**） | 授权飞书 → 选今日/某日日程 → 点选生成 todo → 立刻选 AI（pi）→ 选目录 → 打开会话，文案已在剪贴板 |
| S2 跳回旧会话 | 打开已绑定 todo → resume `pi --session` |
| S3 手动建 todo（首版） | 快捷键/面板新建 → 标题必填、内容选填 → 可选再绑 AI |
| S4 对话建 todo | 面板 Chat → Agent 调 `create_todo` → 列表刷新 |
| S5 完成 | 勾选完成 → 仅改本地状态；若有飞书关联且用户确认，才考虑写回（**P1**） |

---

## 4. 产品范围

### 4.1 功能清单

#### F1 悬浮 Todo 面板

- Electron 无边框置顶窗；位置记忆
- 默认展示 **5** 条 open todo，可展开/滚动看更多
- 全局快捷键：显隐面板、新建 todo
- 条目：标题、可选摘要、完成态、是否已绑 AI

#### F2 Todo 模型与编辑

| 字段 | 规则 |
|------|------|
| 标题 | **必填** |
| 内容/描述 | **选填** |
| 状态 | `open` / `done`；完成只改状态 |
| 飞书来源（**P1**） | 可选：`feishuEventId`、起止时间 |
| AI 绑定 | 可选：`toolId`（首版固定 `pi`）、`sessionId`、`cwd` |

#### F3 飞书日历（**P1**，首版不做）

- 用户配置自建应用，完成 OAuth
- 拉取 **今天 / 指定日** 日程：标题、时间、描述
- **点选**一条 → 预填 Todo（标题/时间/描述）→ 保存后 **立刻进入 AI 选择**
- **写回**：仅当 todo 带日期/关联且用户明确同意；不默认写回
- Content 类字段产品侧保持选填；涉及日期同步必须询问用户

#### F4 AI 拉起（首版 pi）

- AiPicker：选择工具（首版仅 pi）、**工作目录必选**、新建或已有 session
- 将任务文案写入 **系统剪贴板**，并提示用户到 pi 粘贴
- `spawn` 本机 `pi`，支持 `--session` 跳回
- CLI session 元数据与面板 Agent session **分 ID 存储**，禁止混用

#### F5 面板对话（pi-durable）

- 嵌入 `@earendil-works/pi-durable` + 完整 `pi-ai`
- 用户自填 API Key（不经我们服务器）
- Agent 可调用产品 tools：如 `create_todo`、`list_todos`（范围可迭代）
- 遵循 pi 的 provider / session / 消息与工具定义，产品只包一层

#### F6 多 AI 工具（后续）

- `packages/ai/<tool>` 每工具一个 Adapter
- Registry 发现本机安装；统一 `launch` / `resume` / `deliverPrompt`
- 首版只实现 `ai/pi`；Claude Code / Codex / OpenCode 等陆续加

#### F7 安装与分发

- 开发：本地 `pnpm dev`
- 发布：`scripts/install.sh` + `.app`（CLI 安装通道，不是业务 CLI）

---

## 5. 信息架构与界面

```
悬浮面板
├── 列表（默认 5）
│   ├── 条目 → 展开详情 / 完成 / 打开 AI
│   └── 空态 → 新建（P1：从飞书导入）
├── 新建/编辑
├── 飞书日程选择（P1）
├── AI 选择（工具 / cwd / session）
└── 面板 Chat（可折叠区域或独立视图）
```

交互要点：

- 从飞书点选后 **强制进入** AI 选择（可取消，但默认推进）— **P1**
- 完成操作不弹飞书写回，除非存在关联日期且走「同步？」确认 — **P1**
- 剪贴板投递后短提示：「已复制，到 pi 粘贴」

---

## 6. 业务规则

1. 标题为空不可保存。
2. 打开 pi 前必须有有效 `cwd`（目录存在且可选）。
3. 面板 Chat 的 session id 与 CLI `pi --session` id **命名空间隔离**。
4. 飞书 token（P1）、LLM Key 仅存 Main 可信区（safeStorage / keychain）。
5. 不默认写回飞书；询问文案需明确「会改飞书侧数据」（P1）。
6. Adapter 不得违背对应工具的官方 CLI/配置语义；pi 路径尤甚。

---

## 7. 数据模型（产品级）

```ts
Todo {
  id, title, body?, status: open|done,
  createdAt, updatedAt,
  // P1：feishuEventId?, feishuStart?, feishuEnd?,
  ai?: { toolId: 'pi' | string, sessionId, cwd }
}

PanelAgentSession { /* pi-durable 托管，与 Todo.ai.sessionId 分离 */ }

CliSessionMeta {
  toolId, sessionId, cwd, todoId?, lastOpenedAt
}
```

---

## 8. 成功标准（首版验收）

| # | 验收项 |
|---|--------|
| 1 | 置顶面板可显隐；列表默认 5 条可展开 |
| 2 | 手动新建：标题必填、内容选填、完成只改状态 |
| 3 | Todo 进入 AiPicker；cwd 必选；剪贴板有文案；pi 被拉起 |
| 4 | 已绑定 todo 可 `--session` 跳回 |
| 5 | 面板 Chat 可对话并 `create_todo` |
| 6 | 代码结构：`packages/ai/pi` 为实现，`ai/core` 为注册，无 Magpie Gateway |
| P1-1 | 飞书 OAuth 后可拉某日日程并点选生成 todo |
| P1-2 | 完成不自动写飞书；有关联时询问才同步 |

---

## 9. 里程碑建议

| 阶段 | 交付 |
|------|------|
| M0 | 仓库脚手架 + 置顶空壳 + Todo CRUD |
| M1 | PiAdapter：剪贴板 + spawn + session 绑定 |
| M2 | pi-durable 面板 Chat + create_todo |
| M3 | 快捷键、位置记忆、打磨、install.sh 草案 |
| M4 | 飞书日历（OAuth + 日程点选建 todo，**P1**） |
| M5+ | 第 2、第 3 个 `packages/ai/<tool>` |

---

## 10. 开放问题（不阻塞首版）

- （P1）写回飞书的最小动作：备注 / 完成状态 / 仅本地标记？
- Windows/Linux 安装路径与签名策略
- 面板 Chat 与 CLI 会话是否提供「一键复制上下文」以外的同步（默认不做自动双向同步）

---

## 11. 文档与仓库对照

- 架构细节：`TECH-ARCH-tick.md`（同目录）
- 目录：`apps/desktop`（`src/main` · `src/preload` · `src/renderer/features`）+ `packages/shared` + `packages/ai/{core,pi,…}`
