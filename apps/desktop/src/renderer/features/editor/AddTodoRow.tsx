import { useState } from "react";
import type { Todo } from "@tick/shared";

type Props = {
  /** 创建成功后回调（父级刷新并进入绑 AI） */
  onCreated: (todo: Todo) => void;
  /** 列表为空时高亮这一行（帧 14） */
  guide?: boolean;
};

/** 底部单行添加（帧 01 / 02 / 14）：按钮 → 输入框，回车确认、Esc 取消。 */
export function AddTodoRow({ onCreated, guide }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const next = title.trim();
    if (!next || busy) return;
    setBusy(true);
    setError(null);
    try {
      const todo = await window.tick.todo.create({ title: next });
      setTitle("");
      setOpen(false);
      onCreated(todo);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="add">
      <div className="add-row">
        {open ? (
          <input
            autoFocus
            value={title}
            placeholder="新待办标题 · 回车确认 · Esc 取消"
            disabled={busy}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
              if (e.key === "Escape") {
                setOpen(false);
                setTitle("");
              }
            }}
          />
        ) : (
          <button
            className={guide ? "add-btn guide" : "add-btn"}
            type="button"
            onClick={() => setOpen(true)}
          >
            ＋ 添加待办 · 回车确认
          </button>
        )}
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
