import assert from "node:assert/strict";
import { resolveResumeTarget } from "../src/main/services/resume-target.ts";

const known = {
  id: "0199a5c3-1f2e-7abc-8def-0123456789ab",
  cwd: "/tmp/project",
  toolId: "pi",
  todoId: "t1",
};

const lookup = (id: string) => (id === known.id ? known : undefined);

// A stored CLI session resolves and cwd falls back to the stored one.
{
  const target = resolveResumeTarget(lookup, {
    sessionId: known.id,
    cwd: "",
    toolId: "pi",
  });
  assert.equal(target.sessionId, known.id);
  assert.equal(target.cwd, "/tmp/project");
  assert.equal(target.toolId, "pi");
  assert.equal(target.todoId, "t1");
}

// An explicit cwd wins over the stored one.
{
  const target = resolveResumeTarget(lookup, {
    sessionId: known.id,
    cwd: "/tmp/other",
  });
  assert.equal(target.cwd, "/tmp/other");
}

// A panel session key never reaches the CLI adapter.
assert.throws(
  () =>
    resolveResumeTarget(lookup, { sessionId: "panel:chat-sess-a", cwd: "/tmp" }),
  /panel session key/,
);

// A durable conversation number never reaches the CLI adapter.
assert.throws(
  () => resolveResumeTarget(lookup, { sessionId: "13", cwd: "/tmp" }),
  /invalid CLI session id/,
);

// An id we never created as a CLI session is rejected.
assert.throws(
  () =>
    resolveResumeTarget(lookup, {
      sessionId: "11111111-1111-7111-8111-111111111111",
      cwd: "/tmp",
    }),
  /unknown CLI session/,
);

console.log("resume-target.test.mts ok");
