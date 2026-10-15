import { contextBridge, ipcRenderer } from "electron";
import type {
  AiLaunchInput,
  AiResumeInput,
  AiTool,
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
  },
  ai: {
    listTools: (): Promise<AiTool[]> => ipcRenderer.invoke("ai:listTools"),
    launch: (input: AiLaunchInput) => ipcRenderer.invoke("ai:launch", input),
    resume: (input: AiResumeInput) => ipcRenderer.invoke("ai:resume", input),
  },
  chat: {
    send: (input: { sessionId: string; text: string }) =>
      ipcRenderer.invoke("chat:send", input),
  },
};

contextBridge.exposeInMainWorld("tick", api);

export type TickApi = typeof api;
