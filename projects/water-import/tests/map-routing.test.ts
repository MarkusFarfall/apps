import assert from "node:assert/strict";
import test from "node:test";
import { Engine, newSave } from "../src/game/engine";
import { LOC_POS, PORT_BY_ID, travelHoursBetween } from "../src/game/world";

test("map route quotes use the player's current sea or port position", () => {
  const save = newSave();
  save.location = "ocean";
  save.port = "home";
  save.atPort = false;
  const engine = new Engine(save);
  const target = PORT_BY_ID.coral.pos;

  assert.deepEqual(engine.here, LOC_POS.ocean);
  const fromSea = engine.travelMinutesTo(target);
  assert.equal(
    fromSea,
    Math.round(travelHoursBetween(LOC_POS.ocean, target) * engine.boat.travelMult * (1 - engine.perk("navigator") * 0.1) * 60),
  );

  engine.s.atPort = true;
  assert.deepEqual(engine.here, PORT_BY_ID.home.pos);
  const fromPort = engine.travelMinutesTo(target);
  assert.notEqual(fromSea, fromPort);
  assert.equal(
    fromPort,
    Math.round(travelHoursBetween(PORT_BY_ID.home.pos, target) * engine.boat.travelMult * (1 - engine.perk("navigator") * 0.1) * 60),
  );
});
