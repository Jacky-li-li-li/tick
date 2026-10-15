import { useEffect, useState } from "react";
import type { AiLaunchResult, AiTool, Todo } from "@tick/shared";

type Props = {
  /** Open todos for required todoId select on launch. */
  todos?: Todo[];
  /** After successful launch/resume, refresh so todo.ai can appear. */
  onRefresh?: () => void | Promise<void>;
};

type LaunchState = {
  toolId: string;
  sessionId: string;
  cwd: string;
  pid?: number;
  alive?: boolean;
  spawned?: boolean;
  resumed?: boolean;
  message?: string;
} | null;

export function AiPicker({ todos = [], onRefresh }: Props) {
  const [tools, setTools] = useState<AiTool[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [cwd, setCwd] = useState("");
  const [todoId, setTodoId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<LaunchState>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void window.tick.ai
      .listTools()
      .then((list) => {
        setTools(list);
        const first = list.find((t) => t.available) ?? list[0];
        if (first) setSelectedToolId(first.id);
      })
      .catch(() => setTools([]));
  }, []);

  function requireCwd(): string | null {
    const trimmed = cwd.trim();
    if (!trimmed) {
      setError("cwd 必选：未提供目录，拒绝 launch / resume");
      return null;
    }
    return trimmed;
  }

  function requireTodoId(): string | null {
    const id = todoId.trim();
    if (!id) {
      setError("todoId 必选：请选择要绑定的 Todo，拒绝 launch");
      return null;
    }
    return id;
  }

  async function applyResult(
    toolId: string,
    dir: string,
    result: AiLaunchResult,
  ) {
    let pid = result.pid;
    let alive = result.alive;

    // Preload exposes session.isAlive; prefer live probe when sessionId present.
    if (result.ok && result.sessionId && window.tick.session?.isAlive) {
      try {
        const probe = await window.tick.session.isAlive(result.sessionId);
        pid = probe.pid ?? pid;
        alive = probe.alive;
      } catch {
        // keep launch/resume pid/alive
      }
    }

    setStatus({
      toolId,
      sessionId: result.sessionId || "—",
      cwd: dir,
      pid,
      alive,
      spawned: result.spawned,
      resumed: result.resumed,
      message: result.message,
    });

    if (onRefresh) {
      await onRefresh();
    }
  }

  async function launch() {
    setError(null);
    const toolId = selectedToolId;
    if (!toolId) {
      setError("请先选择工具（ai:listTools）");
      return;
    }
    const dir = requireCwd();
    if (!dir) return;
    const boundTodoId = requireTodoId();
    if (!boundTodoId) return;

    setBusy(true);
    try {
      const result = await window.tick.ai.launch({
        toolId,
        cwd: dir,
        todoId: boundTodoId,
        prompt: "",
      });

      if (!result?.ok) {
        setError(result?.message ?? "launch 失败（ok=false）");
        if (result?.sessionId) {
          setStatus({
            toolId,
            sessionId: result.sessionId,
            cwd: dir,
            pid: result.pid,
            alive: result.alive,
            spawned: result.spawned,
            message: result.message,
          });
        }
        return;
      }

      await applyResult(toolId, dir, result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    setError(null);
    const toolId = selectedToolId ?? status?.toolId;
    if (!toolId) {
      setError("请先选择工具");
      return;
    }
    const dir = cwd.trim() || status?.cwd || null;
    if (!dir) {
      setError("cwd 必选：未提供目录，拒绝 resume");
      return;
    }
    if (!cwd.trim()) setCwd(dir);
    const sessionId = status?.sessionId;
    if (!sessionId || sessionId === "—") {
      setError("尚无 sessionId，请先 launch");
      return;
    }

    setBusy(true);
    try {
      const result = await window.tick.ai.resume({
        toolId,
        sessionId,
        cwd: dir,
      });

      if (!result?.ok) {
        setError(result?.message ?? "resume 失败（ok=false）");
        setStatus({
          toolId,
          sessionId: result?.sessionId ?? sessionId,
          cwd: dir,
          pid: result?.pid,
          alive: result?.alive,
          resumed: result?.resumed,
          message: result?.message,
        });
        return;
      }

      await applyResult(toolId, dir, result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const openTodos = todos.filter((t) => t.status === "open");
  const selectedTool = tools.find((t) => t.id === selectedToolId);

  return (
    <section className="card" data-feature="ai-picker">
      <div className="meta-row">
        <span>AI Tools · listTools / launch / resume（非供应商 picker）</span>
      </div>

      <div className="ai-grid">
        {tools.length === 0 && (
          <div className="stub">暂无工具（ai:listTools 空或不可用）</div>
        )}
        {tools.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tool-chip ${selectedToolId === t.id ? "selected" : ""}`}
            onClick={() => setSelectedToolId(t.id)}
            disabled={!t.available && tools.some((x) => x.available)}
            title="ai:listTools → tool（非模型供应商）"
          >
            <span className={`dot ${t.available ? "ok" : "off"}`} />
            <div>
              <div className="tool-name">{t.name}</div>
              <div className="tool-id">
                toolId: {t.id}
                {!t.available ? " · unavailable" : ""}
                {t.capabilities
                  ? ` · cwd:${t.capabilities.needsCwd ? "yes" : "no"} resume:${t.capabilities.resumeSession ? "yes" : "no"}`
                  : ""}
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedTool?.capabilities && (
        <div className="stub">
          capabilities: needsCwd={String(selectedTool.capabilities.needsCwd)} ·
          resumeSession={String(selectedTool.capabilities.resumeSession)} ·
          deliver={selectedTool.capabilities.deliverPrompt} · listSessions=
          {String(selectedTool.capabilities.listSessions)}
        </div>
      )}

      <div className="field">
        <label htmlFor="ai-cwd">工作目录 cwd *</label>
        <input
          id="ai-cwd"
          value={cwd}
          onChange={(e) => {
            setCwd(e.target.value);
            if (error) setError(null);
          }}
          placeholder="/tmp/tick-a（必选）"
        />
      </div>

      <div className="field">
        <label htmlFor="ai-todo">绑定 Todo *</label>
        <select
          id="ai-todo"
          value={todoId}
          onChange={(e) => {
            setTodoId(e.target.value);
            if (error) setError(null);
          }}
        >
          <option value="">— 请选择 Todo —</option>
          {openTodos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        {openTodos.length === 0 && (
          <div className="stub">暂无 open Todo，请先在 editor 添加</div>
        )}
      </div>

      <div className="ai-actions">
        <button
          className="primary sm"
          type="button"
          onClick={launch}
          disabled={busy || !selectedToolId}
        >
          launch
        </button>
        <button
          className="tiny"
          type="button"
          onClick={resume}
          disabled={busy || !status?.sessionId || status.sessionId === "—"}
        >
          resume
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="stub ai-status">
        session: {status?.sessionId ?? "—"} · cwd: {status?.cwd ?? "—"}
        {status?.toolId ? ` · tool: ${status.toolId}` : ""}
        {status?.pid != null ? ` · pid: ${status.pid}` : ""}
        {status?.alive != null ? ` · alive: ${String(status.alive)}` : ""}
        {status?.spawned != null ? ` · spawned: ${String(status.spawned)}` : ""}
        {status?.resumed != null ? ` · resumed: ${String(status.resumed)}` : ""}
        {status?.message ? ` · ${status.message}` : ""}
      </div>
    </section>
  );
}
