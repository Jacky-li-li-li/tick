import type { Todo, TodoAiMeta } from "@tick/shared";
import { useState } from "react";

/** 「今天 / 昨天 / N 天前 / M-D」 label from an ISO time. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  return `${d.getMonth() + 1}-${d.getDate()}`;
}

/** 「…/Downloads/材料」 — keep the last two path segments. */
function shortCwd(cwd: string): string {
  const parts = cwd.split("/").filter(Boolean);
  if (parts.length <= 2) return cwd;
  return "…/" + parts.slice(-2).join("/");
}

type Props = {
  todos: Todo[];
  onRefresh: () => Promise<void>;
  onEdit?: (todo: Todo) => void;
  /** Open the bind wizard for this todo. */
  onBind?: (todo: Todo) => void;
};

export function TodoList({ todos, onRefresh, onEdit, onBind }: Props) {
  const [showDone, setShowDone] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** sessionId currently resuming (disabled state on its row item). */
  const [resumingId, setResumingId] = useState<string | null>(null);

  const openTodos = todos.filter((t) => t.status === "open");
  const doneTodos = todos.filter((t) => t.status === "done");
  const visible = showDone ? [...openTodos, ...doneTodos] : openTodos;

  async function setStatus(id: string, status: "open" | "done") {
    setError(null);
    try {
      await window.tick.todo.setStatus({ id, status });
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  /** Jump back to a bound session: `pi --session <id>` in a Terminal. */
  async function resumeSession(meta: TodoAiMeta) {
    setError(null);
    setResumingId(meta.sessionId);
    try {
      const result = await window.tick.ai.resume({
        toolId: meta.toolId,
        sessionId: meta.sessionId,
        cwd: meta.cwd,
      });
      if (!result?.ok) {
        setError(result?.message ?? "resume 失败（ok=false）");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setResumingId(null);
    }
  }

  return (
    <section className="card" data-feature="list">
      {visible.length === 0 && (
        <div className="stub">暂无待办，在下方添加。</div>
      )}

      {visible.map((todo) => {
        const isDone = todo.status === "done";
        const expanded = expandedId === todo.id;
        const aiList = todo.ai ?? [];
        return (
          <div key={todo.id} className={`todo-row-wrap ${expanded ? "expanded" : ""}`}>
            <div className={`todo-row ${isDone ? "done" : ""}`}>
              <button
                className="tick"
                type="button"
                aria-label={isDone ? "恢复为未完成" : "标记完成"}
                onClick={() => void setStatus(todo.id, isDone ? "open" : "done")}
              >
                {isDone ? "✓" : ""}
              </button>
              <button
                className="todo-main"
                type="button"
                onClick={() => setExpandedId(expanded ? null : todo.id)}
              >
                <span className="todo-title">{todo.title}</span>
                <span className="todo-tags">
                  <span className="time-tag">
                    {dayLabel(isDone ? todo.updatedAt : todo.createdAt)}
                  </span>
                  {aiList.length > 0 && <span className="ai-chip">AI</span>}
                  {todo.content ? <span className="note-chip">备注</span> : null}
                </span>
              </button>
              <div className="todo-right">
                {aiList.length > 0 && (
                  <span className="count-badge" title={`${aiList.length} 个 AI 会话`}>
                    {aiList.length}
                  </span>
                )}
              </div>
            </div>

            {expanded && (
              <div className="todo-detail">
                {todo.content ? (
                  <div className="todo-content">{todo.content}</div>
                ) : null}

                {aiList.length > 0 ? (
                  <div className="session-list">
                    {aiList.map((meta) => (
                      <button
                        key={meta.sessionId}
                        className="session-item"
                        type="button"
                        onClick={() => void resumeSession(meta)}
                        disabled={resumingId === meta.sessionId}
                        title="点击跳回该会话（pi --session）"
                      >
                        <span
                          className={`dot ${resumingId === meta.sessionId ? "busy" : "ok"}`}
                        />
                        <span className="session-name">
                          {meta.toolId} · {meta.sessionId.slice(0, 13)}…
                        </span>
                        <span className="session-path">{shortCwd(meta.cwd)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="stub">尚未绑定 AI 会话</div>
                )}

                <div className="detail-actions">
                  {onBind && (
                    <button className="tiny" type="button" onClick={() => onBind(todo)}>
                      {aiList.length > 0 ? "＋ 再绑一个 AI" : "拉起 AI"}
                    </button>
                  )}
                  {onEdit && (
                    <button className="tiny" type="button" onClick={() => onEdit(todo)}>
                      编辑
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {doneTodos.length > 0 && (
        <button
          className="linkish done-toggle"
          type="button"
          onClick={() => setShowDone((v) => !v)}
        >
          {showDone ? "收起已完成" : `已完成 ${doneTodos.length} 项`}
        </button>
      )}

      {error && <div className="error">{error}</div>}
    </section>
  );
}
