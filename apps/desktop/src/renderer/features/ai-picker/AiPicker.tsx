import { useEffect, useState } from "react";
import type { AiTool } from "@tick/shared";

export function AiPicker() {
  const [tools, setTools] = useState<AiTool[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void window.tick.ai.listTools().then(setTools).catch(() => setTools([]));
  }, []);

  async function launch(toolId: string) {
    const result = await window.tick.ai.launch({
      toolId,
      cwd: ".",
      prompt: "",
    });
    setMsg(result?.message ?? JSON.stringify(result));
  }

  return (
    <section className="card">
      <div className="meta-row">
        <span>AI Tools（P0 stub）</span>
      </div>
      {tools.map((t) => (
        <div key={t.id} className="todo-item">
          <div className="todo-title">
            {t.name} {!t.available ? "· unavailable" : ""}
          </div>
          <div />
          <button className="tiny" type="button" onClick={() => launch(t.id)}>
            launch
          </button>
        </div>
      ))}
      {msg && <div className="stub">{msg}</div>}
    </section>
  );
}
