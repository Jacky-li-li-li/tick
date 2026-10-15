import { useMemo, useState } from "react";

type ChatMessage = {
  who: string;
  text: string;
};

/** Stub sessions to demonstrate chat:* isolation (≠ CLI / ai session). */
const STUB_SESSIONS = [
  {
    key: "A",
    sessionId: "chat-sess-a",
    label: "A @ /tmp/tick-a",
    seed: [
      { who: "you · A", text: "帮我建一条「修 IPC 类型」todo" },
      { who: "agent · A", text: "已 create_todo → list 刷新（pi-durable）" },
    ] as ChatMessage[],
  },
  {
    key: "B",
    sessionId: "chat-sess-b",
    label: "B @ /tmp/tick-b",
    seed: [
      { who: "you · B", text: "这个 session 的历史应与 A 隔离" },
      { who: "agent · B", text: "chat:* 分库；≠ CLI sessionId" },
    ] as ChatMessage[],
  },
] as const;

/** Panel chat uses chat:* IPC with its own sessionId namespace (not CLI sessions). */
export function PanelChat() {
  const [activeKey, setActiveKey] =
    useState<(typeof STUB_SESSIONS)[number]["key"]>("A");
  const [histories, setHistories] = useState<Record<string, ChatMessage[]>>(
    () =>
      Object.fromEntries(STUB_SESSIONS.map((s) => [s.sessionId, [...s.seed]])),
  );
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(
    () => STUB_SESSIONS.find((s) => s.key === activeKey) ?? STUB_SESSIONS[0],
    [activeKey],
  );

  const messages = histories[active.sessionId] ?? [];

  async function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);

    const youMsg: ChatMessage = {
      who: `you · ${active.key}`,
      text: trimmed,
    };
    setHistories((prev) => ({
      ...prev,
      [active.sessionId]: [...(prev[active.sessionId] ?? []), youMsg],
    }));
    setText("");

    try {
      const result = (await window.tick.chat.send({
        sessionId: active.sessionId,
        text: trimmed,
      })) as { message?: string } | undefined;

      const reply: ChatMessage = {
        who: `agent · ${active.key}`,
        text: result?.message ?? "sent (stub) · chat:* ≠ CLI session",
      };
      setHistories((prev) => ({
        ...prev,
        [active.sessionId]: [...(prev[active.sessionId] ?? []), reply],
      }));
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
        注：chat:* ≠ CLI / ai session
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
