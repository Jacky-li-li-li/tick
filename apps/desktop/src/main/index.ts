import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  type OpenDialogOptions,
} from "electron";
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
import { parseCliSessionId, parsePanelSessionKey } from "@tick/ai-core";
import { TodoStore } from "./todo-store";
import { SessionStore } from "./session-store";
import { resolveResumeTarget } from "./services/resume-target";
import { ChatAgentHost } from "./services/chat-agent-host";
import { PiAuthFileCredentialStore } from "./services/pi-auth-store";
import { ModelConfigStore } from "./services/model-config-store";
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
let tray: Tray | null = null;

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
}

function hideMainWindow() {
  mainWindow?.hide();
}

function toggleMainWindow() {
  if (
    mainWindow &&
    !mainWindow.isDestroyed() &&
    mainWindow.isVisible() &&
    mainWindow.isFocused()
  ) {
    hideMainWindow();
    return;
  }
  showMainWindow();
}

function refreshTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "显示 Tick",
        click: () => showMainWindow(),
      },
      {
        label: "隐藏面板",
        click: () => hideMainWindow(),
      },
      { type: "separator" },
      {
        label: "置顶",
        type: "checkbox",
        checked: mainWindow?.isAlwaysOnTop() ?? true,
        click: (item) => {
          mainWindow?.setAlwaysOnTop(item.checked);
          refreshTrayMenu();
        },
      },
      { type: "separator" },
      {
        label: "退出",
        click: () => app.quit(),
      },
    ]),
  );
}

function createTray() {
  if (tray) return;
  const iconPath = path.join(__dirname, "../resources/tray-icon.png");
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    // Fallback 16x16 indigo pixel so Linux trays still get a real image
    icon = nativeImage.createFromDataURL(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR42mPwd3v6nxLMMGrAqAGjBgwXAwC/zHkfeRAWwgAAAABJRU5ErkJggg==",
    );
  }
  if (process.platform === "darwin") {
    icon = icon.resize({ width: 16, height: 16 });
  }
  tray = new Tray(icon);
  tray.setToolTip("Tick");
  refreshTrayMenu();
  tray.on("click", () => showMainWindow());
  tray.on("double-click", () => showMainWindow());
}

function registerGlobalShortcuts() {
  const chord = "CommandOrControl+Shift+Space";
  const ok = globalShortcut.register(chord, () => {
    toggleMainWindow();
  });
  if (!ok) {
    console.warn(`Failed to register global shortcut: ${chord}`);
  }
}


