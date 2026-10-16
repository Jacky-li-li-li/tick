import { useCallback, useEffect, useState } from "react";
import type { ModelStatus } from "@tick/shared";

type Note = { kind: "ok" | "err"; text: string };
type TestState = "idle" | "ok" | "err";

/** 模型选择器一次最多渲染多少行（目录可能有 400 个模型，靠搜索定位） */
const MODEL_ROWS = 60;

/** 模型配置正文（帧 07 / 18）：供应商 / 模型（可搜索）/ API Key（可清除）/ 测试连接 / 保存。 */
export function ModelConfig() {
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [providerId, setProviderId] = useState("");
  const [modelId, setModelId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<"test" | "save" | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [testState, setTestState] = useState<TestState>("idle");
  const [picking, setPicking] = useState<"provider" | "model" | null>(null);
  const [modelQuery, setModelQuery] = useState("");
  const [armClear, setArmClear] = useState(false);

  const refresh = useCallback(async () => {
    const s = await window.tick.model.status();
    setStatus(s);
    return s;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const s = await refresh();
        // 初始选择：当前生效 → 第一个已配置 → deepseek
        const preferred =
          s.selected?.provider ??
          s.providers.find((p) => p.configured)?.providerId ??
          s.providers.find((p) => p.providerId === "deepseek")?.providerId ??
          s.providers[0]?.providerId ??
          "";
        setProviderId(preferred);
        const provider = s.providers.find((p) => p.providerId === preferred);
        setModelId(
          (s.selected?.provider === preferred ? s.selected.modelId : "") ||
            provider?.models[0] ||
            "",
        );
      } catch (e) {
        setNote({
          kind: "err",
          text: e instanceof Error ? e.message : String(e),
        });
      }
    })();
  }, [refresh]);

  const provider = status?.providers.find((p) => p.providerId === providerId);
  const configuredNow = provider?.configured ?? false;
  const models = provider?.models ?? [];
  const query = modelQuery.trim().toLowerCase();
  const matched = query
    ? models.filter((m) => m.toLowerCase().includes(query))
    : models;
  const shown = matched.slice(0, MODEL_ROWS);

  function pickProvider(next: string) {
    setProviderId(next);
    setPicking(null);
    setModelQuery("");
    setArmClear(false);
    setNote(null);
    setTestState("idle");
    const p = status?.providers.find((x) => x.providerId === next);
    setModelId(p?.models[0] ?? "");
  }

  async function doTest() {
    if (!providerId) return;
    setBusy("test");
    setNote(null);
    try {
      const r = await window.tick.model.test({
        providerId,
        apiKey: apiKey.trim() || undefined,
        modelId: modelId || undefined,
      });
      setTestState(r.ok ? "ok" : "err");
      setNote({
        kind: r.ok ? "ok" : "err",
        text: r.ok
          ? `${r.message}${r.latencyMs != null ? ` · ${r.latencyMs}ms` : ""}`
          : r.message,
      });
    } catch (e) {
      setTestState("err");
      setNote({
        kind: "err",
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(null);
    }
  }

  async function doSave() {
    if (!providerId || !modelId) return;
    if (!configuredNow && !apiKey.trim()) {
      setNote({ kind: "err", text: "请先填写 API Key（可先测试连接）" });
      return;
    }
    setBusy("save");
    setNote(null);
    try {
      if (apiKey.trim()) {
        await window.tick.model.saveKey({ providerId, apiKey: apiKey.trim() });
        setApiKey("");
      }
      const s = await window.tick.model.setSelected({
        provider: providerId,
        modelId,
      });
      setStatus(s);
      setNote({
        kind: "ok",
        text: s.isFaux
          ? "已保存，但仍未检测到可用凭据"
          : `已保存 · 面板对话将使用 ${s.selected?.provider}/${s.selected?.modelId}`,
      });
    } catch (e) {
      setNote({
        kind: "err",
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(null);
    }
  }

  async function doClear() {
    if (!providerId) return;
    setBusy("save");
    setNote(null);
    try {
      const s = await window.tick.model.clearKey(providerId);
      setStatus(s);
      setApiKey("");
      setArmClear(false);
      setTestState("idle");
      setNote({
        kind: "ok",
        text: `已清除 ${providerId} 的 Key${
          s.isFaux ? "，面板对话回落到 faux" : ""
        }`,
      });
    } catch (e) {
      setNote({
        kind: "err",
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={picking ? "vbody picking" : "vbody"}>
      <div className="field">
        <label htmlFor="mc-provider">供应商</label>
        <button
          id="mc-provider"
          className="ctl"
          type="button"
          aria-expanded={picking === "provider"}
          onClick={() => setPicking(picking === "provider" ? null : "provider")}
        >
          <span>{providerId || "加载中…"}</span>
          <span className="side">›</span>
        </button>
        {picking === "provider" && (
          <div className="picker">
            {(status?.providers ?? []).map((p) => (
              <button
                key={p.providerId}
                type="button"
                className={p.providerId === providerId ? "on" : ""}
                onClick={() => pickProvider(p.providerId)}
              >
                <span>
                  {p.providerId}
                  {p.configured ? "（已配置）" : ""}
                </span>
                <span>{p.providerId === providerId ? "✓" : ""}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="mc-model">模型</label>
        <button
          id="mc-model"
          className="ctl"
          type="button"
          aria-expanded={picking === "model"}
          onClick={() => {
            setPicking(picking === "model" ? null : "model");
            setModelQuery("");
          }}
        >
          <span>{modelId || "（可选模型为空）"}</span>
          <span className="side">{models.length > 0 ? `${models.length} ›` : "›"}</span>
        </button>
        {picking === "model" && (
          <div className="picker">
            {models.length > 0 && (
              <input
                className="picker-search"
                value={modelQuery}
                autoFocus
                placeholder={`搜索 ${models.length} 个模型…`}
                onChange={(e) => setModelQuery(e.target.value)}
              />
            )}
            {shown.map((m) => (
              <button
                key={m}
                type="button"
                className={m === modelId ? "on" : ""}
                onClick={() => {
                  setModelId(m);
                  setPicking(null);
                  setModelQuery("");
                  setArmClear(false);
                  setTestState("idle");
                  if (note?.kind === "err") setNote(null);
                }}
              >
                <span className="mono-cell">{m}</span>
                <span>{m === modelId ? "✓" : ""}</span>
              </button>
            ))}
            {matched.length > shown.length && (
              <div className="stub" style={{ padding: "6px 10px" }}>
                还有 {matched.length - shown.length} 个，输入关键词缩小范围
              </div>
            )}
            {matched.length === 0 && (
              <div className="stub" style={{ padding: "8px 10px" }}>
                {models.length === 0
                  ? `${providerId} 没有静态模型目录（动态目录），Tick 里暂时选不了模型`
                  : "没有匹配的模型"}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="mc-key">API Key</label>
        <div className="ctl mono">
          <input
            id="mc-key"
            type="password"
            value={apiKey}
            disabled={busy !== null}
            onChange={(e) => {
              setApiKey(e.target.value);
              setArmClear(false);
              setTestState("idle");
              if (note?.kind === "err") setNote(null);
            }}
            placeholder={configuredNow ? "已保存 · 留空则不修改" : "sk-..."}
          />
          {configuredNow ? (
            <button
              className="linkish action"
              type="button"
              disabled={busy !== null}
              title={`删除已保存在 pi auth.json 里的 ${providerId} Key`}
              onClick={() => {
                if (!armClear) {
                  setArmClear(true);
                  setNote({
                    kind: "err",
                    text: `再点一次「清除」即删除 ${providerId} 已保存的 Key`,
                  });
                  return;
                }
                void doClear();
              }}
            >
              {armClear ? "确认清除" : "清除"}
            </button>
          ) : (
            <span className="side">去填写</span>
          )}
        </div>
      </div>

      <div className="field">
        <label htmlFor="mc-test">连接</label>
        <button
          id="mc-test"
          className="ctl"
          type="button"
          disabled={busy !== null || !providerId}
          onClick={() => void doTest()}
        >
          <span>{busy === "test" ? "测试连接中…" : "测试连接"}</span>
          <span className="side">
            {busy === "test"
              ? "…"
              : testState === "ok"
                ? "正常"
                : testState === "err"
                  ? "失败"
                  : "未测试"}
          </span>
        </button>
      </div>

      <div className="note">
        Key 只存在本机（与 pi CLI 共享 auth.json），不经我们的服务器。
        {status && !status.isFaux && status.selected
          ? ` 当前生效：${status.selected.provider}/${status.selected.modelId}。`
          : ""}
      </div>

      {note && (
        <div className={note.kind === "ok" ? "stub" : "error"}>{note.text}</div>
      )}

      <div className="btns" style={{ marginTop: "auto" }}>
        <div className="grow" />
        <button
          className="primary"
          type="button"
          onClick={() => void doSave()}
          disabled={busy !== null || !providerId || !modelId}
        >
          {busy === "save" ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}
