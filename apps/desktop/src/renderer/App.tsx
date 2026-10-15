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
  /** Todo id to preselect in AiPicker (from list button / created notice). */
  const [aiRequestTodoId, setAiRequestTodoId] = useState<string | null>(null);
  /** Freshly created todo — shows a one-line「拉起 AI」nudge. */
  const [justCreated, setJustCreated] = useState<{ id: string; title: string } | null>(
    null,
  );

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

  /** Reveal ai-picker, preselect the todo, and scroll it into view. */
  const requestAiFor = useCallback((todoId: string) => {
    setShowExtras(true);
    setAiRequestTodoId(todoId);
    setJustCreated(null);
    window.setTimeout(() => {
      document
        .querySelector('[data-feature="ai-picker"]')
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
  }, []);

  const handleAiFocusHandled = useCallback(() => setAiRequestTodoId(null), []);

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
          onCreated={async (created) => {
            if (created) setJustCreated({ id: created.id, title: created.title });
            await refresh();
          }}
          onSaved={async () => {
            setEditingTodo(null);
            await refresh();
          }}
          onCancelEdit={() => setEditingTodo(null)}
        />

        {justCreated && (
          <div className="notice">
            <span className="notice-text">已添加「{justCreated.title}」</span>
            <button
              className="tiny"
              type="button"
              onClick={() => requestAiFor(justCreated.id)}
            >
              拉起 AI
            </button>
            <button
              className="tiny"
              type="button"
              onClick={() => setJustCreated(null)}
            >
              忽略
            </button>
          </div>
        )}

        <div className="region-label">list</div>
        <TodoList
          todos={todos}
          onRefresh={refresh}
          onEdit={(todo) => setEditingTodo(todo)}
          onAiRequest={requestAiFor}
        />

        {showExtras && (
          <>
            <div className="region-label">ai-picker</div>
            <AiPicker
              todos={todos}
              onRefresh={refresh}
              focusTodoId={aiRequestTodoId}
              onFocusHandled={handleAiFocusHandled}
            />
            <div className="region-label">panel-chat</div>
            <PanelChat />
          </>
        )}
      </main>
    </div>
  );
}
