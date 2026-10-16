/**
 * Panel ChatAgentHost — pi-durable + pi-ai, isolated from CLI pi sessions.
 * Storage: JSONL under Tick userData (Node 20 has no node:sqlite).
 */
import "./node-compat.js";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import type { Context } from "@earendil-works/chord/context";
import { Type } from "@earendil-works/pi-ai";
import type { CredentialStore, MutableModels } from "@earendil-works/pi-ai";
import {
  builtinModels,
  getBuiltinProviders,
} from "@earendil-works/pi-ai/providers/all";
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux";
import {
  createRegistry,
  defineExtension,
  defineTool,
  Harness,
  section,
  type Conversation,
  type ConversationId,
  type Harness as HarnessType,
} from "@earendil-works/pi-durable";
import { openNodeJsonlStorage } from "@earendil-works/pi-durable/storage/jsonl/node";
import { NodeExecutionEnv } from "@earendil-works/pi-durable/env/node";
import type { PanelSessionKey } from "@tick/ai-core";
import type {
  ModelStatus,
  ModelTestResult,
  PanelChatSession,
} from "@tick/shared";
import type { ModelConfigStore } from "./model-config-store";

export type ChatHistoryItem = {
  who: "you" | "agent" | "system";
  text: string;
  entryId?: string;
};

export type ChatSendResult = {
  ok: boolean;
  sessionId: string;
  conversationId: string;
  status: "done" | "unanswered" | "aborted" | "error";
  message: string;
  history: ChatHistoryItem[];
};

export type ChatAgentHostOptions = {
  /** Directory for durable JSONL + panel session map (under userData) */
  storageDir: string;
  createTodo: (input: {
    title: string;
    content?: string;
  }) => Promise<{ id: string; title: string }>;
  listTodos: (input?: {
    status?: "open" | "done";
  }) => Promise<Array<{ id: string; title: string; status: string }>>;
  /** Shared credential store (pi's auth.json) — one credential per provider. */
  credentials: CredentialStore;
  /** Tick-side persistence of the selected panel-chat model. */
  modelConfig: ModelConfigStore;
};

type PanelMapEntry = {
  conversationId: string;
  title?: string;
  updatedAt?: string;
};
/** panelSessionId → durable conversation + display metadata. */
type PanelMap = Record<string, PanelMapEntry>;

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as { type?: string; text?: string };
    if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
  }
  return parts.join("");
}

export class ChatAgentHost {
  private harness: HarnessType | undefined;
  private models: MutableModels | undefined;
  private faux:
    | ReturnType<typeof fauxProvider>
    | undefined;
  private modelRef: { provider: string; modelId: string } = {
    provider: "faux",
    modelId: "faux-1",
  };
  private panelMap: PanelMap = {};
  private started = false;

  constructor(private readonly options: ChatAgentHostOptions) {}

  async start(): Promise<void> {
    if (this.started) return;
    await mkdir(this.options.storageDir, { recursive: true });
    await this.loadPanelMap();

    const registry = createRegistry();
    const createTodo = this.options.createTodo;
    const listTodos = this.options.listTodos;

    const create_todo = defineTool({
      name: "create_todo",
      description: "Create a Tick todo (title required, content optional)",
      parameters: Type.Object({
        title: Type.String({ minLength: 1 }),
        content: Type.Optional(Type.String()),
      }),
      execute: async (args) => {
        const todo = await createTodo({
          title: args.title,
          content: args.content,
        });
        return {
          output: [
            {
              type: "text" as const,
              text: `created todo ${todo.id}: ${todo.title}`,
            },
          ],
        };
      },
    });

    const list_todos = defineTool({
      name: "list_todos",
      description: "List Tick todos; optional status open|done",
      parameters: Type.Object({
        status: Type.Optional(
          Type.Union([Type.Literal("open"), Type.Literal("done")]),
        ),
      }),
      execute: async (args) => {
        const items = await listTodos(
          args.status ? { status: args.status } : undefined,
        );
        return {
          output: [
            {
              type: "text" as const,
              text: JSON.stringify(items, null, 2),
            },
          ],
        };
      },
    });

    registry.install(
      defineExtension({
        name: "tick-todos",
        tools: [create_todo, list_todos],
        sections: [
          section(
            "preamble",
            () =>
              "You are Tick panel chat. Use create_todo / list_todos for the user's todos. Keep answers short.",
            { tag: false },
          ),
        ],
      }),
    );

    const models = builtinModels({ credentials: this.options.credentials });
    this.models = models;
    await this.refreshModelRef();

    const context = BACKGROUND_CONTEXT;
    const storage = await openNodeJsonlStorage(
      path.join(this.options.storageDir, "durable"),
      context,
    );
    const cwd = this.options.storageDir;
    this.harness = await Harness.open(
      storage,
      {
        models,
        registry,
        env: () => new NodeExecutionEnv({ cwd }),
      },
      context,
    );
    this.harness.resume();
    this.started = true;
  }

