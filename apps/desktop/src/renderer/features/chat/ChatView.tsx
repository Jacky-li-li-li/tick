import { useCallback, useEffect, useMemo, useState } from "react";
import { PANEL_SESSION_PREFIX } from "@tick/ai-core";
import type { ChatHistoryItem, PanelChatSession } from "@tick/shared";

type Bubble = { who: "you" | "agent" | "system"; text: string };

function newPanelSessionId(): string {
  return `${PANEL_SESSION_PREFIX}chat-${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/** 「刚刚 / N 分钟前 / 昨天 / M-D」 for the session list. */
function relTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  return `${d.getMonth() + 1}-${d.getDate()}`;
}

function toBubbles(items: ChatHistoryItem[]): Bubble[] {
  return items.map((m) => ({ who: m.who, text: m.text }));
}

/** 「对话」tab — 多会话面板 chat（03/04 帧）。 */
export function ChatView() {
  const [sessions, setSessions] = useState<PanelChatSession[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [histories, setHistories] = useState<Record<string, Bubble[]>>({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);

  const refreshSessions = useCallback(async () => {
    try {
      const list = await window.tick.chat.sessions();
      setSessions(list);
      return list;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return [];
    }
  }, []);

  const loadHistory = useCallback(async (sessionId: string) => {
    try {
      const res = await window.tick.chat.history({ sessionId });
      setHistories((prev) => ({
        ...prev,
        [sessionId]: toBubbles(res.history ?? []),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // 初始：加载会话列表；选中最近一个，没有就准备一个新会话 id。
  useEffect(() => {
    void (async () => {
      const list = await refreshSessions();
      setActiveId((cur) => cur || list[0]?.sessionId || newPanelSessionId());
    })();
  }, [refreshSessions]);

  // 切换会话：拉历史。
  useEffect(() => {
    if (activeId) void loadHistory(activeId);
  }, [activeId, loadHistory]);

  const messages = histories[activeId] ?? [];

  const currentTitle = useMemo(() => {
    const found = sessions.find((s) => s.sessionId === activeId);
    return found?.title ?? "新会话";
  }, [sessions, activeId]);

  function newSession() {
    setActiveId(newPanelSessionId());
    setListOpen(false);
    setText("");
    setError(null);
  }

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setError(null);
    setBusy(true);
    setText("");
    try {
      const result = await window.tick.chat.send({
        sessionId: activeId,
        text: trimmed,
      });
      setHistories((prev) => ({
        ...prev,
        [activeId]: toBubbles(
          result.history ?? [
            { who: "you", text: trimmed },
            { who: "agent", text: result.message },
          ],
        ),
      }));
      void refreshSessions(); // 首条消息后出现标题/时间
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await loadHistory(activeId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card chat-view" data-feature="chat">
      <div className="chat-top">
        <button
          className="chat-current"
          type="button"
          onClick={() => {
            setListOpen((v) => !v);
            if (!listOpen) void refreshSessions();
          }}
          aria-expanded={listOpen}
        >
          <span className="chat-current-title">{currentTitle}</span>
          <span className="chat-caret">{listOpen ? "▴" : "▾"}</span>
        </button>
        <button className="tiny" type="button" onClick={newSession}>
          ＋ 新会话
        </button>
      </div>

      {listOpen && (
        <div className="chat-session-list">
          {sessions.map((s) => (
            <button
              key={s.sessionId}
              type="button"
              className={`chat-session-item ${
                s.sessionId === activeId ? "active" : ""
              }`}
              onClick={() => {
                setActiveId(s.sessionId);
                setListOpen(false);
              }}
            >
              <span className="chat-session-name">{s.title}</span>
              <span className="chat-session-time">{relTime(s.updatedAt)}</span>
            </button>
          ))}
          {sessions.length === 0 && <div className="stub">还没有会话</div>}
        </div>
      )}

      <div className="chat-log">
        {messages.length === 0 && (
          <div className="stub">
            和 AI 说点什么…（可说「建一条 todo：买咖啡豆」）
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={`${activeId}-${i}`}
            className={`msg-row ${m.who === "you" ? "you" : "agent"}`}
          >
            <div className="msg-bubble">{m.text}</div>
          </div>
        ))}
      </div>

      <div className="chat-compose">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="和 AI 说点什么…"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button
          className="primary sm"
          type="button"
          onClick={() => void send()}
          disabled={!text.trim() || busy}
        >
          {busy ? "…" : "发送"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}
    </section>
  );
}
