import { randomUUID } from "node:crypto";
import type {
  CreateTodoInput,
  SetTodoStatusInput,
  Todo,
  TodoAiMeta,
  UpdateTodoInput,
} from "@tick/shared";

export class TodoStore {
  private todos: Todo[] = [];

  list(): Todo[] {
    return [...this.todos].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  create(input: CreateTodoInput): Todo {
    const title = input.title?.trim();
    if (!title) {
      throw new Error("title is required");
    }
    const now = new Date().toISOString();
    const todo: Todo = {
      id: randomUUID(),
      title,
      content: input.content?.trim() || undefined,
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
    this.todos.push(todo);
    return todo;
  }

  update(input: UpdateTodoInput): Todo {
    const idx = this.todos.findIndex((t) => t.id === input.id);
    if (idx < 0) {
      throw new Error(`todo not found: ${input.id}`);
    }
    const current = this.todos[idx];
    if (input.title !== undefined && !input.title.trim()) {
      throw new Error("title is required");
    }
    const next: Todo = {
      ...current,
      title:
        input.title !== undefined ? input.title.trim() : current.title,
      content:
        input.content !== undefined
          ? input.content.trim() || undefined
          : current.content,
      updatedAt: new Date().toISOString(),
    };
    this.todos[idx] = next;
    return next;
  }

  setStatus(input: SetTodoStatusInput): Todo {
    const idx = this.todos.findIndex((t) => t.id === input.id);
    if (idx < 0) {
      throw new Error(`todo not found: ${input.id}`);
    }
    if (input.status !== "open" && input.status !== "done") {
      throw new Error(`invalid status: ${input.status}`);
    }
    const next: Todo = {
      ...this.todos[idx],
      status: input.status,
      updatedAt: new Date().toISOString(),
    };
    this.todos[idx] = next;
    return next;
  }

  delete(id: string): boolean {
    const before = this.todos.length;
    this.todos = this.todos.filter((t) => t.id !== id);
    return this.todos.length < before;
  }

  bindAi(id: string, ai: TodoAiMeta): Todo {
    const idx = this.todos.findIndex((t) => t.id === id);
    if (idx < 0) {
      throw new Error(`todo not found: ${id}`);
    }
    const next: Todo = {
      ...this.todos[idx],
      ai,
      updatedAt: new Date().toISOString(),
    };
    this.todos[idx] = next;
    return next;
  }
}
