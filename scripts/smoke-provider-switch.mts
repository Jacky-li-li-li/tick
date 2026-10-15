/**
 * Regression: mapped panel conversation must survive provider switch (faux → deepseek).
 * Requires DEEPSEEK_API_KEY.
 */
if (typeof (Promise as any).withResolvers !== "function") {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (v: T | PromiseLike<T>) => void;
    let reject!: (e?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ChatAgentHost } from "../apps/desktop/src/main/services/chat-agent-host.ts";

const todos: Array<{ id: string; title: string; status: string }> = [];
let n = 0;
const hooks = {
  createTodo: async (input: { title: string; content?: string }) => {
    const id = `t-${++n}`;
    todos.push({ id, title: input.title, status: "open" });
    return { id, title: input.title };
  },
  listTodos: async () => todos,
};

async function main() {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY required");
  const dir = await mkdtemp(path.join(tmpdir(), "tick-switch-"));
  const sessionId = "chat-switch-a";

  // Phase 1: force faux by clearing DEEPSEEK temporarily
  const key = process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  const host1 = new ChatAgentHost({ storageDir: dir, ...hooks });
  const r1 = await host1.send(sessionId, "hello faux");
  console.log("phase1 faux", { ok: r1.ok, status: r1.status, msg: r1.message.slice(0, 80) });
  await host1.stop();

  // Phase 2: same storage + panel map, now DeepSeek
  process.env.DEEPSEEK_API_KEY = key;
  const host2 = new ChatAgentHost({ storageDir: dir, ...hooks });
  const before = todos.length;
  const r2 = await host2.send(sessionId, '请创建一个 todo，标题叫「切换provider冒烟」');
  console.log("phase2 deepseek", {
    ok: r2.ok,
    status: r2.status,
    msg: r2.message.slice(0, 200),
    created: todos.slice(before),
  });
  await host2.stop();
  await rm(dir, { recursive: true, force: true });

  if (!r2.ok || r2.message.includes("faux-1") || r2.message.includes("not available")) {
    console.error("FAIL: still stuck on faux / unavailable model");
    process.exit(1);
  }
  if (todos.length <= before) {
    console.warn("WARN: create_todo may not have fired");
  } else {
    console.log("PASS provider switch + create_todo");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
