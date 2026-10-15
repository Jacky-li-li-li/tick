import { contextBridge, ipcRenderer } from "electron";
import type {
  AiLaunchInput,
  AiLaunchResult,
  AiResumeInput,
  AiTool,
  ChatHistoryItem,
  ChatSendResult,
  CreateTodoInput,
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
    history: (
      input: string | { sessionId: string },
    ): Promise<{
      ok: boolean;
      sessionId: string;
      history: ChatHistoryItem[];
      messages?: Array<{
        id: string;
        role: string;
        text: string;
        createdAt: string;
      }>;
    }> =>
      ipcRenderer.invoke(
        "chat:history",
        typeof input === "string" ? input : input,
      ),
    send: (input: {
      sessionId: string;
      text: string;
    }): Promise<ChatSendResult> => ipcRenderer.invoke("chat:send", input),
  },
  clipboard: {
    lastDelivered: (): Promise<{ text: string; at: string | null }> =>
      ipcRenderer.invoke("clipboard:lastDelivered"),
  },
};

contextBridge.exposeInMainWorld("tick", api);

export type TickApi = typeof api;
