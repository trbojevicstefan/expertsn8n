import assert from "node:assert/strict";
import test from "node:test";
import { consumeFixedWindow } from "../src/lib/rate-limit-core.ts";

test("fixed window allows requests up to the configured limit", () => {
  const now = 1_000;
  const first = consumeFixedWindow(null, now, 3, 60_000);
  assert.equal(first.allowed, true);
  assert.equal(first.count, 1);
  assert.equal(first.remaining, 2);

  const second = consumeFixedWindow(first, now + 1, 3, 60_000);
  const third = consumeFixedWindow(second, now + 2, 3, 60_000);
  assert.equal(third.allowed, true);
  assert.equal(third.count, 3);
  assert.equal(third.remaining, 0);

  const blocked = consumeFixedWindow(third, now + 3, 3, 60_000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.count, 3);
  assert.equal(blocked.changed, false);
});

test("fixed window resets after resetAtMs", () => {
  const previous = { count: 99, resetAtMs: 2_000 };
  const reset = consumeFixedWindow(previous, 2_000, 5, 10_000);
  assert.deepEqual(reset, {
    allowed: true,
    count: 1,
    remaining: 4,
    resetAtMs: 12_000,
    changed: true,
  });
});

test("invalid rate-limit configuration is rejected", () => {
  assert.throws(() => consumeFixedWindow(null, 0, 0, 1000), /positive integer/);
  assert.throws(() => consumeFixedWindow(null, 0, 1, 0), /window must be positive/);
});
