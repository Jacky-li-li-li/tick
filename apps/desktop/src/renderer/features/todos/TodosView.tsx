import { useCallback, useEffect, useMemo, useState } from "react";
import type { Todo } from "@tick/shared";
import { TodoList } from "../list/TodoList";
import { AddTodoRow } from "../editor/AddTodoRow";
import { TodoEditSheet } from "../editor/TodoEditSheet";
import { BindWizard } from "../bind-wizard/BindWizard";
import { SessionsSheet } from "../sessions/SessionsSheet";

type View = "open" | "done";

/** 「待办」tab（帧 01 / 02 / 14 / 13 / 19 / 09-12 / 15-17）：分段 + 列表 + 添加 + sheets。 */
export function TodosView() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [view, setView] = useState<View>("open");
  const [editing, setEditing] = useState<Todo | null>(null);
  const [bindTarget, setBindTarget] = useState<Todo | null>(null);
  const [sessionsTarget, setSessionsTarget] = useState<Todo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await window.tick.todo.list();
      setTodos(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openTodos = useMemo(() => todos.filter((t) => t.status === "open"), [todos]);
  const doneTodos = useMemo(() => todos.filter((t) => t.status === "done"), [todos]);
  const visible = view === "open" ? openTodos : doneTodos;

  async function toggle(todo: Todo) {
    setError(null);
    try {
      await window.tick.todo.setStatus({
        id: todo.id,
        status: todo.status === "open" ? "done" : "open",
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  /** 会话 / 绑定会改动 todo，关闭后统一刷新（竖条数字要跟着变） */
  async function closeAndRefresh() {
    setEditing(null);
    setSessionsTarget(null);
    setBindTarget(null);
    await refresh();
  }

  return (
    <>
      <div className="subseg">
        <div className="seg sm">
          <button
            type="button"
            className={view === "open" ? "on" : ""}
            onClick={() => setView("open")}
          >
            待办
          </button>
          <button
            type="button"
            className={view === "done" ? "on" : ""}
            onClick={() => setView("done")}
          >
            已完成
          </button>
        </div>
      </div>

      <TodoList
        todos={visible}
        done={view === "done"}
        onToggle={(todo) => void toggle(todo)}
        onEdit={(todo) => setEditing(todo)}
        onSessions={(todo) => setSessionsTarget(todo)}
      />

      <AddTodoRow
        guide={view === "open" && openTodos.length === 0}
        onCreated={(todo) => {
          void refresh();
          // 帧 09：创建后立刻问「为这条待办选 AI」
          setBindTarget(todo);
        }}
      />

      {editing && (
        <TodoEditSheet
          todo={editing}
          onClose={() => setEditing(null)}
          onChanged={closeAndRefresh}
        />
      )}

      {sessionsTarget && (
        <SessionsSheet
          todo={sessionsTarget}
          onClose={() => void closeAndRefresh()}
          onRebind={(todo) => {
            setSessionsTarget(null);
            setBindTarget(todo);
          }}
        />
      )}

      {bindTarget && (
        <BindWizard todo={bindTarget} onClose={() => void closeAndRefresh()} />
      )}

      {error && <div className="toast">{error}</div>}
    </>
  );
}
