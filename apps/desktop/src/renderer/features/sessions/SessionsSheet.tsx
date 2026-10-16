import { useState } from "react";
import type { Todo, TodoAiMeta } from "@tick/shared";
import { Sheet } from "../common/Sheet";
import { dayLabel, shortCwd } from "../list/TodoList";

type Props = {
  todo: Todo;
  onClose: () => void;
  /** 「＋ 再绑一个 AI」→ 父级打开绑定向导 */
  onRebind: (todo: Todo) => void;
};

/** 会话列表 sheet（帧 12 / 17）：一条 todo 的多工具 / 多会话，点会话在 Terminal 打开。 */
export function SessionsSheet({ todo, onClose, onRebind }: Props) {
  const list = todo.ai ?? [];
  const [busyId, setBusyId] = useState<string | null>(null);
  const [okId, setOkId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  async function resume(meta: TodoAiMeta) {
    setError(null);
    setOkId(null);
    setBusyId(meta.sessionId);
    try {
      const result = await window.tick.ai.resume({
        toolId: meta.toolId,
        sessionId: meta.sessionId,
        cwd: meta.cwd,
      });
      if (!result?.ok) {
        setError({
          id: meta.sessionId,
          message: result?.message ?? "resume 失败（ok=false）",
        });
        return;
      }
      setOkId(meta.sessionId);
    } catch (e) {
      setError({
        id: meta.sessionId,
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Sheet onDismiss={onClose}>
      <h3>{todo.title} · 会话</h3>
      <div className="sheet-sub">
        点会话在 Terminal 打开（pi --session）· 可同时绑多个工具
      </div>

      {error && <div className="error" style={{ marginBottom: 11 }}>{error.message}</div>}

      {list.map((meta) => {
        const busy = busyId === meta.sessionId;
        const bad = error?.id === meta.sessionId;
        const ok = okId === meta.sessionId;
        return (
          <button
            key={meta.sessionId}
            className="si"
            type="button"
            title="在 Terminal 打开该会话"
            disabled={busy}
            onClick={() => void resume(meta)}
          >
            <span className={bad ? "dot bad" : busy ? "dot busy" : "dot"} />
            <span className="si-body">
              <span className="si-name">
                {meta.toolId} · {meta.sessionId.slice(0, 13)}…
              </span>
              <span className="si-meta">
                {shortCwd(meta.cwd)}
                {meta.boundAt ? ` · ${dayLabel(meta.boundAt)}` : ""}
              </span>
            </span>
            <span className="si-go">
              {busy ? "打开中…" : ok ? "已在 Terminal 打开" : "打开 ›"}
            </span>
          </button>
        );
      })}

      {list.length === 0 && <div className="stub" style={{ marginBottom: 11 }}>尚未绑定 AI 会话</div>}

      <button className="si add" type="button" onClick={() => onRebind(todo)}>
        ＋ 再绑一个 AI
      </button>
    </Sheet>
  );
}
