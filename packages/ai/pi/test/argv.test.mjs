import assert from "node:assert/strict";
import { buildPiArgv } from "../src/argv.ts";

assert.deepEqual(buildPiArgv({}), []);
assert.deepEqual(buildPiArgv({ session: "abc-1" }), ["--session", "abc-1"]);
assert.deepEqual(buildPiArgv({ sessionId: "new1" }), ["--session-id", "new1"]);
assert.deepEqual(buildPiArgv({ name: "t" }), ["--name", "t"]);
assert.throws(() => buildPiArgv({ session: "a", sessionId: "b" }));
console.log("argv.test.mjs ok");
