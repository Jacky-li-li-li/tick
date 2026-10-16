import assert from "node:assert/strict";
import { parseCliSessionId } from "@tick/ai-core";
import { newCliSessionId } from "../src/session-id.ts";

const early = newCliSessionId(1_700_000_000_000);
const later = newCliSessionId(1_700_000_000_001);
const laterTwin = newCliSessionId(1_700_000_000_001);

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

for (const id of [early, later, laterTwin]) {
  assert.match(id, UUID_V7);
  assert.equal(parseCliSessionId(id), id);
}

assert.notEqual(later, laterTwin, "ids must not collide");
assert.ok(early < later, "later timestamp must sort after the earlier one");

console.log("session-id.test.mts ok");
