import { useState, type FormEvent } from "react";

type Props = {
  onCreated: () => Promise<void>;
};

export function TodoEditor({ onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await window.tick.todo.create({
        title: t,
        content: content.trim() || undefined,
      });
      setTitle("");
      setContent("");
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="todo-title">新 Todo</label>
          <input
            id="todo-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="标题（必填）"
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="todo-content">内容</label>
          <textarea
            id="todo-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="可选备注"
          />
        </div>
        <button className="primary" type="submit" disabled={busy || !title.trim()}>
          {busy ? "添加中…" : "添加"}
        </button>
        {error && <div className="error">{error}</div>}
      </form>
    </section>
  );
}
