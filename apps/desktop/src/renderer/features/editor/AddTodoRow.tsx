import { useState } from "react";
import type { Todo } from "@tick/shared";

type Props = {
  /** Called with the created todo (after refresh) — e.g. to open the bind wizard. */
  onCreated: (todo: Todo) => void;
};

/** 「＋ 添加待办 · 回车确认」 row (01/02 帧). */
export function AddTodoRow({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    setError(null);
    try {
      const todo = await window.tick.todo.create({ title: t });
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
        <button className="add-btn" type="button" onClick={() => setOpen(true)}>
          ＋ 添加待办
        </button>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
