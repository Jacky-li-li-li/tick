import { useEffect, useState } from "react";
import { TodosView } from "./features/todos/TodosView";
import { ChatView } from "./features/chat/ChatView";
import { ModelConfigView } from "./features/model-config/ModelConfigView";

type Tab = "todos" | "chat";

export function App() {
  const [tab, setTab] = useState<Tab>("todos");
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showModelConfig, setShowModelConfig] = useState(false);

  useEffect(() => {
    void window.tick.window.getAlwaysOnTop().then(setAlwaysOnTop);
  }, []);

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
            onClick={() => void togglePin()}
            title="置顶 alwaysOnTop（独立控制）"
            aria-pressed={alwaysOnTop}
          >
            {alwaysOnTop ? "📌 置顶" : "置顶"}
          </button>
          <div className="menu-wrap">
            <button
              className={`icon-btn ${menuOpen ? "active" : ""}`}
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              title="菜单"
              aria-expanded={menuOpen}
            >
              ⌄ 菜单
            </button>
            {menuOpen && (
              <>
                <div
                  className="menu-backdrop"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="dropdown">
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      void togglePin();
                      setMenuOpen(false);
                    }}
                  >
                    <span>置顶</span>
                    <span className="dropdown-check">
                      {alwaysOnTop ? "✓" : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setMenuOpen(false);
                      void hidePanel();
                    }}
                  >
                    <span>隐藏面板</span>
                  </button>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowModelConfig(true);
                    }}
                  >
                    <span>模型配置</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {showModelConfig ? (
        <main className="content">
          <ModelConfigView onClose={() => setShowModelConfig(false)} />
        </main>
      ) : (
        <>
          <nav className="tabbar" role="tablist">
            <button
              role="tab"
              aria-selected={tab === "todos"}
              className={`tab ${tab === "todos" ? "active" : ""}`}
              type="button"
              onClick={() => setTab("todos")}
            >
              待办
            </button>
            <button
              role="tab"
              aria-selected={tab === "chat"}
              className={`tab ${tab === "chat" ? "active" : ""}`}
              type="button"
              onClick={() => setTab("chat")}
            >
              对话
            </button>
          </nav>
          <main className="content">
            {tab === "todos" ? <TodosView /> : <ChatView />}
          </main>
        </>
      )}
    </div>
  );
}
