export type TodoStatus = "open" | "done";

export interface TodoAiMeta {
  toolId: string;
  sessionId: string;
  cwd: string;
}

export interface Todo {
  id: string;
  title: string;
  content?: string;
  status: TodoStatus;
  createdAt: string;
  updatedAt: string;
  ai?: TodoAiMeta;
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
};
