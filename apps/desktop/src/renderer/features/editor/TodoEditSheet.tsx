import { useState } from "react";
import type { Todo } from "@tick/shared";
import { Sheet } from "../common/Sheet";

type Props = {
  todo: Todo;
  onClose: () => void;
  /** 保存 / 删除成功后回调（父级刷新并关闭） */
  onChanged: () => void | Promise<void>;
};

/** 编辑待办 sheet（帧 13 / 19）：标题 * · 内容（选填）· 删除 / 取消 / 保存 */
export function TodoEditSheet({ todo, onClose, onChanged }: Props) {
  const [title, setTitle] = useState(todo.title);
  const [content, setContent] = useState(todo.content ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = (todo.ai ?? []).length;

  async function save() {
    const next = title.trim();
    if (!next) {
      setError("标题必填");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await window.tick.todo.update({
        id: todo.id,
        title: next,
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
    <Sheet onDismiss={onClose}>
      <h3>编辑待办</h3>
      <div className="sheet-sub">
        {todo.status === "done" ? "已完成" : "未完成"}
        {count > 0 ? ` · ${count} 个 AI 会话（点列表竖条数字查看）` : ""}
      </div>

      {error && <div className="error" style={{ marginBottom: 11 }}>{error}</div>}

      <div className="field" style={{ marginBottom: 11 }}>
        <label htmlFor="edit-title">标题 *</label>
        <input
          id="edit-title"
          className="ctl"
          value={title}
          autoFocus
          disabled={busy}
          placeholder="写点什么…"
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError(null);
          }}
        />
      </div>

      <div className="field" style={{ marginBottom: 14 }}>
        <label htmlFor="edit-content">内容（选填）</label>
        <textarea
          id="edit-content"
          className="ctl"
          value={content}
          disabled={busy}
          placeholder="可选备注"
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      <div className="btns">
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
          className="primary"
          type="button"
          onClick={() => void save()}
          disabled={busy || !title.trim()}
        >
          {busy ? "保存中…" : "保存"}
        </button>
      </div>
    </Sheet>
  );
}
