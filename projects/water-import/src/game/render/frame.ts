import type { Engine } from "../engine";
import type { LocationDef, SpotDef, WeatherId } from "../types";

export interface Frame {
  ctx: CanvasRenderingContext2D;
  e: Engine;
  loc: LocationDef;
  spot: SpotDef;
  weather: WeatherId;
  W: number;
  H: number;
  t: number;
  dt: number;
  /** линия воды (разрез) */
  sY: number;
  /** горизонт */
  hY: number;
  cam: number;
  K: number;
  sc: number;
  night: number;
  day: number;
  golden: number;
  cover: number;
  fogK: number;
  top: string;
  mid: string;
  hor: string;
  sunX: number;
  sunY: number;
  sunElev: number;
  sunVis: number;
  moonX: number;
  moonY: number;
  moonUp: boolean;
  moonVis: number;
  amp: number;
  wind: number;
  clarity: number;
  quality: number;
  compact: boolean;
  land: boolean;
  /** зарезервировано сверху/снизу под DOM-интерфейс */
  topRes: number;
  botRes: number;
  depthPx: (m: number) => number;
  waveY: (x: number) => number;
}
