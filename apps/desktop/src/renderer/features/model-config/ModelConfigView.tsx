import { ModelConfig } from "../model-config/ModelConfig";

/** 模型配置视图（07 帧）— 从标题栏菜单进入，独立覆盖主区。 */
export function ModelConfigView({ onClose }: { onClose: () => void }) {
  return (
    <div className="model-view">
      <div className="subheader">
        <button className="linkish" type="button" onClick={onClose}>
          ← 返回
        </button>
        <span className="subheader-title">模型配置</span>
      </div>
      <ModelConfig />
    </div>
  );
}