  async stop(): Promise<void> {
    // Harness has no explicit close in public types for all versions; drop refs.
    this.harness = undefined;
    this.started = false;
  }

  /** Resolve the effective model: saved selection → first available → faux. */
  private async refreshModelRef(): Promise<void> {
    const models = this.models;
    if (!models) return;
    const saved = this.options.modelConfig.get();
    if (saved) {
      const model = models.getModel(saved.provider, saved.modelId);
      if (model && (await models.getAuth(saved.provider))) {
        this.modelRef = { ...saved };
        return;
      }
    }
    const available = await models.getAvailable();
    const first = available[0];
    if (first) {
      this.modelRef = { provider: first.provider, modelId: first.id };
      return;
    }
    if (!this.faux) {
      this.faux = fauxProvider();
      models.setProvider(this.faux.provider);
    }
    this.modelRef = { provider: "faux", modelId: "faux-1" };
  }

  /** Model config view for the panel (providers + models + current choice). */
  async getModelStatus(): Promise<ModelStatus> {
    await this.start();
    const models = this.models!;
    const credentials = await this.options.credentials.list();
    const configured = new Set(credentials.map((c) => c.providerId));
    // 与 refreshModelRef 的回退判断同源：getAvailable() 会把环境变量提供的
    // ambient auth 也算进来，这类 provider configured 为 false 但其实可用。
    const available = new Set(
      (await models.getAvailable()).map((m) => m.provider),
    );
    const providers = getBuiltinProviders().map((providerId) => ({
      providerId,
      configured: configured.has(providerId),
      available: available.has(providerId),
      // 全量返回目录：openrouter / vercel-ai-gateway 这类有 200~400 个模型，
      // 截断会让用户选不到后面的模型（UI 侧用搜索 + 滚动承载）。
      models: models.getModels(providerId).map((m) => m.id),
    }));
    // Configured providers first (stable otherwise).
    providers.sort((a, b) => Number(b.configured) - Number(a.configured));
    return {
      selected:
        this.modelRef.provider === "faux"
          ? null
          : {
              provider: this.modelRef.provider,
              modelId: this.modelRef.modelId,
            },
      isFaux: this.modelRef.provider === "faux",
      providers,
    };
  }

  /** Persist the panel-chat model choice and apply it immediately. */
  async setSelectedModel(provider: string, modelId: string): Promise<void> {
    await this.start();
    const models = this.models!;
    if (!models.getModel(provider, modelId)) {
      throw new Error(`model not found: ${provider}/${modelId}`);
    }
    this.modelRef = { provider, modelId };
    this.options.modelConfig.set({ provider, modelId });
  }

  /** Store an API key into the shared pi auth.json (via CredentialStore). */
  async saveApiKey(providerId: string, apiKey: string): Promise<void> {
    await this.start();
    const key = apiKey.trim();
    if (!key) throw new Error("API key 不能为空");
    await this.options.credentials.modify(providerId, async () => ({
      type: "api_key" as const,
      key,
    }));
    // A stored credential now owns this provider — if we were on faux, adopt
    // the first newly available model so chat upgrades without extra steps.
    if (this.modelRef.provider === "faux") {
      await this.refreshModelRef();
    }
  }

