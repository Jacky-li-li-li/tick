import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AiLaunchInput,
  AiResumeInput,
  CreateTodoInput,
  Session,
  SetTodoStatusInput,
  UpdateTodoInput,
} from "@tick/shared";
import { TodoStore } from "./todo-store";
import { SessionStore } from "./session-store";
import { ChatAgentHost } from "./services/chat-agent-host";
import {
  createAiHost,
  isPidAlive,
  launchViaHost,
  listToolsForIpc,
  probeSessionAlive,
  resumeViaHost,
} from "./services/ai-host";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let store: TodoStore;
let sessions: SessionStore;
let chatHost: ChatAgentHost;
const aiHost = createAiHost();

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 360,
    height: 520,
    minWidth: 320,
    minHeight: 400,
    alwaysOnTop: true,
    frame: false,
    titleBarStyle: "hidden",
    resizable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpc() {
  // —— window ——
  ipcMain.handle("window:getAlwaysOnTop", () => mainWindow?.isAlwaysOnTop() ?? true);
  ipcMain.handle("window:setAlwaysOnTop", (_e, flag: boolean) => {
    mainWindow?.setAlwaysOnTop(!!flag);
    return mainWindow?.isAlwaysOnTop() ?? false;
  });
  ipcMain.handle("window:show", () => {
    mainWindow?.show();
    return true;
  });
  ipcMain.handle("window:hide", () => {
    mainWindow?.hide();
    return true;
  });

  // —— todo ——
  ipcMain.handle("todo:list", () => store.list());
  ipcMain.handle("todo:get", (_e, id: string) => store.get(id) ?? null);
  ipcMain.handle("todo:create", (_e, input: CreateTodoInput) => store.create(input));
  ipcMain.handle("todo:update", (_e, input: UpdateTodoInput) => store.update(input));
  ipcMain.handle("todo:setStatus", (_e, input: SetTodoStatusInput) =>
    store.setStatus(input),
  );
  ipcMain.handle("todo:delete", (_e, id: string) => store.delete(id));

  // —— session (CLI / tool sessions; not chat) ——
  ipcMain.handle("session:list", () => sessions.list());
  ipcMain.handle("session:get", (_e, id: string) => sessions.get(id) ?? null);
  ipcMain.handle(
    "session:bind",
    (_e, input: { sessionId: string; todoId: string }) => {
      const session = sessions.get(input.sessionId);
      if (!session) throw new Error(`session not found: ${input.sessionId}`);
      const next = { ...session, todoId: input.todoId };
      sessions.set(next);
      if (session.toolId && session.cwd) {
        store.bindAi(input.todoId, {
          toolId: session.toolId,
          sessionId: session.id,
          cwd: session.cwd,
        });
      }
      return next;
    },
  );
  ipcMain.handle("session:isAlive", (_e, sessionId: string) => {
    const existing = sessions.get(sessionId);
    return probeSessionAlive(aiHost, sessionId, existing?.pid);
  });

  // —— ai —— (packages/ai/core + ai/pi; CLI session ids from pi, not invented)
  ipcMain.handle("ai:listTools", () => listToolsForIpc(aiHost));
  ipcMain.handle("ai:launch", async (_e, input: AiLaunchInput) => {
    const todo = input.todoId ? store.get(input.todoId) : undefined;
    if (input.todoId && !todo) {
      throw new Error(`todo not found: ${input.todoId}`);
    }
    const result = await launchViaHost(aiHost, {
      ...input,
      title: todo?.title,
      body: todo?.content,
      // empty UI prompt should not override todo title/content
      prompt: input.prompt?.trim() ? input.prompt : undefined,
    });
    const session: Session = {
      id: result.sessionId,
      todoId: input.todoId,
      cwd: result.cwd,
      toolId: result.toolId,
      createdAt: new Date().toISOString(),
      pid: result.pid,
    };
    sessions.set(session);
    if (input.todoId) {
      store.bindAi(input.todoId, {
        toolId: result.toolId,
        sessionId: result.sessionId,
        cwd: result.cwd,
      });
    }
    return {
      ok: true,
      sessionId: result.sessionId,
      spawned: true,
      clipboard: result.clipboard === true,
      pid: result.pid,
      alive: isPidAlive(result.pid),
      message: "launched via PiAdapter; session id captured from pi store",
    };
  });
  ipcMain.handle("ai:resume", async (_e, input: AiResumeInput) => {
    const existing = sessions.get(input.sessionId);
    const todoId = existing?.todoId;
    const result = await resumeViaHost(aiHost, {
      toolId: input.toolId,
      sessionId: input.sessionId,
      cwd: input.cwd,
      todoId,
    });
    const session: Session = {
      id: result.sessionId,
      todoId,
      cwd: result.cwd,
      toolId: result.toolId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      pid: result.pid ?? existing?.pid,
    };
    sessions.set(session);
    return {
      ok: true,
      sessionId: result.sessionId,
      resumed: true,
      pid: session.pid,
      alive: isPidAlive(session.pid),
      message: "resumed via PiAdapter (existing id + cwd)",
    };
  });

  // —— chat (ChatAgentHost / pi-durable; isolated from CLI sessions) ——
  ipcMain.handle(
    "chat:history",
    async (_e, input: string | { sessionId: string }) => {
      const sessionId =
        typeof input === "string" ? input : input?.sessionId;
      if (!sessionId) throw new Error("chat sessionId is required");
      if (sessions.get(sessionId)) {
        throw new Error("CLI session id cannot be used for chat:history");
      }
      const history = await chatHost.history(sessionId);
      return {
        ok: true,
        sessionId,
        history,
        // compat with earlier PanelChatStore shape
        messages: history.map((h, i) => ({
          id: h.entryId ?? `m-${i}`,
          role:
            h.who === "you" ? "user" : h.who === "agent" ? "assistant" : "system",
          text: h.text,
          createdAt: new Date().toISOString(),
        })),
      };
    },
  );
  ipcMain.handle(
    "chat:send",
    async (_e, input: { sessionId: string; text: string }) => {
      if (sessions.get(input.sessionId)) {
        throw new Error("CLI session id cannot be used for chat:send");
      }
      const result = await chatHost.send(input.sessionId, input.text);
      const lastYou = [...result.history].reverse().find((h) => h.who === "you");
      const lastAgent = [...result.history]
        .reverse()
        .find((h) => h.who === "agent");
      return {
        ok: result.ok,
        sessionId: result.sessionId,
        conversationId: result.conversationId,
        status: result.status,
        message: result.message,
        history: result.history,
        user: lastYou
          ? {
              id: lastYou.entryId ?? "user",
              role: "user" as const,
              text: lastYou.text,
              createdAt: new Date().toISOString(),
            }
          : undefined,
        assistant: lastAgent
          ? {
              id: lastAgent.entryId ?? "assistant",
              role: "assistant" as const,
              text: lastAgent.text,
              createdAt: new Date().toISOString(),
            }
          : {
              id: "assistant",
              role: "assistant" as const,
              text: result.message,
              createdAt: new Date().toISOString(),
            },
      };
    },
  );

  // —— clipboard observability (QA E3) ——
  ipcMain.handle("clipboard:lastDelivered", () => aiHost.peekLastClipboard());
}


app.whenReady().then(() => {
  const dataDir = app.getPath("userData");
  store = new TodoStore(path.join(dataDir, "todos.json"));
  sessions = new SessionStore(path.join(dataDir, "cli-sessions.json"));
  chatHost = new ChatAgentHost({
    storageDir: path.join(dataDir, "panel-chat"),
    createTodo: async (input) => {
      const todo = store.create({
        title: input.title,
        content: input.content,
      });
      return { id: todo.id, title: todo.title };
    },
    listTodos: async (input) =>
      store
        .list()
        .filter((todo) => (input?.status ? todo.status === input.status : true))
        .map((todo) => ({
          id: todo.id,
          title: todo.title,
          status: todo.status,
        })),
  });
  void chatHost.start().catch((err) => {
    console.error("ChatAgentHost start failed", err);
  });
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
