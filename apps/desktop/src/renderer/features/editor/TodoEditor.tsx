import { useEffect, useState, type FormEvent } from "react";
import type { Todo } from "@tick/shared";

type Props = {
  onCreated: () => Promise<void>;
  /** When set, editor switches to edit mode with CTA「保存」. */
  editingTodo?: Todo | null;
  onSaved?: () => Promise<void>;
  onCancelEdit?: () => void;
};

export function TodoEditor({
  onCreated,
  editingTodo = null,
  onSaved,
  onCancelEdit,
}: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(editingTodo);

  useEffect(() => {
    if (editingTodo) {
      setTitle(editingTodo.title);
      setContent(editingTodo.content ?? "");
      setError(null);
    } else {
      setTitle("");
      setContent("");
    }
  }, [editingTodo]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      setError("标题必填");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isEdit && editingTodo) {
        await window.tick.todo.update({
          id: editingTodo.id,
          title: t,
          content: content.trim() || undefined,
        });
        setTitle("");
        setContent("");
        await onSaved?.();
      } else {
        await window.tick.todo.create({
          title: t,
          content: content.trim() || undefined,
        });
        setTitle("");
        setContent("");
        await onCreated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setTitle("");
    setContent("");
    setError(null);
    onCancelEdit?.();
  }

  return (
    <section className="card" data-feature="editor">
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="todo-title">
            {isEdit ? "编辑 Todo" : "新 Todo"} · 标题 *
          </label>
          <input
            id="todo-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="标题（必填）"
            autoFocus={!isEdit}
          />
        </div>
        <div className="field">
          <label htmlFor="todo-content">内容（选填）</label>
          <textarea
            id="todo-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="可选备注"
          />
        </div>
        {isEdit && editingTodo && (
          <div className="stub editor-readonly">
            status: {editingTodo.status}
            {editingTodo.ai
              ? ` · ai: ${editingTodo.ai.toolId} / ${editingTodo.ai.sessionId} / ${editingTodo.ai.cwd}`
              : ""}
          </div>
        )}
        <div className="editor-actions">
          {isEdit && (
            <button className="tiny" type="button" onClick={cancel}>
              取消
            </button>
          )}
          <button
            className="primary"
            type="submit"
            disabled={busy || !title.trim()}
          >
            {busy
              ? isEdit
                ? "保存中…"
                : "添加中…"
              : isEdit
                ? "保存"
                : "添加"}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </form>
    </section>
  );
}
