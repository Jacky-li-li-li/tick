import { autoUpdater } from "electron-updater";
import type { UpdateState } from "@tick/shared";

type Listener = (state: UpdateState) => void;

/**
 * electron-updater 是回调式的，这里把它收敛成一台状态机，再把状态推给订阅者。
 *
 * autoInstallOnAppQuit 必须保持 true：macOS 的 MacUpdater 只在它为 true 时才把
 * 下好的 zip 交给 Squirrel（MacUpdater.doDownloadUpdate 里的 nativeUpdater.checkForUpdates）。
 * 关掉它，「已下载」是个假状态，quitAndInstall 会一直等一个不会来的事件。
 */
export class UpdateService {
  private state: UpdateState;
  private readonly listeners = new Set<Listener>();
  private wired = false;

  constructor(
    private readonly currentVersion: string,
    private readonly packaged: boolean,
  ) {
    this.state = packaged
      ? { status: "idle", currentVersion }
      : {
          status: "unsupported",
          currentVersion,
          message: "开发模式不检查更新：只有打包后的 Tick.app 里才有 app-update.yml",
        };
  }

  getState(): UpdateState {
    return this.state;
  }

  onState(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private set(next: UpdateState): UpdateState {
    this.state = next;
    for (const listener of this.listeners) listener(next);
    return next;
  }

  private fail(err: unknown): UpdateState {
    if (this.state.status === "error") return this.state;
    return this.set({
      status: "error",
      currentVersion: this.currentVersion,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  /** 只接一次；未打包时什么都不做（autoUpdater 在开发态没有 feed 可读）。 */
  private wire(): void {
    if (this.wired || !this.packaged) return;
    this.wired = true;
    autoUpdater.autoDownload = false; // 下载由界面上的按钮触发
    autoUpdater.autoInstallOnAppQuit = true; // 见类注释：关了 macOS 就装不上
    autoUpdater.on("checking-for-update", () => {
      this.set({ status: "checking", currentVersion: this.currentVersion });
    });
    autoUpdater.on("update-available", (info) => {
      this.set({ status: "available", currentVersion: this.currentVersion, version: info.version });
    });
    autoUpdater.on("update-not-available", () => {
      this.set({ status: "up-to-date", currentVersion: this.currentVersion });
    });
    autoUpdater.on("download-progress", (progress) => {
      const current = this.state;
      if (current.status !== "downloading" && current.status !== "available") return;
      this.set({
        status: "downloading",
        currentVersion: this.currentVersion,
        version: current.version,
        percent: Math.max(0, Math.min(100, Math.round(progress.percent))),
      });
    });
    autoUpdater.on("update-downloaded", (info) => {
      this.set({ status: "ready", currentVersion: this.currentVersion, version: info.version });
    });
    autoUpdater.on("error", (err) => {
      this.fail(err);
    });
  }

  /** 打包启动后延迟自查一次；失败只落到 error 状态，不弹窗打扰。 */
  start(delayMs = 8000): void {
    if (!this.packaged) return;
    this.wire();
    const timer = setTimeout(() => {
      void this.check();
    }, delayMs);
    timer.unref();
  }

  async check(): Promise<UpdateState> {
    this.wire();
    if (!this.packaged) return this.state;
    // 已在下载 / 已下载好时再查一次会覆盖状态，把用户刚拿到的进度抹掉
    if (this.state.status === "downloading" || this.state.status === "ready") return this.state;
    this.set({ status: "checking", currentVersion: this.currentVersion });
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      // electron-updater 同时发 error 事件；这里兜住没人监听时的 rejection
      return this.fail(err);
    }
    return this.state;
  }

  async download(): Promise<UpdateState> {
    this.wire();
    if (!this.packaged) return this.state;
    // 只有「有新版」才有东西可下；其余状态下按钮本来就不可点
    if (this.state.status !== "available") return this.state;
    const version = this.state.version;
    this.set({ status: "downloading", currentVersion: this.currentVersion, version, percent: 0 });
    try {
      await autoUpdater.downloadUpdate();
    } catch (err) {
      return this.fail(err);
    }
    return this.state;
  }

  /** 退出并安装。macOS 上 Squirrel 会替换 .app 并重新拉起（autoRunAppAfterInstall 默认 true）。 */
  install(): void {
    this.wire();
    if (!this.packaged || this.state.status !== "ready") return;
    autoUpdater.quitAndInstall();
  }
}
