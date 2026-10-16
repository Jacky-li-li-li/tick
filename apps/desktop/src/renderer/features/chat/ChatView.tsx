import { useCallback, useEffect, useMemo, useState } from "react";
import { PANEL_SESSION_PREFIX } from "@tick/ai-core";
import type { ChatHistoryItem, PanelChatSession } from "@tick/shared";
import { Sheet } from "../common/Sheet";

type Bubble = { who: "you" | "agent" | "system"; text: string };

type Props = {
  /** 未配置模型时引导卡的「去配置」→ 打开模型配置视图 */
  onOpenModelConfig: () => void;
};

function newPanelSessionId(): string {
  return `${PANEL_SESSION_PREFIX}chat-${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/** 「刚刚 / N 分钟前 / 昨天 / M-D」 */
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

/** 「对话」tab（帧 03 / 04 / 06）：会话列表 + 气泡 + 输入。 */
export function ChatView({ onOpenModelConfig }: Props) {
  const [sessions, setSessions] = useState<PanelChatSession[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [histories, setHistories] = useState<Record<string, Bubble[]>>({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [modelReady, setModelReady] = useState(true);

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

  // 初始：模型状态 + 会话列表；选中最近一个，没有就准备一个新会话 id。
  useEffect(() => {
    void (async () => {
      try {
        const status = await window.tick.model.status();
        setModelReady(!status.isFaux);
      } catch {
        setModelReady(false);
      }
      const list = await refreshSessions();
      setActiveId((cur) => cur || list[0]?.sessionId || newPanelSessionId());
      if (list.length === 0) setIsNew(true);
    })();
  }, [refreshSessions]);

  useEffect(() => {
    if (activeId) void loadHistory(activeId);
  }, [activeId, loadHistory]);

  const messages = histories[activeId] ?? [];

  const currentTitle = useMemo(() => {
    if (isNew) return "新会话";
    const found = sessions.find((s) => s.sessionId === activeId);
    return found?.title ?? "新会话";
  }, [sessions, activeId, isNew]);

  function newSession() {
    setActiveId(newPanelSessionId());
    setIsNew(true);
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
      setIsNew(false);
      void refreshSessions(); // 首条消息后出现标题 / 时间
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await loadHistory(activeId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="chead">
        <button
          className="icon-btn"
          type="button"
          title="会话列表"
          aria-expanded={listOpen}
          onClick={() => {
            setListOpen((v) => !v);
            if (!listOpen) void refreshSessions();
          }}
        >
          ☰
        </button>
        <span className="chead-title">{currentTitle}</span>
        <span className="chead-spacer" />
      </div>

      {!modelReady ? (
        <div className="chat-guide">
          <div className="card">
            <b>先配置 AI 模型</b>
            <span>还没有可用的模型</span>
            <br />
            <button className="cta" type="button" onClick={onOpenModelConfig}>
              去配置
            </button>
          </div>
        </div>
      ) : (
        <div className="log">
          {messages.length === 0 && (
            <div className="stub">和 AI 说点什么…（可说「建一条 todo：买咖啡豆」）</div>
          )}
          {messages.map((m, i) => (
            <div key={`${activeId}-${i}`} className={m.who === "you" ? "msg me" : "msg ai"}>
              {m.text}
            </div>
          ))}
        </div>
      )}

      <div className="compose">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="和 AI 说点什么…"
          disabled={busy || !modelReady}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button
          className="primary"
          type="button"
          onClick={() => void send()}
          disabled={!text.trim() || busy || !modelReady}
        >
          {busy ? "…" : "发送"}
        </button>
      </div>

      {listOpen && (
        <Sheet top onDismiss={() => setListOpen(false)}>
          {sessions.map((s) => (
            <button
              key={s.sessionId}
              type="button"
              className={s.sessionId === activeId ? "si selected" : "si"}
              onClick={() => {
                setActiveId(s.sessionId);
                setIsNew(false);
                setListOpen(false);
              }}
            >
              <span className="si-body">
                <span className="si-name">{s.title}</span>
              </span>
              <span className="si-meta">{relTime(s.updatedAt)}</span>
            </button>
          ))}
          {sessions.length === 0 && (
            <div className="stub" style={{ padding: "8px 10px" }}>
              还没有会话
            </div>
          )}
          <button className="si add" type="button" onClick={newSession}>
            ＋ 新建会话
          </button>
        </Sheet>
      )}

      {error && <div className="toast">{error}</div>}
    </>
  );
}
