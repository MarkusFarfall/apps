import assert from "node:assert/strict";
import test from "node:test";
import { Engine, newSave } from "../src/game/engine";
import { WEATHER_INFO } from "../src/game/world";

test("атмосфера следует игровым часам, климату и сезону, не меняя базовую погоду сохранения", () => {
  const save = newSave();
  save.minutes = 11 * 1440 + 6 * 60 + 30;
  save.weather = "snow";
  save.weatherQueued = "cloudy";
  save.weatherNext = save.minutes + 150;
  save.events = [{ id: "current", endsAt: save.minutes + 120 }];

  const engine = new Engine(save);
  const summary = engine.atmosphere.summary();

  assert.equal(summary.source, "game");
  assert.equal(summary.time, "06:30");
  assert.equal(summary.season, engine.season);
  assert.equal(summary.climate, engine.loc.climate);
  assert.equal(engine.s.weather, "snow", "основная погода в сохранении остаётся неизменной");
  assert.ok(WEATHER_INFO[engine.weather], "эффективная погода остаётся одним из шести игровых состояний");
  assert.equal(engine.atmosphere.mods.fog, 0.18, "событие холодного течения сохраняет погодное влияние релиза");

  engine.syncAtmosphere(2);
  assert.equal(engine.atmosphere.summary().time, "06:30", "атмосферный clock не уходит на реальное время");
  assert.equal(engine.s.weather, "snow");
});
