import type { Todo } from "@tick/shared";

/** 「今天 / 昨天 / N 天前 / M-D」 */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  return `${d.getMonth() + 1}-${d.getDate()}`;
}

/** 「…/Downloads/材料」 — 只留最后两段路径 */
export function shortCwd(cwd: string): string {
  const parts = cwd.split("/").filter(Boolean);
  if (parts.length <= 2) return cwd;
  return "…/" + parts.slice(-2).join("/");
}

type Props = {
  todos: Todo[];
  done: boolean;
  onToggle: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  /** 点竖条数字 → 会话列表 sheet */
  onSessions: (todo: Todo) => void;
};

/** 列表（帧 01 / 02）：勾选圈 + 标题 + 次要行 + 右侧竖条数字。 */
export function TodoList({ todos, done, onToggle, onEdit, onSessions }: Props) {
  if (todos.length === 0) {
    return (
      <div className="empty">
        {done ? (
          <>
            <b>还没有已完成的待办</b>
            <span>勾选左侧圆圈即可完成，完成只改本地状态</span>
          </>
        ) : (
          <>
            <b>还没有待办</b>
            <span>
              在下方输入标题，回车即可新建
              <br />
              新建后会立刻询问是否拉起 AI
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="list">
      {todos.map((todo) => {
        const count = (todo.ai ?? []).length;
        const meta = done
          ? dayLabel(todo.updatedAt)
          : todo.content || (count > 0 ? `${count} 个 AI 会话` : "未绑定 AI");
        return (
          <div key={todo.id} className={done ? "row done" : "row"}>
            <button
              className={done ? "tick on" : "tick"}
              type="button"
              aria-label={done ? "恢复为未完成" : "标记完成"}
              onClick={() => onToggle(todo)}
            >
              {done ? "✓" : ""}
            </button>
            <button
              className="row-main"
              type="button"
              onClick={() => onEdit(todo)}
              title="编辑待办"
            >
              <span className="row-title">{todo.title}</span>
              <span className="row-meta">{meta}</span>
            </button>
            {count > 0 && (
              <button
                className="stack"
                type="button"
                onClick={() => onSessions(todo)}
                title={`${count} 个 AI 会话`}
              >
                <i />
                <b>{count}</b>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
