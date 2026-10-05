import assert from "node:assert/strict";
import test from "node:test";
import { Engine, migrateSave, newSave } from "../src/game/engine";
import { EventDirector } from "../src/game/events";
import { GAME_EVENTS } from "../src/game/events/gameCatalog";
import type { DirectorSave, LiveEvent } from "../src/game/events/types";
import type { SaveData } from "../src/game/types";
import { sanitizeSave } from "../src/lib/sanitize";

test("legacy saves keep event progress and acquire a validated EventDirector state", () => {
  const raw = newSave();
  raw.minutes = 4_500;
  raw.events = [{ id: "current", endsAt: raw.minutes + 120 }];
  raw.finds = { star_stone: 2, old_compass: 1 };
  delete raw.eventDirector;

  const migrated = migrateSave(raw);
  assert.ok(migrated);
  assert.deepEqual(migrated.finds, { star_stone: 2, old_compass: 1 });
  assert.equal(migrated.events[0]?.id, "current");

  const engine = new Engine(migrated);
  assert.equal(engine.eventDirector.activeList()[0]?.def.id, "current");
  assert.equal(engine.atmosphere.mods.fog, 0.18);
  assert.equal(engine.s.finds.star_stone, 2);
});

test("server sanitizer preserves release events, reward finds, and normalizes nested director state", () => {
  const raw = newSave() as unknown as Record<string, unknown>;
  const minute = raw.minutes as number;
  const director = new EventDirector({ seed: 42, catalog: GAME_EVENTS, startT: minute });
  assert.equal(director.trigger("current", { force: true, skipOmen: true }), true);
  const state = director.save();
  state.live.push({ uid: 999, id: "not-a-game-event", phase: "active", omenAt: minute, start: minute, end: minute + 40, seed: 4 } as LiveEvent);
  raw.eventDirector = state;
  raw.events = [{ id: "current", endsAt: minute + 60 }, { id: "not-a-game-event", endsAt: minute + 60 }];
  raw.finds = { star_stone: 1, old_compass: 2, invented: 8 };

  const clean = sanitizeSave(raw);
  const savedDirector = clean.data.eventDirector as DirectorSave;
  assert.deepEqual(savedDirector.live.map((event) => event.id), ["current"]);
  assert.deepEqual(clean.data.events, [{ id: "current", endsAt: minute + 60 }]);
  assert.deepEqual(clean.data.finds, { star_stone: 1, old_compass: 2 });
  assert.ok(clean.clamped.includes("eventDirector"));

  const engine = new Engine(clean.data as unknown as SaveData);
  assert.equal(engine.eventDirector.activeList()[0]?.def.id, "current");
  assert.equal(engine.s.finds.old_compass, 2);
});
