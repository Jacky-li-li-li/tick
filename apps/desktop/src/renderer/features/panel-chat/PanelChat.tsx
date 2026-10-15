import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChatHistoryItem } from "@tick/shared";

type ChatMessage = {
  who: string;
  text: string;
};

const SESSIONS = [
  {
    key: "A",
    sessionId: "chat-sess-a",
    label: "A",
  },
  {
    key: "B",
    sessionId: "chat-sess-b",
    label: "B",
  },
] as const;

function toBubbles(
  sessionKey: string,
  items: ChatHistoryItem[],
): ChatMessage[] {
  return items.map((m) => ({
    who: `${m.who} · ${sessionKey}`,
    text: m.text,
  }));
}

/** Panel chat uses chat:* IPC + ChatAgentHost (pi-durable); ≠ CLI sessions. */
export function PanelChat() {
  const [activeKey, setActiveKey] =
    useState<(typeof SESSIONS)[number]["key"]>("A");
  const [histories, setHistories] = useState<Record<string, ChatMessage[]>>(
    {},
  );
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const active = useMemo(
    () => SESSIONS.find((s) => s.key === activeKey) ?? SESSIONS[0],
    [activeKey],
  );

  const refresh = useCallback(async (sessionId: string, key: string) => {
    try {
      const res = await window.tick.chat.history({ sessionId });
      setHistories((prev) => ({
        ...prev,
        [sessionId]: toBubbles(key, res.history ?? []),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh(active.sessionId, active.key);
  }, [active.sessionId, active.key, refresh]);

  const messages = histories[active.sessionId] ?? [];

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setError(null);
    setBusy(true);
    setText("");
    try {
      const result = await window.tick.chat.send({
        sessionId: active.sessionId,
        text: trimmed,
      });
      setHistories((prev) => ({
        ...prev,
        [active.sessionId]: toBubbles(
          active.key,
          result.history ?? [
            { who: "you", text: trimmed },
            { who: "agent", text: result.message },
          ],
        ),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await refresh(active.sessionId, active.key);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" data-feature="panel-chat">
      <div className="meta-row">
        <span>Panel Chat · pi-durable · chat:* 分库</span>
      </div>

      <div className="session-bar">
        <span className="session-label">session</span>
        {SESSIONS.map((s) => (
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
        chat sessionId: <code>{active.sessionId}</code>
        {" · "}≠ CLI / ai session
      </div>

      <div className="chat-log">
        {messages.length === 0 && (
          <div className="stub">此 session 暂无历史（可试：建一条「修 IPC」todo）</div>
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
          onClick={send}
          disabled={!text.trim() || busy}
        >
          {busy ? "…" : "发送"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}
    </section>
  );
}
