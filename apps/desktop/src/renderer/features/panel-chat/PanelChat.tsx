import { useCallback, useEffect, useMemo, useState } from "react";

type ChatMessage = {
  who: string;
  text: string;
};

type StoredMsg = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: string;
};

const STUB_SESSIONS = [
  {
    key: "A",
    sessionId: "chat-sess-a",
    label: "A @ /tmp/tick-a",
  },
  {
    key: "B",
    sessionId: "chat-sess-b",
    label: "B @ /tmp/tick-b",
  },
] as const;

function toBubbles(sessionKey: string, rows: StoredMsg[]): ChatMessage[] {
  return rows.map((m) => ({
    who:
      m.role === "user"
        ? `you · ${sessionKey}`
        : m.role === "assistant"
          ? `agent · ${sessionKey}`
          : `system · ${sessionKey}`,
    text: m.text,
  }));
}

/** Panel chat uses chat:* IPC with its own sessionId namespace (not CLI sessions). */
export function PanelChat() {
  const [activeKey, setActiveKey] =
    useState<(typeof STUB_SESSIONS)[number]["key"]>("A");
  const [histories, setHistories] = useState<Record<string, ChatMessage[]>>({});
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(
    () => STUB_SESSIONS.find((s) => s.key === activeKey) ?? STUB_SESSIONS[0],
    [activeKey],
  );

  const loadHistory = useCallback(async (sessionId: string, key: string) => {
    try {
      const rows = (await window.tick.chat.history(sessionId)) as StoredMsg[];
      setHistories((prev) => ({
        ...prev,
        [sessionId]: toBubbles(key, rows ?? []),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void loadHistory(active.sessionId, active.key);
  }, [active.sessionId, active.key, loadHistory]);

  const messages = histories[active.sessionId] ?? [];

  async function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    setText("");

    try {
      await window.tick.chat.send({
        sessionId: active.sessionId,
        text: trimmed,
      });
      await loadHistory(active.sessionId, active.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className="card" data-feature="panel-chat">
      <div className="meta-row">
        <span>Panel Chat · chat:* 分库隔离</span>
      </div>

      <div className="session-bar">
        <span className="session-label">session</span>
        {STUB_SESSIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`pill ${activeKey === s.key ? "active" : ""}`}
            onClick={() => setActiveKey(s.key)}
            title={`sessionId=${s.sessionId}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="stub session-id-note">
        当前 chat sessionId: <code>{active.sessionId}</code>
        {" · "}
        注：chat:* ≠ CLI / ai session · history 经 IPC 持久化
      </div>

      <div className="chat-log">
        {messages.length === 0 && (
          <div className="stub">此 session 暂无历史</div>
        )}
        {messages.map((m, i) => (
          <div key={`${active.sessionId}-${i}`} className="bubble">
            <div className="who">{m.who}</div>
            <div className="msg">{m.text}</div>
          </div>
        ))}
      </div>

      <div className="chat-compose">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="对当前 session 说话…"
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
          onClick={send}
          disabled={!text.trim()}
        >
          发送
        </button>
      </div>

      {error && <div className="error">{error}</div>}
    </section>
  );
}
