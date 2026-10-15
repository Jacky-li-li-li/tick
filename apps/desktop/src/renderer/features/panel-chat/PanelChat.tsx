import { useState } from "react";

/** Panel chat uses chat:* IPC with its own sessionId namespace (not CLI sessions). */
export function PanelChat() {
  const [text, setText] = useState("");
  const [note, setNote] = useState("chat:* reserved — stub in P0");

  async function send() {
    const result = await window.tick.chat.send({
      sessionId: "panel-chat-stub",
      text,
    });
    setNote(result?.message ?? "sent (stub)");
    setText("");
  }

  return (
    <section className="card">
      <div className="meta-row">
        <span>Panel Chat（stub）</span>
      </div>
      <div className="field">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="chat:send 占位"
        />
      </div>
      <button className="tiny" type="button" onClick={send} disabled={!text.trim()}>
        发送
      </button>
      <div className="stub" style={{ marginTop: 8 }}>
        {note}
      </div>
    </section>
  );
}
