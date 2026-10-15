if (typeof Promise.withResolvers !== "function") {
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

const todos: Array<{ id: string; title: string; status: string; content?: string }> = [];
let n = 0;

async function main() {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY missing");
  const dir = await mkdtemp(path.join(tmpdir(), "tick-chat-ds-"));
  const host = new ChatAgentHost({
    storageDir: dir,
    createTodo: async (input) => {
      const id = `t-${++n}`;
      todos.push({ id, title: input.title, status: "open", content: input.content });
      return { id, title: input.title };
    },
    listTodos: async (input) =>
      todos.filter((t) => (input?.status ? t.status === input.status : true)),
  });

  const sessionId = "chat-smoke-a";
  console.log("provider env DEEPSEEK set=", Boolean(process.env.DEEPSEEK_API_KEY));

  const r1 = await host.send(sessionId, "用一句话打个招呼，说你是 Tick panel chat");
  console.log("send1", JSON.stringify({ ok: r1.ok, status: r1.status, message: r1.message.slice(0, 200), hist: r1.history.length }, null, 2));

  const before = todos.length;
  const r2 = await host.send(sessionId, '请创建一个 todo，标题叫「DeepSeek冒烟」');
  console.log("send2", JSON.stringify({ ok: r2.ok, status: r2.status, message: r2.message.slice(0, 300), hist: r2.history.length, todosAfter: todos.length, created: todos.slice(before) }, null, 2));

  const hist = await host.history(sessionId);
  console.log("history count", hist.length, "roles", hist.map((h) => h.who).join(","));

  const r3 = await host.send("chat-smoke-b", "只在 B 说：session-B-only");
  const histA = await host.history(sessionId);
  const histB = await host.history("chat-smoke-b");
  const leak = histB.some((h) => h.text.includes("DeepSeek冒烟")) || histA.some((h) => h.text.includes("session-B-only"));
  console.log("isolation", { a: histA.length, b: histB.length, leak, bMsg: r3.message.slice(0, 120) });

  await rm(dir, { recursive: true, force: true });
  if (!r1.ok || leak) process.exitCode = 1;
  if (todos.length < before + 1) {
    console.warn("WARN: create_todo may not have fired (model chose not to call tool)");
  } else {
    console.log("PASS create_todo");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