function createWindow() {
  // 磨砂半透明玻璃面板（docs/ui/UI-LOCK.md）：macOS 用窗口级 vibrancy 把桌面做磨砂，
  // renderer 只叠一层半透明玻璃色，不再自绘模糊。
  const isMac = process.platform === "darwin";
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
    transparent: isMac,
    backgroundColor: isMac ? "#00000000" : "#12141a",
    ...(isMac ? { vibrancy: "under-window" as const, visualEffectState: "active" as const } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    console.log("[tick] window ready-to-show → show");
    mainWindow?.show();
  });

  // Diagnostics: surface renderer load/runtime failures in the dev console.
  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error("[tick] renderer did-fail-load:", code, desc, url);
  });
  mainWindow.webContents.on("render-process-gone", (_e, details) => {
    console.error("[tick] renderer process gone:", JSON.stringify(details));
  });
  mainWindow.webContents.on(
    "console-message",
    (_e, level, message, line, sourceId) => {
      if (level >= 2) {
        console.error(`[tick] renderer console (${level}) ${sourceId}:${line}:`, message);
      }
    },
  );

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
    refreshTrayMenu();
    return mainWindow?.isAlwaysOnTop() ?? false;
  });
  ipcMain.handle("window:show", () => {
    showMainWindow();
    return true;
  });
  ipcMain.handle("window:hide", () => {
    hideMainWindow();
    return true;
  });

  // —— dialog ——
  ipcMain.handle(
    "dialog:pickDirectory",
    async (_e, input?: { defaultPath?: string }) => {
      const options: OpenDialogOptions = {
        title: "选择工作目录",
        properties: ["openDirectory", "createDirectory"],
        defaultPath: input?.defaultPath?.trim() || undefined,
      };
      const parent =
        mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
      const result = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options);
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    },
  );

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
  ipcMain.handle("session:get", (_e, rawId: string) => {
    const id = parseCliSessionId(rawId);
    return sessions.get(id) ?? null;
  });
  ipcMain.handle(
    "session:bind",
    (_e, input: { sessionId: string; todoId: string }) => {
      const sessionId = parseCliSessionId(input.sessionId);
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`session not found: ${sessionId}`);
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
  ipcMain.handle("session:isAlive", (_e, rawId: string) => {
    const sessionId = parseCliSessionId(rawId);
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
    // launchViaHost rejects when the spawn fails, so a missing pid here would
    // be an adapter contract violation. Do not report it as a success.
    const spawned = result.pid != null;
    if (!spawned) throw new Error("pi did not report a pid for the new session");
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
      ok: spawned,
      sessionId: result.sessionId,
      spawned,
      clipboard: result.clipboard === true,
      pid: result.pid,
      alive: isPidAlive(result.pid),
      message: "launched via PiAdapter (pi --session-id)",
    };
  });
  ipcMain.handle("ai:resume", async (_e, input: AiResumeInput) => {
    const target = resolveResumeTarget((id) => sessions.get(id), input);
    const result = await resumeViaHost(aiHost, {
      toolId: target.toolId,
      sessionId: target.sessionId,
      cwd: target.cwd,
      todoId: target.todoId,
    });
    const session: Session = {
      ...target.existing,
      cwd: result.cwd,
      pid: result.pid ?? target.existing.pid,
    };
    sessions.set(session);
    return {
      ok: true,
      sessionId: result.sessionId,
      resumed: true,
      pid: session.pid,
      alive: isPidAlive(session.pid),
      message: "resumed via PiAdapter (pi --session)",
    };
  });

  // —— chat (ChatAgentHost / pi-durable; isolated from CLI sessions) ——
  ipcMain.handle("chat:sessions", () => chatHost.listPanelSessions());
  ipcMain.handle(
    "chat:history",
    async (_e, input: string | { sessionId: string }) => {
      const key = parsePanelSessionKey(
        typeof input === "string" ? input : input?.sessionId,
      );
      const history = await chatHost.history(key);
      return { ok: true, sessionId: key, history };
    },
  );
  ipcMain.handle(
    "chat:send",
    async (_e, input: { sessionId: string; text: string }) => {
      const key = parsePanelSessionKey(input.sessionId);
      const result = await chatHost.send(key, input.text);
      return {
        ok: result.ok,
        sessionId: result.sessionId,
        conversationId: result.conversationId,
        status: result.status,
        message: result.message,
        history: result.history,
      };
    },
  );

  // —— model (pi-ai providers; credentials shared via pi's auth.json) ——
  ipcMain.handle("model:status", () => chatHost.getModelStatus());
  ipcMain.handle(
    "model:saveKey",
    async (_e, input: { providerId: string; apiKey: string }) => {
      await chatHost.saveApiKey(input.providerId, input.apiKey);
      return chatHost.getModelStatus();
    },
  );
  ipcMain.handle("model:clearKey", async (_e, providerId: string) => {
    await chatHost.clearApiKey(providerId);
    return chatHost.getModelStatus();
  });
  ipcMain.handle(
    "model:test",
    (_e, input: { providerId: string; apiKey?: string; modelId?: string }) =>
      chatHost.testProvider(input),
  );
  ipcMain.handle(
    "model:setSelected",
    async (_e, input: { provider: string; modelId: string }) => {
      await chatHost.setSelectedModel(input.provider, input.modelId);
      return chatHost.getModelStatus();
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
    credentials: new PiAuthFileCredentialStore(),
    modelConfig: new ModelConfigStore(path.join(dataDir, "model-config.json")),
  });
  void chatHost.start().catch((err) => {
    console.error("ChatAgentHost start failed", err);
  });
  registerIpc();
  createWindow();
  createTray();
  registerGlobalShortcuts();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      showMainWindow();
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  // Hiding the panel must not quit; only quit when no windows remain and not darwin.
  // Tray keeps the process alive while the window is merely hidden (not closed).
  if (process.platform !== "darwin") {
    // Keep running if tray exists and window was only hidden (mainWindow still set).
    if (mainWindow && !mainWindow.isDestroyed()) return;
    app.quit();
  }
});