  /** Remove the stored credential for a provider (logout). */
  async clearApiKey(providerId: string): Promise<void> {
    await this.start();
    await this.options.credentials.delete(providerId);
    // 清掉的正好是当前生效的 provider：换到下一个可用模型，或回落 faux。
    if (this.modelRef.provider === providerId) {
      await this.refreshModelRef();
    }
  }

  /** One-shot connectivity probe (optionally with an unsaved key). */
  async testProvider(input: {
    providerId: string;
    apiKey?: string;
    modelId?: string;
  }): Promise<ModelTestResult> {
    await this.start();
    const models = this.models!;
    const model =
      (input.modelId
        ? models.getModel(input.providerId, input.modelId)
        : undefined) ?? models.getModels(input.providerId)[0];
    if (!model) {
      return {
        ok: false,
        message: `${input.providerId} 没有静态模型目录（动态目录），Tick 里暂时选不了模型`,
      };
    }
    const startedAt = Date.now();
    const apiKey = input.apiKey?.trim();
    try {
      const response = await models.completeSimple(
        model,
        {
          messages: [{ role: "user", content: "ping", timestamp: Date.now() }],
        },
        apiKey ? { apiKey, maxTokens: 8 } : { maxTokens: 8 },
      );
      const latencyMs = Date.now() - startedAt;
      const text = messageText(
        (response as { content?: unknown }).content,
      ).slice(0, 60);
      return {
        ok: true,
        message: `连接成功（${model.id}${text ? ` · ${text}` : ""}）`,
        latencyMs,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, message: message.slice(0, 300) };
    }
  }

  /** Ensure a durable conversation for this panel session key (never a CLI id). */
  async ensureConversation(panelSessionId: PanelSessionKey): Promise<Conversation> {
    await this.start();

    const harness = this.harness!;
    const ctx = BACKGROUND_CONTEXT;
    const entry = this.panelMap[panelSessionId];
    const mapped = entry?.conversationId;
    if (mapped !== undefined && mapped !== "") {
      const existingId = Number(mapped) as ConversationId;
      const found = await harness.conversation(existingId, ctx);
      if (found) {
        // Provider/key may change across app restarts (e.g. faux → deepseek).
        // Re-configure so mapped conversations don't stay stuck on an unavailable model.
        await found.configure(
          {
            model: this.modelRef,
            instructions:
              "Prefer create_todo when the user asks to add a task. Reply briefly in Chinese when the user writes Chinese.",
          },
          ctx,
        );
        return found;
      }
    }

    const created = await harness.createConversation(
      {
        ownership: { kind: "ownerless" },
        agent: {
          model: this.modelRef,
          extensions: undefined,
        },
      },
      ctx,
    );
    // Select tick-todos extension by configuring agent with model only;
    // registry has the extension installed — default selection includes installed.
    await created.configure(
      {
        model: this.modelRef,
        instructions:
          "Prefer create_todo when the user asks to add a task. Reply briefly in Chinese when the user writes Chinese.",
      },
      ctx,
    );
    this.panelMap[panelSessionId] = {
      conversationId: String(created.id),
      updatedAt: new Date().toISOString(),
    };
    await this.savePanelMap();
    return created;
  }

  async history(panelSessionId: PanelSessionKey): Promise<ChatHistoryItem[]> {
    const conversation = await this.ensureConversation(panelSessionId);
    return this.readHistory(conversation, BACKGROUND_CONTEXT);
  }

