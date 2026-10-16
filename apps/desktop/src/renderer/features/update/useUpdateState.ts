import { useCallback, useEffect, useState } from "react";
import type { UpdateState } from "@tick/shared";

/** 订阅主进程的更新状态机。界面只读 state，只调这三个动作。 */
export function useUpdateState() {
  const [state, setState] = useState<UpdateState | null>(null);

  useEffect(() => {
    let alive = true;
    // 先拉一次快照：面板可能在状态变化之后才被打开，推送就错过了
    void window.tick.update.getState().then((snapshot) => {
      if (alive) setState(snapshot);
    });
    const off = window.tick.update.onState(setState);
    return () => {
      alive = false;
      off();
    };
  }, []);

  const check = useCallback(async () => {
    setState(await window.tick.update.check());
  }, []);

  const download = useCallback(async () => {
    setState(await window.tick.update.download());
  }, []);

  const install = useCallback(async () => {
    await window.tick.update.install();
  }, []);

  return { state, check, download, install };
}
