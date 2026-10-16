import type { UpdateState } from "@tick/shared";
import { Sheet } from "../common/Sheet";

type Props = {
  state: UpdateState | null;
  onCheck: () => void;
  onDownload: () => void;
  onInstall: () => void;
  onClose: () => void;
};

type Actions = Pick<Props, "onCheck" | "onDownload" | "onInstall">;

type View = {
  line: string;
  isError: boolean;
  /** 仅 downloading 有值，用于进度条 */
  percent: number | null;
  button: { label: string; disabled: boolean; onClick: () => void };
};

/** 把状态机翻译成「一行状态 + 一个主按钮」，避免在 JSX 里散落条件。 */
function describe(state: UpdateState | null, handlers: Actions): View {
  const { onCheck, onDownload, onInstall } = handlers;
  if (!state) {
    return {
      line: "正在读取状态…",
      isError: false,
      percent: null,
      button: { label: "检查更新", disabled: true, onClick: onCheck },
    };
  }
  switch (state.status) {
    case "idle":
      return {
        line: "还没检查过",
        isError: false,
        percent: null,
        button: { label: "检查更新", disabled: false, onClick: onCheck },
      };
    case "checking":
      return {
        line: "正在检查…",
        isError: false,
        percent: null,
        button: { label: "检查更新", disabled: true, onClick: onCheck },
      };
    case "up-to-date":
      return {
        line: "已是最新版本",
        isError: false,
        percent: null,
        button: { label: "检查更新", disabled: false, onClick: onCheck },
      };
    case "available":
      return {
        line: `发现新版本 ${state.version}`,
        isError: false,
        percent: null,
        button: { label: "下载并安装", disabled: false, onClick: onDownload },
      };
    case "downloading":
      return {
        line: `正在下载 ${state.percent}%`,
        isError: false,
        percent: state.percent,
        button: { label: `下载中 ${state.percent}%`, disabled: true, onClick: onDownload },
      };
    case "ready":
      return {
        line: `${state.version} 已下载，重启后生效`,
        isError: false,
        percent: null,
        button: { label: "重启并安装", disabled: false, onClick: onInstall },
      };
    case "error":
      return {
        line: state.message,
        isError: true,
        percent: null,
        button: { label: "检查更新", disabled: false, onClick: onCheck },
      };
    case "unsupported":
      return {
        line: state.message,
        isError: false,
        percent: null,
        button: { label: "检查更新", disabled: true, onClick: onCheck },
      };
  }
}

/** 自动更新 sheet：当前版本 / 新版本 + 一行状态 + 下载或重启按钮。 */
export function UpdateSheet({ state, onCheck, onDownload, onInstall, onClose }: Props) {
  const view = describe(state, { onCheck, onDownload, onInstall });
  const newVersion =
    state &&
    (state.status === "available" || state.status === "downloading" || state.status === "ready")
      ? state.version
      : null;

  return (
    <Sheet onDismiss={onClose}>
      <h3>自动更新</h3>
      <div className="sheet-sub">
        当前版本 {state?.currentVersion ?? "…"}
        {newVersion ? ` · 新版本 ${newVersion}` : ""}
      </div>

      {view.isError ? (
        <div className="error" style={{ marginBottom: 11 }}>
          {view.line}
        </div>
      ) : (
        <div className="note">{view.line}</div>
      )}

      {view.percent != null && (
        <div className="prog">
          <i style={{ width: `${view.percent}%` }} />
        </div>
      )}

      <div className="btns" style={{ marginTop: 12 }}>
        <button
          className="primary grow"
          type="button"
          disabled={view.button.disabled}
          onClick={view.button.onClick}
        >
          {view.button.label}
        </button>
        <button className="tiny" type="button" onClick={onClose}>
          关闭
        </button>
      </div>
    </Sheet>
  );
}
