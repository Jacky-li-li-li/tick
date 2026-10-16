import { useEffect, useState } from "react";
import type { AiTool, Todo } from "@tick/shared";
import { Sheet } from "../common/Sheet";

type Step = "pick" | "cwd" | "launching" | "done" | "error";

type Props = {
  todo: Todo;
  /** 关闭并刷新（成功页 3 秒后自动调用） */
  onClose: () => void;
};

function toolHint(tool: AiTool): string {
  const deliver =
    tool.capabilities?.deliverPrompt === "clipboard" ? "剪贴板投递" : tool.id;
  return `CLI · ${deliver} · 已检测`;
}

/** 绑定 AI 向导（帧 09 / 10 / 15 / 11 / 16）：选 AI → 确认 cwd → 启动 → 成功 / 失败。 */
export function BindWizard({ todo, onClose }: Props) {
  const [step, setStep] = useState<Step>("pick");
  const [tools, setTools] = useState<AiTool[]>([]);
  const [toolId, setToolId] = useState<string | null>(null);
  const [cwd, setCwd] = useState("");
  const [message, setMessage] = useState("");
  const [clipboardOk, setClipboardOk] = useState<boolean | undefined>(undefined);
  const [ringRun, setRingRun] = useState(false);

  useEffect(() => {
    void window.tick.ai
      .listTools()
      .then((list) => {
        const available = list.filter((t) => t.available);
        setTools(available);
        setToolId((cur) => cur ?? available[0]?.id ?? null);
      })
      .catch(() => setTools([]));
  }, []);

  const selected = tools.find((t) => t.id === toolId);
  const dismissable = step === "pick" || step === "done" || step === "error";

  async function pickDirectory() {
    try {
      const picked = await window.tick.dialog.pickDirectory({
        defaultPath: cwd.trim() || undefined,
      });
      if (picked) setCwd(picked);
    } catch {
      // 用户可以直接手填路径
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
      setRingRun(true);
      window.setTimeout(onClose, 3000); // 帧 11：3 秒环走满后自动关闭
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
      setStep("error");
    }
  }

  return (
    <Sheet onDismiss={dismissable ? onClose : () => undefined}>
      {step === "pick" && (
        <>
          <h3>为「{todo.title}」选 AI</h3>
          <div className="sheet-sub">仅展示本机已检测到的工具（未安装不展示）</div>
          {tools.length === 0 && <div className="stub" style={{ marginBottom: 11 }}>未检测到可用工具</div>}
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={toolId === tool.id ? "si selected" : "si"}
              onClick={() => setToolId(tool.id)}
            >
              <span className="dot" />
              <span className="si-body">
                <span className="si-name">{tool.name}</span>
                <span className="si-meta">{toolHint(tool)}</span>
              </span>
              <span className="si-go">{toolId === tool.id ? "已选 ✓" : "选择"}</span>
            </button>
          ))}
          <div className="btns" style={{ marginTop: 11 }}>
            <button className="tiny" type="button" onClick={onClose}>
              跳过，稍后再绑
            </button>
            <div className="grow" />
            <button
              className="primary"
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
          <h3>启动 {toolId}</h3>
          <div className="sheet-sub">
            绑定到「{todo.title}」· cwd 必填，文案会写入剪贴板
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="wizard-cwd">工作目录</label>
            <div className="cwd">
              <input
                id="wizard-cwd"
                value={cwd}
                autoFocus
                onChange={(e) => setCwd(e.target.value)}
                placeholder="粘贴绝对路径"
              />
              <button className="tiny" type="button" onClick={() => void pickDirectory()}>
                选择…
              </button>
            </div>
          </div>
          <div className="btns">
            <button className="tiny" type="button" onClick={() => setStep("pick")}>
              返回
            </button>
            <div className="grow" />
            <button
              className="primary"
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
        <div className="wiz">
          <div className="spin" />
          <h3>正在拉起 {toolId}…</h3>
          <div className="stub">会在 Terminal 里打开会话</div>
        </div>
      )}

      {step === "done" && (
        <div className="wiz">
          <div className={ringRun ? "ring run" : "ring"} />
          <h3>已绑定 {toolId}</h3>
          <div className="stub">
            {clipboardOk === false
              ? "剪贴板写入失败，请手动复制文案"
              : "文案已复制，到会话里粘贴即可"}
            <br />
            3 秒后自动关闭
          </div>
        </div>
      )}

      {step === "error" && (
        <>
          <h3>启动失败</h3>
          <div className="sheet-sub">按实际报错展示，可返回重试</div>
          <div className="error" style={{ marginBottom: 11 }}>{message}</div>
          <div className="btns">
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
    </Sheet>
  );
}
