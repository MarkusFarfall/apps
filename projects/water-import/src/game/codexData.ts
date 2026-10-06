// Данные экрана кодекса: виды и названия берём из самой игры (все 301 вид).
// Файл создан при переносе новой отрисовки рыб (релиз «Новые модели рыб», тег Ysys).
import { FISH, FISH_BY_ID, RARITY_INFO, VARIANT_INFO } from './fish';
import { BAITS, LOCATIONS, SEASONS, WEATHER_INFO } from './world';
import type { BaitId, FishDef, LocId, Rarity, TimeReq, WeatherId } from './types';

export { FISH, FISH_BY_ID, RARITY_INFO, VARIANT_INFO };

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const LOC_ORDER = LOCATIONS.map((l) => l.id) as LocId[];
export const LOC_NAMES = Object.fromEntries(LOCATIONS.map((l) => [l.id, l.name])) as Record<LocId, string>;
export const LOC_WATER = Object.fromEntries(LOCATIONS.map((l) => [l.id, [l.water.surface, l.water.deep]])) as Record<LocId, [string, string]>;
export const BAIT_NAMES = Object.fromEntries(BAITS.map((b) => [b.id, b.name])) as Record<BaitId, string>;
export const WEATHER_NAMES = Object.fromEntries(Object.entries(WEATHER_INFO).map(([k, v]) => [k, v.name])) as Record<WeatherId, string>;
export const SEASON_NAMES = SEASONS;

export const TIME_NAMES: Record<TimeReq, string> = { any: 'В любое время', day: 'Днём', night: 'Ночью', twilight: 'В сумерках' };
export const SHAPE_NAMES: Record<FishDef['shape'], string> = {
  fusiform: 'Веретено', deep: 'Высокое тело', flat: 'Камбала', eel: 'Угорь', long: 'Вытянутое', shark: 'Акула',
  angler: 'Удильщик', squid: 'Головоногое', puffer: 'Шар', billfish: 'Копьеносец', ray: 'Скат', blob: 'Капля',
};
