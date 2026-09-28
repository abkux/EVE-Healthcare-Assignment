import assert from "node:assert/strict";
import { test } from "node:test";
import { createRateLimit } from "../src/middleware/rateLimit.js";

test("rate limit blocks the request that crosses the max", () => {
  const allow = createRateLimit({ windowMs: 1000, max: 2 });
  assert.equal(allow("10.0.0.1", 1000), true);
  assert.equal(allow("10.0.0.1", 1100), true);
  assert.equal(allow("10.0.0.1", 1200), false);
  assert.equal(allow("10.0.0.2", 1200), true);
  assert.equal(allow("10.0.0.1", 2100), true);
});
