import { useEffect, useState } from "react";
import type { AiTool, Todo } from "@tick/shared";

type Step = "pick" | "cwd" | "launching" | "done" | "error";

type Props = {
  todo: Todo;
  /** Close + refresh (called automatically 3s after success). */
  onClose: () => void;
};

function toolHint(tool: AiTool): string {
  return tool.capabilities?.deliverPrompt === "clipboard"
    ? "CLI · 剪贴板投递"
    : tool.id;
}

/** 绑定 AI 向导（09-11 帧）：选 AI → 确认 cwd → 启动成功。 */
export function BindWizard({ todo, onClose }: Props) {
  const [step, setStep] = useState<Step>("pick");
  const [tools, setTools] = useState<AiTool[]>([]);
  const [toolId, setToolId] = useState<string | null>(null);
  const [cwd, setCwd] = useState("");
  const [message, setMessage] = useState("");
  const [clipboardOk, setClipboardOk] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    void window.tick.ai
      .listTools()
      .then((list) => {
        setTools(list);
        const first = list.find((t) => t.available);
        setToolId((cur) => cur ?? first?.id ?? null);
      })
      .catch(() => setTools([]));
  }, []);

  const selected = tools.find((t) => t.id === toolId);

  async function pickDirectory() {
    try {
      const picked = await window.tick.dialog.pickDirectory({
        defaultPath: cwd.trim() || undefined,
      });
      if (picked) setCwd(picked);
    } catch {
      // ignore — user can type the path manually
    }
  }

  async function launch() {
    if (!toolId || !cwd.trim()) return;
    setStep("launching");
    setMessage("");
    try {
      const result = await window.tick.ai.launch({
        toolId,
        cwd: cwd.trim(),
        todoId: todo.id,
      });
      if (!result?.ok) {
        setMessage(result?.message ?? "launch 失败（ok=false）");
        setStep("error");
        return;
      }
      setClipboardOk(result.clipboard);
      setStep("done");
      window.setTimeout(onClose, 3000); // 11 帧：3 秒自动关闭
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
      setStep("error");
    }
  }

  const dismissable = step === "pick" || step === "done" || step === "error";

  return (
    <div
      className="modal-backdrop"
      onClick={dismissable ? onClose : undefined}
    >
      <div
        className="modal wizard"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        {step === "pick" && (
          <>
            <div className="modal-title">为「{todo.title}」选 AI</div>
            <div className="stub">仅显示本机已检测到的工具</div>
            <div className="tool-list">
              {tools.length === 0 && (
                <div className="stub">未检测到可用工具</div>
              )}
              {tools.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={!t.available}
                  className={`tool-row ${toolId === t.id ? "selected" : ""}`}
                  onClick={() => setToolId(t.id)}
                >
                  <span className={`dot ${t.available ? "ok" : "off"}`} />
                  <span className="tool-row-main">
                    <span className="tool-row-name">{t.name}</span>
                    <span className="tool-row-id">{toolHint(t)}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="tiny" type="button" onClick={onClose}>
                跳过，稍后再绑
              </button>
              <div className="grow" />
              <button
                className="primary sm"
                type="button"
                disabled={!selected}
                onClick={() => setStep("cwd")}
              >
                下一步
              </button>
            </div>
          </>
        )}

        {step === "cwd" && (
          <>
            <div className="modal-title">启动 {toolId}</div>
            <div className="stub">将固定「{todo.title}」· cwd 必填</div>
            <div className="field">
              <label htmlFor="wizard-cwd">工作目录</label>
              <div className="cwd-row">
                <input
                  id="wizard-cwd"
                  value={cwd}
                  autoFocus
                  onChange={(e) => setCwd(e.target.value)}
                  placeholder="点击「选择」或粘贴绝对路径"
                />
                <button className="tiny" type="button" onClick={() => void pickDirectory()}>
                  选择…
                </button>
              </div>
            </div>
            <div className="modal-actions">
              <button className="tiny" type="button" onClick={() => setStep("pick")}>
                返回
              </button>
              <div className="grow" />
              <button
                className="primary sm"
                type="button"
                disabled={!cwd.trim()}
                onClick={() => void launch()}
              >
                启动
              </button>
            </div>
          </>
        )}

        {step === "launching" && (
          <div className="wizard-center">
            <div className="stub">正在拉起 {toolId}…</div>
          </div>
        )}

        {step === "done" && (
          <div className="wizard-center">
            <div className="wizard-check">✓</div>
            <div className="modal-title">已绑定 {toolId}</div>
            <div className="stub">
              {clipboardOk === false
                ? "剪贴板写入失败，请手动复制文案"
                : "文案已复制，到会话里粘贴即可"}
              {" · 3 秒后自动关闭"}
            </div>
          </div>
        )}

        {step === "error" && (
          <>
            <div className="modal-title">启动失败</div>
            <div className="error">{message}</div>
            <div className="modal-actions">
              <button className="tiny" type="button" onClick={() => setStep("cwd")}>
                返回
              </button>
              <div className="grow" />
              <button className="tiny" type="button" onClick={onClose}>
                关闭
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
