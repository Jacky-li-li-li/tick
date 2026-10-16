import { contextBridge, ipcRenderer } from "electron";
import type {
  AiLaunchInput,
  AiLaunchResult,
  AiResumeInput,
  AiTool,
  ChatHistoryItem,
  ChatSendResult,
  CreateTodoInput,
  ModelStatus,
  ModelTestResult,
  PanelChatSession,
  Session,
  SetTodoStatusInput,
  Todo,
  UpdateTodoInput,
} from "@tick/shared";

const api = {
  window: {
    getAlwaysOnTop: (): Promise<boolean> =>
      ipcRenderer.invoke("window:getAlwaysOnTop"),
    setAlwaysOnTop: (flag: boolean): Promise<boolean> =>
      ipcRenderer.invoke("window:setAlwaysOnTop", flag),
    show: (): Promise<boolean> => ipcRenderer.invoke("window:show"),
    hide: (): Promise<boolean> => ipcRenderer.invoke("window:hide"),
  },
  dialog: {
    pickDirectory: (input?: { defaultPath?: string }): Promise<string | null> =>
      ipcRenderer.invoke("dialog:pickDirectory", input),
  },
  todo: {
    list: (): Promise<Todo[]> => ipcRenderer.invoke("todo:list"),
    get: (id: string): Promise<Todo | null> => ipcRenderer.invoke("todo:get", id),
    create: (input: CreateTodoInput): Promise<Todo> =>
      ipcRenderer.invoke("todo:create", input),
    update: (input: UpdateTodoInput): Promise<Todo> =>
      ipcRenderer.invoke("todo:update", input),
    setStatus: (input: SetTodoStatusInput): Promise<Todo> =>
      ipcRenderer.invoke("todo:setStatus", input),
    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke("todo:delete", id),
  },
  session: {
    list: (): Promise<Session[]> => ipcRenderer.invoke("session:list"),
    get: (id: string): Promise<Session | null> =>
      ipcRenderer.invoke("session:get", id),
    bind: (input: { sessionId: string; todoId: string }): Promise<Session> =>
      ipcRenderer.invoke("session:bind", input),
    isAlive: (
      sessionId: string,
    ): Promise<{ sessionId: string; pid?: number; alive: boolean }> =>
      ipcRenderer.invoke("session:isAlive", sessionId),
  },
  ai: {
    listTools: (): Promise<AiTool[]> => ipcRenderer.invoke("ai:listTools"),
    launch: (input: AiLaunchInput): Promise<AiLaunchResult> =>
      ipcRenderer.invoke("ai:launch", input),
    resume: (input: AiResumeInput): Promise<AiLaunchResult> =>
      ipcRenderer.invoke("ai:resume", input),
  },
  chat: {
    sessions: (): Promise<PanelChatSession[]> =>
      ipcRenderer.invoke("chat:sessions"),
    history: (
      input: string | { sessionId: string },
    ): Promise<{
      ok: boolean;
      sessionId: string;
      history: ChatHistoryItem[];
    }> => ipcRenderer.invoke("chat:history", input),
    send: (input: {
      sessionId: string;
      text: string;
    }): Promise<ChatSendResult> => ipcRenderer.invoke("chat:send", input),
  },
  clipboard: {
    lastDelivered: (): Promise<{ text: string; at: string | null }> =>
      ipcRenderer.invoke("clipboard:lastDelivered"),
  },
  model: {
    status: (): Promise<ModelStatus> => ipcRenderer.invoke("model:status"),
    saveKey: (input: {
      providerId: string;
      apiKey: string;
    }): Promise<ModelStatus> => ipcRenderer.invoke("model:saveKey", input),
    clearKey: (providerId: string): Promise<ModelStatus> =>
      ipcRenderer.invoke("model:clearKey", providerId),
    test: (input: {
      providerId: string;
      apiKey?: string;
      modelId?: string;
    }): Promise<ModelTestResult> => ipcRenderer.invoke("model:test", input),
    setSelected: (input: {
      provider: string;
      modelId: string;
    }): Promise<ModelStatus> =>
      ipcRenderer.invoke("model:setSelected", input),
  },
};

contextBridge.exposeInMainWorld("tick", api);

export type TickApi = typeof api;
