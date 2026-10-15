import { useCallback, useEffect, useState } from "react";
import type { Todo } from "@tick/shared";
import { TodoEditor } from "./features/editor/TodoEditor";
import { TodoList } from "./features/list/TodoList";
import { AiPicker } from "./features/ai-picker/AiPicker";
import { PanelChat } from "./features/panel-chat/PanelChat";

export function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [showExtras, setShowExtras] = useState(false);

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

  return (
    <div className="app">
      <header className="titlebar">
        <h1>Tick</h1>
        <div className="actions">
          <button
            className={`icon-btn ${alwaysOnTop ? "active" : ""}`}
            type="button"
            onClick={togglePin}
            title="alwaysOnTop"
          >
            {alwaysOnTop ? "置顶中" : "未置顶"}
          </button>
          <button
            className="icon-btn"
            type="button"
            onClick={() => setShowExtras((v) => !v)}
          >
            {showExtras ? "收起" : "更多"}
          </button>
        </div>
      </header>

      <main className="content">
        <TodoEditor onCreated={refresh} />
        <TodoList todos={todos} onRefresh={refresh} />
        {showExtras && (
          <>
            <AiPicker />
            <PanelChat />
          </>
        )}
      </main>
    </div>
  );
}
