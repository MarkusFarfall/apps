import assert from "node:assert/strict";
import test from "node:test";
import { Engine, migrateSave, newSave } from "../src/game/engine";
import { Atmosphere } from "../src/game/atmosphere";
import { ctxFromAtmosphere, EventDirector } from "../src/game/events";
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

test("legacy supplemental events remain loadable through the single new director", () => {
  const raw = newSave();
  raw.minutes = 2_500;
  raw.events = [{ id: "calm", endsAt: raw.minutes + 90 }];
  delete raw.eventDirector;

  const migrated = migrateSave(raw);
  assert.ok(migrated);
  const engine = new Engine(migrated);
  assert.deepEqual(engine.eventDirector.activeList().map(({ def }) => def.id), ["calm"]);
});

test("director v1 saves migrate to the new rare cadence without a DB-schema change", () => {
  const startT = 1_200;
  const oldDirector = new EventDirector({ seed: 18, catalog: GAME_EVENTS, startT });
  const oldState = oldDirector.save();
  oldState.v = 1;
  oldState.next = startT + 8;
  oldState.auto = false;

  const restored = new EventDirector({ seed: 19, catalog: GAME_EVENTS, startT });
  restored.load(oldState);
  const migrated = restored.save();
  assert.equal(migrated.v, 2);
  assert.equal(restored.auto, true);
  assert.ok(migrated.next - startT >= 520);
});

test("event rolls now have long quiet intervals", () => {
  const startT = 900;
  const director = new EventDirector({ seed: 42, catalog: GAME_EVENTS, startT });
  const first = director.save();
  assert.ok(first.next - startT >= 520 && first.next - startT < 1_160);

  const atmosphere = new Atmosphere({ climate: "temperate", seed: 12 });
  director.update(first.next, ctxFromAtmosphere(atmosphere, { loc: "bay" }));
  const next = director.save();
  assert.ok(next.next - next.T >= 520 && next.next - next.T <= 2_784);
});
