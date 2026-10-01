import assert from "node:assert/strict";
import test from "node:test";
import { Engine, TIME_SCALE } from "../src/game/engine";

test("one game minute takes about 2.2 real seconds", () => {
  const engine = new Engine();
  const before = engine.s.minutes;
  engine.paused = false;

  engine.update(2.2);

  assert.ok(Math.abs(engine.s.minutes - before - 1) < 1e-9);
  assert.ok(Math.abs(TIME_SCALE - 1 / 2.2) < 1e-12);
});
