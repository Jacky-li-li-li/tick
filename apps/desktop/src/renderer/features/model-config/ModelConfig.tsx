import { useCallback, useEffect, useState } from "react";
import type { ModelStatus } from "@tick/shared";

type Note = { kind: "ok" | "err"; text: string };

export function ModelConfig() {
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [providerId, setProviderId] = useState("");
  const [modelId, setModelId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<"test" | "save" | null>(null);
  const [note, setNote] = useState<Note | null>(null);

  const refresh = useCallback(async () => {
    const s = await window.tick.model.status();
    setStatus(s);
    return s;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const s = await refresh();
        // Initial pick: current selection → first configured → deepseek.
        const preferred =
          s.selected?.provider ??
          s.providers.find((p) => p.configured)?.providerId ??
          s.providers.find((p) => p.providerId === "deepseek")?.providerId ??
          s.providers[0]?.providerId ??
          "";
        setProviderId(preferred);
        const provider = s.providers.find((p) => p.providerId === preferred);
        const preferredModel =
          (s.selected?.provider === preferred ? s.selected.modelId : "") ||
          provider?.models[0] ||
          "";
        setModelId(preferredModel);
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
  const hasAnyConfigured = status?.providers.some((p) => p.configured) ?? false;

  function onProviderChange(next: string) {
    setProviderId(next);
    setNote(null);
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
      setNote({
        kind: r.ok ? "ok" : "err",
        text: r.ok
          ? `${r.message}${r.latencyMs != null ? ` · ${r.latencyMs}ms` : ""}`
          : r.message,
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

  return (
    <section className="card" data-feature="model-config">
      <div className="meta-row">
        <span>模型配置 · pi-ai（与 pi CLI 共享 auth.json）</span>
      </div>

      {status && status.isFaux && !hasAnyConfigured && (
        <div className="stub">
          先配置 AI 模型：还没有可用的模型。为任意提供商填入 API Key
          后即可启用面板对话。
        </div>
      )}

      <div className="field">
        <label htmlFor="mc-provider">提供商</label>
        <select
          id="mc-provider"
          value={providerId}
          onChange={(e) => onProviderChange(e.target.value)}
        >
          {(status?.providers ?? []).map((p) => (
            <option key={p.providerId} value={p.providerId}>
              {p.providerId}
              {p.configured ? "（已配置）" : ""}
            </option>
          ))}
          {!status && <option value="">加载中…</option>}
        </select>
      </div>

      <div className="field">
        <label htmlFor="mc-model">模型</label>
        <select
          id="mc-model"
          value={modelId}
          onChange={(e) => {
            setModelId(e.target.value);
            if (note?.kind === "err") setNote(null);
          }}
        >
          {(provider?.models ?? []).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          {(provider?.models ?? []).length === 0 && (
            <option value="">（无可选模型）</option>
          )}
        </select>
      </div>

      <div className="field">
        <label htmlFor="mc-key">
          API Key{configuredNow ? "（已保存，输入可覆盖）" : ""}
        </label>
        <input
          id="mc-key"
          type="password"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            if (note?.kind === "err") setNote(null);
          }}
          placeholder={configuredNow ? "已保存 · 留空则不修改" : "sk-..."}
        />
      </div>

      <div className="editor-actions">
        <button
          className="tiny"
          type="button"
          onClick={doTest}
          disabled={busy !== null || !providerId}
        >
          {busy === "test" ? "测试中…" : "测试连接"}
        </button>
        <button
          className="primary sm"
          type="button"
          onClick={doSave}
          disabled={busy !== null || !providerId || !modelId}
        >
          {busy === "save" ? "保存中…" : "保存"}
        </button>
      </div>

      {note && (
        <div className={note.kind === "ok" ? "stub" : "error"}>{note.text}</div>
      )}

      {status && !status.isFaux && status.selected && (
        <div className="stub">
          当前生效：{status.selected.provider} / {status.selected.modelId}
        </div>
      )}
    </section>
  );
}
