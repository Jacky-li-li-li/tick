/**
 * Panel ChatAgentHost — pi-durable + pi-ai, isolated from CLI pi sessions.
 * Storage: JSONL under Tick userData (Node 20 has no node:sqlite).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import type { Context } from "@earendil-works/chord/context";
import { Type } from "@earendil-works/pi-ai";
import { createModels } from "@earendil-works/pi-ai/models";
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
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
import {
  assertPanelConversationId,
  rejectCrossNamespaceSessionId,
} from "@tick/ai-core";

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
};

type PanelMap = Record<string, string>; // panelSessionId → durable ConversationId

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

    const models = createModels();
    if (process.env.OPENAI_API_KEY) {
      models.setProvider(openaiProvider());
      this.modelRef = { provider: "openai", modelId: "gpt-4o-mini" };
    } else if (process.env.ANTHROPIC_API_KEY) {
      models.setProvider(anthropicProvider());
      this.modelRef = {
        provider: "anthropic",
        modelId: "claude-haiku-4-5-20251001",
      };
    } else {
      this.faux = fauxProvider();
      models.setProvider(this.faux.provider);
      this.modelRef = { provider: "faux", modelId: "faux-1" };
    }

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

  /** Ensure a durable conversation for this panel session id (never a CLI id). */
  async ensureConversation(panelSessionId: string): Promise<Conversation> {
    await this.start();
    rejectCrossNamespaceSessionId("panel", panelSessionId);
    assertPanelConversationId(panelSessionId);
    if (panelSessionId.startsWith("cli:")) {
      throw new Error("CLI session id cannot be used for panel chat");
    }

    const harness = this.harness!;
    const ctx = BACKGROUND_CONTEXT;
    const mapped = this.panelMap[panelSessionId];
    if (mapped !== undefined && mapped !== "") {
      const existingId = Number(mapped) as ConversationId;
      const found = await harness.conversation(existingId, ctx);
      if (found) return found;
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
    this.panelMap[panelSessionId] = String(created.id);
    await this.savePanelMap();
    return created;
  }

  async history(panelSessionId: string): Promise<ChatHistoryItem[]> {
    const conversation = await this.ensureConversation(panelSessionId);
    return this.readHistory(conversation, BACKGROUND_CONTEXT);
  }

  async send(
    panelSessionId: string,
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
      this.panelMap = JSON.parse(raw) as PanelMap;
    } catch {
      this.panelMap = {};
    }
  }

  private async savePanelMap(): Promise<void> {
    await writeFile(this.mapPath(), JSON.stringify(this.panelMap, null, 2), "utf8");
  }
}
