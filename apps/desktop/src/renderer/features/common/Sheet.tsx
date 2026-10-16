import type { ReactNode } from "react";

type Props = {
  /** true = 顶部对齐的浮层（会话列表），默认底部 sheet */
  top?: boolean;
  onDismiss: () => void;
  children: ReactNode;
};

/** 弹层 = 遮罩 + 浮层；遮罩固定在浮层之下，避免内容透底 / 半露的重叠伪影。 */
export function Sheet({ top, onDismiss, children }: Props) {
  return (
    <>
      <div className="scrim" onClick={onDismiss} />
      <div className={top ? "sheet top" : "sheet"} role="dialog">
        {children}
      </div>
    </>
  );
}
