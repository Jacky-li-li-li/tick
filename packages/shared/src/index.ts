export type TodoStatus = "open" | "done";

export interface TodoAiMeta {
  toolId: string;
  sessionId: string;
  cwd: string;
  /** 绑定时间（列表右侧竖条数字 → 会话列表里显示「今天 / 昨天」） */
  boundAt?: string;
}

export interface Todo {
  id: string;
  title: string;
  content?: string;
  status: TodoStatus;
  createdAt: string;
  updatedAt: string;
  /** Bound AI sessions (multiple tools / sessions per todo). */
  ai?: TodoAiMeta[];
}

export type CreateTodoInput = {
  title: string;
  content?: string;
};

export type UpdateTodoInput = {
  id: string;
  title?: string;
  content?: string;
};

export type SetTodoStatusInput = {
  id: string;
  status: TodoStatus;
};

export type AiTool = {
  id: string;
  name: string;
  available: boolean;
  capabilities?: {
    needsCwd: boolean;
    resumeSession: boolean;
    deliverPrompt: string;
    listSessions: boolean;
  };
};

export type AiLaunchResult = {
  ok: boolean;
  sessionId: string;
  spawned?: boolean;
  resumed?: boolean;
  clipboard?: boolean;
  pid?: number;
  alive?: boolean;
  message?: string;
};

export type AiLaunchInput = {
  toolId: string;
  cwd: string;
  todoId?: string;
  prompt?: string;
};

export type AiResumeInput = {
  toolId: string;
  sessionId: string;
  cwd: string;
};

export type Session = {
  id: string;
  todoId?: string;
  cwd?: string;
  toolId?: string;
  createdAt: string;
  /** Last known CLI process pid for E2 liveness probe */
  pid?: number;
};


export type ChatHistoryItem = {
  who: "you" | "agent" | "system";
  text: string;
  entryId?: string;
};

export type ChatSendResult = {
  ok: boolean;
  sessionId: string;
  conversationId?: string;
  status?: string;
  message: string;
  history?: ChatHistoryItem[];
};

export type ModelSelection = {
  provider: string;
  modelId: string;
};

export type ModelProviderInfo = {
  providerId: string;
  /** A credential exists for this provider (shared pi auth.json). */
  configured: boolean;
  /**
   * pi-ai 认为该 provider 当前可用（凭据或环境变量提供的 ambient auth）。
   * 为何要独立于 configured：只配了环境变量（如 MOONSHOT_API_KEY）时
   * configured 为 false，但模型其实能用，界面需要把这种情况标出来。
   */
  available: boolean;
  /** Catalog model ids (capped); empty for purely dynamic providers. */
  models: string[];
};

export type ModelStatus = {
  /** Currently effective selection; null while falling back to faux. */
  selected: ModelSelection | null;
  isFaux: boolean;
  providers: ModelProviderInfo[];
};

export type ModelTestResult = {
  ok: boolean;
  message: string;
  latencyMs?: number;
};

export type PanelChatSession = {
  sessionId: string;
  title: string;
  updatedAt?: string;
};
