import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  CreateTodoInput,
  SetTodoStatusInput,
  Todo,
  TodoAiMeta,
  UpdateTodoInput,
} from "@tick/shared";

type PersistShape = { version: 1; todos: Todo[] };

export class TodoStore {
  private todos: Todo[] = [];
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PersistShape;
      if (parsed?.version === 1 && Array.isArray(parsed.todos)) {
        this.todos = parsed.todos;
      }
    } catch {
      this.todos = [];
    }
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const payload: PersistShape = { version: 1, todos: this.todos };
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tmp, this.filePath);
  }

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
    this.save();
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
      title: input.title !== undefined ? input.title.trim() : current.title,
      content:
        input.content !== undefined
          ? input.content.trim() || undefined
          : current.content,
      updatedAt: new Date().toISOString(),
    };
    this.todos[idx] = next;
    this.save();
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
    this.save();
    return next;
  }

  delete(id: string): boolean {
    const before = this.todos.length;
    this.todos = this.todos.filter((t) => t.id !== id);
    const changed = this.todos.length < before;
    if (changed) this.save();
    return changed;
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
    this.save();
    return next;
  }
}
