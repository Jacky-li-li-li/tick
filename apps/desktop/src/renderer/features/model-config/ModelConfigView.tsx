import { ModelConfig } from "./ModelConfig";

/** 模型配置视图（帧 07 / 18）：整页视图，只出现一个标题。 */
export function ModelConfigView({ onClose }: { onClose: () => void }) {
  return (
    <div className="view">
      <div className="vhead">
        <button className="linkish" type="button" onClick={onClose}>
          ← 返回
        </button>
        <span className="vhead-title">模型配置</span>
        <span className="vhead-spacer" />
      </div>
      <ModelConfig />
    </div>
  );
}
