import assert from "node:assert/strict";
import { parseCliSessionId } from "@tick/ai-core";
import { PiAdapter, type PiAdapterOptions } from "../src/pi-adapter.ts";

const cwd = process.cwd();
const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function makeAdapter(outcome?: { pid?: number; fail?: Error }) {
  const record: { argv?: string[]; spawns: number } = { spawns: 0 };
  const writes: string[] = [];
  const options: PiAdapterOptions = {
    resolveBinary: async () => "/fake/pi",
    clipboard: {
      writeText: (text) => {
        writes.push(text);
      },
    },
    spawnPi: async ({ argv }) => {
      record.argv = argv;
      record.spawns += 1;
      if (outcome?.fail) throw outcome.fail;
      return { pid: outcome?.pid ?? 4321 };
    },
  };
  return { adapter: new PiAdapter(options), record, writes };
}

// launch pre-allocates a UUIDv7 and hands it to `pi --session-id`.
{
  const { adapter, record, writes } = makeAdapter({ pid: 4321 });
  const result = await adapter.launch({
    todoId: "t1",
    title: "Fix IPC",
    body: "details",
    cwd,
  });

  assert.equal(result.toolId, "pi");
  assert.equal(result.pid, 4321);
  assert.equal(result.cwd, cwd);
  assert.match(result.sessionId, UUID_V7);
  assert.deepEqual(record.argv, ["--session-id", result.sessionId]);
  assert.deepEqual(writes, ["Fix IPC\n\ndetails"]);
}

// resume hands the existing id to `pi --session` and leaves the clipboard alone.
{
  const { adapter, record, writes } = makeAdapter({ pid: 99 });
  const id = parseCliSessionId("0199a5c3-1f2e-7abc-8def-0123456789ab");
  const result = await adapter.resume(id, {
    todoId: "t1",
    title: "resume",
    cwd,
  });

  assert.equal(result.sessionId, id);
  assert.equal(result.pid, 99);
  assert.deepEqual(record.argv, ["--session", id]);
  assert.equal(writes.length, 0);
}

// A spawn failure surfaces instead of reporting a bogus success.
{
  const { adapter, record } = makeAdapter({
    fail: new Error("pi did not start in Terminal within 3s"),
  });
  await assert.rejects(
    () => adapter.launch({ todoId: "t1", title: "x", cwd }),
    /pi did not start/,
  );
  assert.equal(record.spawns, 1);
}

// A relative cwd is rejected before pi is spawned.
{
  const { adapter, record } = makeAdapter();
  await assert.rejects(
    () => adapter.launch({ todoId: "t1", title: "x", cwd: "relative/path" }),
    /absolute cwd/,
  );
  assert.equal(record.spawns, 0);
}

console.log("pi-adapter.test.mts ok");
