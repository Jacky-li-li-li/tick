import { useEffect, useState } from "react";
import type { UpdateState } from "@tick/shared";
import { TodosView } from "./features/todos/TodosView";
import { ChatView } from "./features/chat/ChatView";
import { ModelConfigView } from "./features/model-config/ModelConfigView";
import { useUpdateState } from "./features/update/useUpdateState";
import { UpdateSheet } from "./features/update/UpdateSheet";

type Tab = "todos" | "chat";

/** 菜单项文案随更新状态走：要让用户不打开 sheet 也能看到「有事可做」。 */
function updateMenuLabel(state: UpdateState | null): { label: string; mark: string } {
  if (!state) return { label: "检查更新", mark: "" };
  switch (state.status) {
    case "available":
      return { label: `版本 ${state.version}`, mark: "•" };
    case "downloading":
      return { label: `下载中 ${state.percent}%`, mark: "" };
    case "ready":
      return { label: "重启以更新", mark: "•" };
    default:
      return { label: "检查更新", mark: "" };
  }
}

/** 面板外壳（帧 01–08）：玻璃面板 + 顶栏分段 + ··· 菜单 + 模型配置整页视图。 */
export function App() {
  const [tab, setTab] = useState<Tab>("todos");
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showModelConfig, setShowModelConfig] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const updater = useUpdateState();
  const updateLabel = updateMenuLabel(updater.state);

  useEffect(() => {
    void window.tick.window.getAlwaysOnTop().then(setAlwaysOnTop);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function togglePin() {
    const next = await window.tick.window.setAlwaysOnTop(!alwaysOnTop);
    setAlwaysOnTop(next);
    setToast(next ? "已置顶：alwaysOnTop = true" : "已取消置顶");
  }

  async function hidePanel() {
    await window.tick.window.hide();
  }

  function openModelConfig() {
    setMenuOpen(false);
    setShowModelConfig(true);
  }

  return (
    <div className="panel">
      {showModelConfig ? (
        <ModelConfigView onClose={() => setShowModelConfig(false)} />
      ) : (
        <>
          <div className="topbar">
            <div className="seg">
              <button
                type="button"
                className={tab === "todos" ? "on" : ""}
                aria-pressed={tab === "todos"}
                onClick={() => setTab("todos")}
              >
                待办
              </button>
              <button
                type="button"
                className={tab === "chat" ? "on" : ""}
                aria-pressed={tab === "chat"}
                onClick={() => setTab("chat")}
              >
                对话
              </button>
            </div>
            <button
              className={menuOpen ? "icon-btn on" : "icon-btn"}
              type="button"
              title="置顶 / 隐藏 / 模型配置 / 检查更新"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              ···
            </button>
          </div>

          {tab === "todos" ? (
            <TodosView />
          ) : (
            <ChatView onOpenModelConfig={openModelConfig} />
          )}
        </>
      )}

      {menuOpen && (
        <>
          <div className="scrim" onClick={() => setMenuOpen(false)} />
          <div className="menu" role="menu">
            <button
              className="mi"
              type="button"
              role="menuitemcheckbox"
              aria-checked={alwaysOnTop}
              onClick={() => {
                setMenuOpen(false);
                void togglePin();
              }}
            >
              <span>置顶</span>
              <span className="mark">{alwaysOnTop ? "✓" : ""}</span>
            </button>
            <button
              className="mi"
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                void hidePanel();
              }}
            >
              <span>隐藏</span>
            </button>
            <button
              className="mi"
              type="button"
              role="menuitem"
              onClick={openModelConfig}
            >
              <span>模型配置</span>
            </button>
            <button
              className="mi"
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setShowUpdate(true);
              }}
            >
              <span>{updateLabel.label}</span>
              <span className="mark">{updateLabel.mark}</span>
            </button>
          </div>
        </>
      )}

      {showUpdate && (
        <UpdateSheet
          state={updater.state}
          onCheck={() => void updater.check()}
          onDownload={() => void updater.download()}
          onInstall={() => void updater.install()}
          onClose={() => setShowUpdate(false)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
