import { useCallback, useEffect, useState } from "react";
import type { Todo } from "@tick/shared";
import { TodoList } from "../list/TodoList";
import { AddTodoRow } from "../editor/AddTodoRow";
import { TodoEditModal } from "../editor/TodoEditModal";
import { BindWizard } from "../bind-wizard/BindWizard";

/** 「待办」tab — list + add row + edit modal + bind wizard. */
export function TodosView() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [bindTarget, setBindTarget] = useState<Todo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTodos(await window.tick.todo.list());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="todos-view">
      <TodoList
        todos={todos}
        onRefresh={refresh}
        onEdit={(todo) => setEditing(todo)}
        onBind={(todo) => setBindTarget(todo)}
      />

      <AddTodoRow
        onCreated={(todo) => {
          void refresh();
          // 09 帧：创建后进入「选 AI」（可跳过）
          setBindTarget(todo);
        }}
      />

      {editing && (
        <TodoEditModal
          todo={editing}
          onClose={() => setEditing(null)}
          onChanged={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}

      {bindTarget && (
        <BindWizard
          todo={bindTarget}
          onClose={() => {
            setBindTarget(null);
            void refresh();
          }}
        />
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}
