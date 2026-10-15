import { useCallback, useEffect, useState } from "react";
import type { Todo } from "@tick/shared";
import { TodoEditor } from "./features/editor/TodoEditor";
import { TodoList } from "./features/list/TodoList";
import { AiPicker } from "./features/ai-picker/AiPicker";
import { PanelChat } from "./features/panel-chat/PanelChat";

export function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  /** QA #3: list+editor dominate; AI/Chat collapsed until「更多」. */
  const [showExtras, setShowExtras] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  const refresh = useCallback(async () => {
    const list = await window.tick.todo.list();
    setTodos(list);
  }, []);

  useEffect(() => {
    void refresh();
    void window.tick.window.getAlwaysOnTop().then(setAlwaysOnTop);
  }, [refresh]);

  async function togglePin() {
    const next = await window.tick.window.setAlwaysOnTop(!alwaysOnTop);
    setAlwaysOnTop(next);
  }

  async function hidePanel() {
    await window.tick.window.hide();
  }

  return (
    <div className="app">
      <header className="titlebar">
        <h1>
          Tick <span className="title-sub">Todo Panel</span>
        </h1>
        <div className="actions">
          <button
            className={`icon-btn ${alwaysOnTop ? "active on" : ""}`}
            type="button"
            onClick={togglePin}
            title="置顶 alwaysOnTop（独立控制）"
            aria-pressed={alwaysOnTop}
          >
            {alwaysOnTop ? "📌 置顶" : "置顶"}
          </button>
          <button
            className="icon-btn"
            type="button"
            onClick={hidePanel}
            title="隐藏面板 window:hide"
          >
            隐藏
          </button>
          <button
            className="icon-btn"
            type="button"
            onClick={() => setShowExtras((v) => !v)}
            title="显示 / 收起 ai-picker 与 panel-chat"
            aria-expanded={showExtras}
          >
            {showExtras ? "收起" : "更多"}
          </button>
        </div>
      </header>

      <main className="content">
        <div className="region-label">editor</div>
        <TodoEditor
          editingTodo={editingTodo}
          onCreated={refresh}
          onSaved={async () => {
            setEditingTodo(null);
            await refresh();
          }}
          onCancelEdit={() => setEditingTodo(null)}
        />

        <div className="region-label">list</div>
        <TodoList
          todos={todos}
          onRefresh={refresh}
          onEdit={(todo) => setEditingTodo(todo)}
        />

        {showExtras && (
          <>
            <div className="region-label">ai-picker</div>
            <AiPicker todos={todos} onRefresh={refresh} />
            <div className="region-label">panel-chat</div>
            <PanelChat />
          </>
        )}
      </main>
    </div>
  );
}