  async send(
    panelSessionId: PanelSessionKey,
    text: string,
  ): Promise<ChatSendResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error("empty chat message");
    }
    const conversation = await this.ensureConversation(panelSessionId);
    const ctx = BACKGROUND_CONTEXT;

    this.prepareFauxResponses(trimmed);

    const submission = await conversation.submit(
      { type: "input", content: trimmed, whenBusy: "followUp" },
      ctx,
    );
    const settled = await submission.wait(ctx);
    await this.touchPanelSession(panelSessionId, trimmed);
    const history = await this.readHistory(conversation, ctx);
    const lastAgent =
      [...history].reverse().find((h) => h.who === "agent")?.text ?? "";

    const status: ChatSendResult["status"] =
      settled.status === "done" || settled.status === "unanswered"
        ? settled.status
        : "error";

    return {
      ok: status === "done" || status === "unanswered",
      sessionId: panelSessionId,
      conversationId: String(conversation.id),
      status,
      message: lastAgent || `submission ${status}`,
      history,
    };
  }

  private prepareFauxResponses(userText: string): void {
    if (!this.faux) return;
    const createMatch = userText.match(
      /(?:建|创建|添加|add)\s*(?:一条|一个|todo|任务)?[「"']?([^」"'\n]+)[」"']?/i,
    );
    if (createMatch?.[1]) {
      const title = createMatch[1].trim();
      this.faux.setResponses([
        fauxAssistantMessage(
          fauxToolCall("create_todo", { title }),
          { stopReason: "toolUse" },
        ),
        fauxAssistantMessage(`已创建 todo：${title}`),
      ]);
      return;
    }
    if (/list|列出|有哪些.*todo/i.test(userText)) {
      this.faux.setResponses([
        fauxAssistantMessage(fauxToolCall("list_todos", {}), {
          stopReason: "toolUse",
        }),
        fauxAssistantMessage("已列出 todos。"),
      ]);
      return;
    }
    this.faux.setResponses([
      fauxAssistantMessage(
        `（panel chat · faux）收到：${userText.slice(0, 200)}`,
      ),
    ]);
  }

  /** Panel chat sessions (newest first) for the chat view list. */
  async listPanelSessions(): Promise<PanelChatSession[]> {
    await this.start();
    return Object.entries(this.panelMap)
      .map(([sessionId, entry]) => ({
        sessionId,
        title: entry.title ?? "新会话",
        updatedAt: entry.updatedAt,
      }))
      .sort((a, b) =>
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
      );
  }

  /** Update display metadata after a successful send (auto-title from 1st message). */
  private async touchPanelSession(
    panelSessionId: string,
    firstText: string,
  ): Promise<void> {
    const entry = this.panelMap[panelSessionId];
    if (!entry) return;
    if (!entry.title) {
      const t = firstText.trim().replace(/\s+/g, " ").slice(0, 16);
      if (t) entry.title = t;
    }
    entry.updatedAt = new Date().toISOString();
    await this.savePanelMap();
  }

  private async readHistory(
    conversation: Conversation,
    ctx: Context,
  ): Promise<ChatHistoryItem[]> {
    const page = await conversation.entries(
      { order: "ascending" },
      200,
      undefined,
      ctx,
    );
    const out: ChatHistoryItem[] = [];
    for (const entry of page.items) {
      const models = entry.model ?? [];
      for (const msg of models) {
        const role = (msg as { role?: string }).role;
        const text = messageText((msg as { content?: unknown }).content);
        if (!text) continue;
        if (role === "user") out.push({ who: "you", text, entryId: String(entry.id) });
        else if (role === "assistant")
          out.push({ who: "agent", text, entryId: String(entry.id) });
        else out.push({ who: "system", text, entryId: String(entry.id) });
      }
      if (!models.length && entry.kind === "pi.user") {
        // fallback display
      }
    }
    return out;
  }

  private mapPath(): string {
    return path.join(this.options.storageDir, "panel-sessions.json");
  }

  private async loadPanelMap(): Promise<void> {
    try {
      const raw = await readFile(this.mapPath(), "utf8");
      const parsed = JSON.parse(raw) as Record<
        string,
        string | PanelMapEntry
      >;
      const map: PanelMap = {};
      for (const [sessionId, entry] of Object.entries(parsed)) {
        // Legacy shape stored a bare conversationId string.
        map[sessionId] =
          typeof entry === "string" ? { conversationId: entry } : entry;
      }
      this.panelMap = map;
    } catch {
      this.panelMap = {};
    }
  }

  private async savePanelMap(): Promise<void> {
    await writeFile(this.mapPath(), JSON.stringify(this.panelMap, null, 2), "utf8");
  }
}
