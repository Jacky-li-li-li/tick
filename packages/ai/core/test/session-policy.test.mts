import assert from "node:assert/strict";
import {
  PANEL_SESSION_PREFIX,
  parseCliSessionId,
  parsePanelSessionKey,
} from "../src/session-policy.ts";

const UUID = "0199a5c3-1f2e-7abc-8def-0123456789ab";

assert.equal(parseCliSessionId(UUID), UUID);
for (const bad of [
  `${PANEL_SESSION_PREFIX}chat-sess-a`,
  "chat-sess-a",
  "13",
  "",
  "not-a-uuid",
  null,
  42,
]) {
  assert.throws(
    () => parseCliSessionId(bad as unknown),
    /invalid CLI session id|panel session key/,
    `parseCliSessionId should reject ${JSON.stringify(bad)}`,
  );
}

const panelKey = `${PANEL_SESSION_PREFIX}chat-sess-a`;
assert.equal(parsePanelSessionKey(panelKey), panelKey);
for (const bad of [UUID, "chat-sess-a", PANEL_SESSION_PREFIX, "", null]) {
  assert.throws(
    () => parsePanelSessionKey(bad as unknown),
    /invalid panel session key|empty/,
    `parsePanelSessionKey should reject ${JSON.stringify(bad)}`,
  );
}

assert.notEqual(parseCliSessionId(UUID), parsePanelSessionKey(panelKey));

console.log("session-policy.test.mts ok");
