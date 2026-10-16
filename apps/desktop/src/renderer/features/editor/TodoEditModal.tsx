import { useState } from "react";
import type { Todo } from "@tick/shared";

type Props = {
  todo: Todo;
  onClose: () => void;
  /** Called after save or delete succeeded (parent refreshes + closes). */
  onChanged: () => void | Promise<void>;
};

/** 编辑弹层（13 帧）：标题 / 内容 / 删除 / 取消 / 保存. */
export function TodoEditModal({ todo, onClose, onChanged }: Props) {
  const [title, setTitle] = useState(todo.title);
  const [content, setContent] = useState(todo.content ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aiList = todo.ai ?? [];

  async function save() {
    const t = title.trim();
    if (!t) {
      setError("标题必填");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await window.tick.todo.update({
        id: todo.id,
        title: t,
        content: content.trim() || undefined,
      });
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await window.tick.todo.delete(todo.id);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">编辑待办</div>

        <div className="field">
          <label htmlFor="edit-title">标题 *</label>
          <input
            id="edit-title"
            value={title}
            autoFocus
            disabled={busy}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError(null);
            }}
          />
        </div>

        <div className="field">
          <label htmlFor="edit-content">内容（选填）</label>
          <textarea
            id="edit-content"
            value={content}
            disabled={busy}
            placeholder="可选备注"
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div className="stub">
          status: {todo.status}
          {aiList.length > 0
            ? ` · ${aiList.length} 个 AI 会话（在列表中展开查看）`
            : ""}
        </div>

        <div className="modal-actions">
          <button
            className="tiny danger"
            type="button"
            onClick={() => void remove()}
            disabled={busy}
          >
            删除
          </button>
          <div className="grow" />
          <button className="tiny" type="button" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button
            className="primary sm"
            type="button"
            onClick={() => void save()}
            disabled={busy || !title.trim()}
          >
            {busy ? "保存中…" : "保存"}
          </button>
        </div>

        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
