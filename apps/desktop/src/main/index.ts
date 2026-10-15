import { app, BrowserWindow, clipboard, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type {
  AiLaunchInput,
  AiResumeInput,
  CreateTodoInput,
  Session,
  SetTodoStatusInput,
  UpdateTodoInput,
} from "@tick/shared";
import { TodoStore } from "./todo-store";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const store = new TodoStore();
const sessions = new Map<string, Session>();

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
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
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
  ipcMain.handle("todo:create", (_e, input: CreateTodoInput) => store.create(input));
  ipcMain.handle("todo:update", (_e, input: UpdateTodoInput) => store.update(input));
  ipcMain.handle("todo:setStatus", (_e, input: SetTodoStatusInput) =>
    store.setStatus(input),
  );
  ipcMain.handle("todo:delete", (_e, id: string) => store.delete(id));

  // —— session (CLI / tool sessions; not chat) ——
  ipcMain.handle("session:list", () => [...sessions.values()]);
  ipcMain.handle("session:get", (_e, id: string) => sessions.get(id) ?? null);
  ipcMain.handle(
    "session:bind",
    (_e, input: { sessionId: string; todoId: string }) => {
      const session = sessions.get(input.sessionId);
      if (!session) throw new Error(`session not found: ${input.sessionId}`);
      const next = { ...session, todoId: input.todoId };
      sessions.set(input.sessionId, next);
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

  // —— ai ——
  ipcMain.handle("ai:listTools", () => [
    { id: "pi", name: "Pi", available: false },
    { id: "stub", name: "Stub", available: true },
  ]);
  ipcMain.handle("ai:launch", (_e, input: AiLaunchInput) => {
    const sessionId = randomUUID();
    const prompt = input.prompt?.trim() || "";
    if (prompt) clipboard.writeText(prompt);
    // spawn stub — real pi spawn later when binary is available
    const session: Session = {
      id: sessionId,
      todoId: input.todoId,
      cwd: input.cwd,
      toolId: input.toolId,
      createdAt: new Date().toISOString(),
    };
    sessions.set(sessionId, session);
    if (input.todoId) {
      store.bindAi(input.todoId, {
        toolId: input.toolId,
        sessionId,
        cwd: input.cwd,
      });
    }
    return {
      ok: true,
      sessionId,
      spawned: false,
      clipboard: !!prompt,
      message: "P0 stub: prompt copied to clipboard; spawn deferred",
    };
  });
  ipcMain.handle("ai:resume", (_e, input: AiResumeInput) => {
    const existing = sessions.get(input.sessionId);
    if (!existing) {
      const session: Session = {
        id: input.sessionId,
        cwd: input.cwd,
        toolId: input.toolId,
        createdAt: new Date().toISOString(),
      };
      sessions.set(input.sessionId, session);
    }
    return {
      ok: true,
      sessionId: input.sessionId,
      resumed: false,
      message: "P0 stub: resume deferred until tool binary is available",
    };
  });

  // —— chat (namespaced; isolated from CLI sessions) ——
  ipcMain.handle(
    "chat:send",
    (_e, _input: { sessionId: string; text: string }) => ({
      ok: false,
      message: "chat:* stub — panel chat not implemented in P0",
    }),
  );
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
