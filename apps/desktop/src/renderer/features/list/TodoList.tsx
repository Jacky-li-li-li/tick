import { useState } from "react";
import type { Todo } from "@tick/shared";

const DEFAULT_OPEN_VISIBLE = 5;

type Props = {
  todos: Todo[];
  onRefresh: () => Promise<void>;
};

export function TodoList({ todos, onRefresh }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openTodos = todos.filter((t) => t.status === "open");
  const doneTodos = todos.filter((t) => t.status === "done");

  // Default: first 5 open only; done excluded until expanded
  const visible = expanded
    ? [...openTodos, ...doneTodos]
    : openTodos.slice(0, DEFAULT_OPEN_VISIBLE);

  const hiddenOpen = Math.max(0, openTodos.length - DEFAULT_OPEN_VISIBLE);
  const canExpand = hiddenOpen > 0 || doneTodos.length > 0;

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

  function startEdit(todo: Todo) {
    setEditingId(todo.id);
    setEditTitle(todo.title);
    setEditContent(todo.content ?? "");
  }

  async function saveEdit() {
    if (!editingId) return;
    const title = editTitle.trim();
    if (!title) {
      setError("title is required");
      return;
    }
    setError(null);
    try {
      await window.tick.todo.update({
        id: editingId,
        title,
        content: editContent,
      });
      setEditingId(null);
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className="card">
      <div className="meta-row">
        <span>
          Todos · 进行中 {openTodos.length}
          {doneTodos.length > 0 ? ` · 已完成 ${doneTodos.length}` : ""}
          {!expanded ? ` · 默认显示 ${DEFAULT_OPEN_VISIBLE} 条未完成` : ""}
        </span>
        {canExpand && (
          <button className="linkish" type="button" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "收起" : "展开全部"}
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

      {visible.map((todo) => (
        <div key={todo.id} className={`todo-item ${todo.status === "done" ? "done" : ""}`}>
          <input
            className="check"
            type="checkbox"
            checked={todo.status === "done"}
            onChange={() =>
              setStatus(todo.id, todo.status === "done" ? "open" : "done")
            }
            title="完成只改 status，不删除"
          />

          <div>
            {editingId === todo.id ? (
              <div className="edit-row">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="标题（必填）"
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="内容（可选）"
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="tiny done" type="button" onClick={saveEdit}>
                    保存
                  </button>
                  <button className="tiny" type="button" onClick={() => setEditingId(null)}>
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="todo-title">{todo.title}</div>
                {todo.content ? <div className="todo-content">{todo.content}</div> : null}
              </>
            )}
          </div>

          <div className="todo-actions">
            {editingId !== todo.id && (
              <button className="tiny" type="button" onClick={() => startEdit(todo)}>
                编辑
              </button>
            )}
            <button className="tiny danger" type="button" onClick={() => remove(todo.id)}>
              删除
            </button>
          </div>
        </div>
      ))}

      {error && <div className="error">{error}</div>}
    </section>
  );
}
