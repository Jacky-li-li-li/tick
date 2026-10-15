import type { Todo } from "@tick/shared";
import { useState } from "react";

const DEFAULT_OPEN_VISIBLE = 5;

type Props = {
  todos: Todo[];
  onRefresh: () => Promise<void>;
  onEdit?: (todo: Todo) => void;
};

export function TodoList({ todos, onRefresh, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openTodos = todos.filter((t) => t.status === "open");
  const doneTodos = todos.filter((t) => t.status === "done");

  // Collapsed: first 5 open only; done excluded until expanded (C3)
  const visible = expanded
    ? [...openTodos, ...doneTodos]
    : openTodos.slice(0, DEFAULT_OPEN_VISIBLE);

  const hiddenOpen = Math.max(0, openTodos.length - DEFAULT_OPEN_VISIBLE);
  const canExpand = hiddenOpen > 0 || doneTodos.length > 0;
  const total = todos.length;

  async function setStatus(id: string, status: "open" | "done") {
    setError(null);
    try {
      await window.tick.todo.setStatus({ id, status });
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await window.tick.todo.delete(id);
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const shownOpen = Math.min(DEFAULT_OPEN_VISIBLE, openTodos.length);
  const caption = expanded
    ? `显示全部 ${total}（open ${openTodos.length} + done ${doneTodos.length}）`
    : `显示 ${shownOpen}/${total}（优先未完成）`;

  return (
    <section className="card" data-feature="list">
      <div className="meta-row">
        <span>{caption}</span>
        {canExpand && (
          <button
            className="linkish"
            type="button"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "收起" : "展开 · 其余 open + done"}
          </button>
        )}
      </div>

      {visible.length === 0 && (
        <div className="stub">
          {todos.length === 0
            ? "暂无 Todo，在上方编辑器添加。"
            : "没有未完成的 Todo（已完成项在展开后可见）。"}
        </div>
      )}

      {visible.map((todo) => {
        const isDone = todo.status === "done";
        return (
          <div
            key={todo.id}
            className={`todo-item ${isDone ? "done" : ""}`}
          >
            <input
              className="check"
              type="checkbox"
              checked={isDone}
              onChange={() => setStatus(todo.id, isDone ? "open" : "done")}
              title="完成只改 status，不删除"
            />

            <div className="todo-body">
              <div className="todo-title">{todo.title}</div>
              {todo.content ? (
                <div className="todo-content">{todo.content}</div>
              ) : null}
              <div className="todo-meta">
                {isDone && <span className="tag done-tag">已完成</span>}
                {todo.ai && (
                  <span className="tag ai" title="todo.ai 绑定">
                    {todo.ai.toolId} · {todo.ai.sessionId} · {todo.ai.cwd}
                  </span>
                )}
              </div>
            </div>

            <div className="todo-actions">
              {isDone ? (
                <button
                  className="tiny"
                  type="button"
                  onClick={() => setStatus(todo.id, "open")}
                  title="setStatus → open"
                >
                  重开
                </button>
              ) : null}
              {onEdit && (
                <button
                  className="tiny"
                  type="button"
                  onClick={() => onEdit(todo)}
                >
                  编辑
                </button>
              )}
              <button
                className="tiny danger"
                type="button"
                onClick={() => remove(todo.id)}
              >
                删除
              </button>
            </div>
          </div>
        );
      })}

      {error && <div className="error">{error}</div>}
    </section>
  );
}
