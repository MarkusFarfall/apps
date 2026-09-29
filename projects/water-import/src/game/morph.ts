import type { FishDef } from "./types";

export type TailType = "fork" | "deepfork" | "lunate" | "round" | "truncate" | "emarg" | "pointed";
export type DorsalType = "classic" | "double" | "triple" | "long" | "spiny" | "sail" | "low" | "filament";
export type JawType = "terminal" | "up" | "down" | "beak";

/** Индивидуальная морфология вида */
export interface Morph {
  depth: number; // множитель высоты тела
  hump: number; // смещение самой высокой точки спины
  belly: number; // выпуклость брюха
  snout: number; // 0 — тупая морда, 1 — заострённая
  snoutLen: number; // для вытянутых: длина рыла/клюва
  jaw: JawType;
  lips: boolean;
  tail: TailType;
  tailSize: number;
  dorsal: DorsalType;
  dorsalH: number;
  analH: number;
  pectoral: number; // размер грудного плавника
  pectoralWing: boolean; // крылья-плавники (тригла)
  eye: number;
  barbels: 0 | 1 | 2 | 3; // 1 — подбородочный, 2 — пара, 3 — длинные усы
  scutes: boolean;
  lateral: boolean;
  lateralScutes: boolean;
  finlets: boolean;
  adipose: boolean;
  headBump: boolean;
  finEdge: string | null;
  ped: number; // толщина хвостового стебля
  patScale: number;
  patDensity: number;
  gills: number;
  ratTail: boolean;
  thresher: boolean;
  hammer: boolean;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const G = (f: FishDef) => f.latin.split(" ")[0];
const inG = (f: FishDef, ...g: string[]) => g.includes(G(f));

const cache = new Map<string, Morph>();

export function getMorph(f: FishDef): Morph {
  const hit = cache.get(f.id);
  if (hit) return hit;
  const r = hash(`morph:${f.id}:${f.latin}`);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const rng = (a: number, b: number) => a + r() * (b - a);
  const deep = f.shape === "deep";
  const m: Morph = {
    depth: rng(0.86, 1.18),
    hump: rng(-0.1, 0.16),
    belly: rng(0.85, 1.15),
    snout: rng(0.15, 0.7),
    snoutLen: rng(0, 0.06),
    jaw: pick<JawType>(["terminal", "terminal", "terminal", "up", "down"]),
    lips: false,
    tail: deep ? pick<TailType>(["round", "truncate", "emarg", "emarg", "fork"]) : pick<TailType>(["fork", "fork", "deepfork", "emarg", "truncate"]),
    tailSize: rng(0.85, 1.2),
    dorsal: pick<DorsalType>(deep ? ["classic", "spiny", "long", "classic"] : ["classic", "double", "classic", "spiny", "low"]),
    dorsalH: rng(0.75, 1.35),
    analH: rng(0.7, 1.3),
    pectoral: rng(0.8, 1.3),
    pectoralWing: false,
    eye: rng(0.85, 1.25),
    barbels: 0,
    scutes: false,
    lateral: r() < 0.55,
    lateralScutes: false,
    finlets: false,
    adipose: false,
    headBump: false,
    finEdge: r() < 0.28 ? (f.colors.accent ?? null) : null,
    ped: rng(0.06, 0.12),
    patScale: rng(0.75, 1.35),
    patDensity: rng(0.7, 1.4),
    gills: 5,
    ratTail: false,
    thresher: false,
    hammer: false,
  };

  // ───── семейства ─────
  if (inG(f, "Acipenser", "Huso")) Object.assign(m, { snout: 1, snoutLen: f.id === "starry_sturgeon" ? 0.2 : f.id === "beluga" ? 0.05 : 0.11, jaw: "down", barbels: 2, scutes: true, tail: "fork", dorsal: "low", lateral: false });
  if (inG(f, "Gadus", "Melanogrammus", "Merlangius", "Pollachius", "Boreogadus", "Micromesistius", "Trisopterus", "Molva", "Brosme", "Lota", "Gaidropsarus")) Object.assign(m, { barbels: 1, dorsal: f.id === "tusk" || f.id === "burbot" ? "long" : "triple", tail: f.id === "burbot" || f.id === "tusk" ? "round" : "truncate", lateral: true });
  if (inG(f, "Silurus")) Object.assign(m, { barbels: 3, snout: 0.05, jaw: "up", dorsal: "low", tail: "round" });
  if (inG(f, "Cyprinus", "Gobio", "Tinca")) Object.assign(m, { barbels: 2, lips: true, jaw: "down" });
  if (inG(f, "Mullus", "Mulloidichthys")) Object.assign(m, { barbels: 2, snout: 0.1, jaw: "down", dorsal: "double" });
  if (inG(f, "Salmo", "Oncorhynchus", "Salvelinus", "Coregonus", "Stenodus", "Thymallus", "Osmerus", "Argentina", "Mallotus")) Object.assign(m, { adipose: true, dorsal: "classic", tail: f.id === "salmon" ? "emarg" : "fork" });
  if (inG(f, "Thymallus")) Object.assign(m, { dorsal: "sail", dorsalH: 1.6 });
  if (inG(f, "Thunnus", "Katsuwonus", "Auxis", "Sarda", "Gymnosarda", "Acanthocybium", "Scomber")) Object.assign(m, { tail: "lunate", finlets: true, dorsal: "double", ped: 0.045, snout: 0.75, eye: f.id === "deep_bigeye" ? 1.5 : m.eye });
  if (inG(f, "Caranx", "Seriola", "Selar", "Trachurus", "Elagatis", "Naucrates")) Object.assign(m, { tail: "deepfork", lateralScutes: inG(f, "Caranx", "Trachurus", "Selar"), dorsal: "double", ped: 0.05 });
  if (inG(f, "Epinephelus", "Plectropomus", "Polyprion", "Stereolepis", "Paralabrax", "Serranus", "Myripristis", "Sargocentron")) Object.assign(m, { dorsal: "spiny", tail: inG(f, "Epinephelus", "Stereolepis") ? "round" : "truncate", jaw: "up", lips: inG(f, "Epinephelus", "Stereolepis") });
  if (inG(f, "Lutjanus", "Pristipomoides", "Etelis", "Lobotes")) Object.assign(m, { dorsal: "spiny", tail: inG(f, "Etelis", "Pristipomoides") ? "deepfork" : "emarg" });
  if (inG(f, "Sebastes", "Scorpaena", "Pterois", "Scorpaenichthys", "Trachinus")) Object.assign(m, { dorsal: "spiny", dorsalH: inG(f, "Pterois") ? 2 : 1.2, eye: 1.3, jaw: "up", tail: "truncate" });
  if (inG(f, "Labrus", "Symphodus", "Coris", "Cheilinus", "Choerodon", "Semicossyphus", "Hexagrammos")) Object.assign(m, { lips: true, tail: "round", dorsal: "long", snout: 0.35 });
  if (f.id === "napoleon" || f.id === "sheephead") m.headBump = true;
  if (inG(f, "Scarus")) Object.assign(m, { jaw: "beak", tail: "emarg", dorsal: "long" });
  if (inG(f, "Acanthurus", "Paracanthurus", "Zebrasoma", "Naso")) Object.assign(m, { tail: "lunate", dorsal: "long", snout: 0.55, eye: 1.1 });
  if (inG(f, "Balistes", "Balistoides", "Rhinecanthus")) Object.assign(m, { dorsal: "spiny", dorsalH: 1.5, snout: 0.8, jaw: "terminal", tail: "truncate", eye: 0.9 });
  if (inG(f, "Chaetodon", "Pomacanthus", "Centropyge", "Abudefduf", "Hypsypops", "Chromis", "Scatophagus")) Object.assign(m, { dorsal: "long", tail: "truncate", snout: f.id === "butterflyfish" ? 0.95 : 0.5, analH: 1.4 });
  if (inG(f, "Zanclus")) Object.assign(m, { dorsal: "filament", snout: 0.95, tail: "emarg" });
  if (inG(f, "Mugil", "Chelon", "Planiliza")) Object.assign(m, { snout: 0.05, dorsal: "double", tail: "emarg", jaw: "terminal" });
  if (inG(f, "Clupea", "Sardina", "Engraulis", "Sprattus", "Clupeonella", "Atherina", "Spicara")) Object.assign(m, { tail: "deepfork", dorsal: "low", eye: 1.35, ped: 0.05, snout: 0.6 });
  if (inG(f, "Chelidonichthys")) Object.assign(m, { pectoralWing: true, snout: 0.05, dorsal: "double" });
  if (inG(f, "Zeus")) Object.assign(m, { dorsal: "filament", jaw: "up", tail: "round" });
  if (inG(f, "Coryphaena")) Object.assign(m, { headBump: f.id === "mahi", dorsal: "long", tail: "deepfork", snout: 0 });
  if (inG(f, "Sparus", "Diplodus", "Pagellus", "Dentex", "Spondyliosoma", "Archosargus", "Sarpa")) Object.assign(m, { dorsal: "spiny", tail: "fork", snout: 0.35 });
  if (inG(f, "Perca", "Sander", "Dicentrarchus", "Centropomus", "Lates")) Object.assign(m, { dorsal: "double", tail: "emarg", lateral: true });
  if (inG(f, "Rutilus", "Abramis", "Blicca", "Scardinius", "Leuciscus", "Alburnus", "Carassius", "Pelecus")) Object.assign(m, { dorsal: "classic", tail: "fork", jaw: inG(f, "Pelecus") ? "up" : m.jaw });
  if (inG(f, "Megalops", "Albula")) Object.assign(m, { tail: "deepfork", dorsal: f.id === "tarpon" ? "filament" : "classic", jaw: "up", eye: 1.3 });
  if (inG(f, "Sciaena", "Umbrina", "Sciaenops", "Atractoscion")) Object.assign(m, { barbels: f.id === "shi_drum" ? 1 : 0, dorsal: "double", tail: "truncate" });
  if (inG(f, "Anarhichas")) Object.assign(m, { jaw: "down", lips: true });

  // вытянутые
  if (f.shape === "long" || f.shape === "eel") {
    m.snoutLen = 0.02;
    if (inG(f, "Belone", "Hemiramphus")) m.snoutLen = 0.2;
    if (inG(f, "Esox")) Object.assign(m, { snoutLen: 0.07, dorsal: "low" });
    if (inG(f, "Sphyraena", "Alepisaurus", "Aphanopus")) m.snoutLen = 0.09;
    if (inG(f, "Coryphaenoides", "Macrourus", "Hydrolagus", "Chimaera")) Object.assign(m, { ratTail: true, eye: 1.5 });
    if (inG(f, "Syngnathus", "Hippocampus", "Nemichthys")) m.snoutLen = 0.12;
  }

  // акулы
  if (f.shape === "shark") {
    m.snout = rng(0.4, 1);
    if (inG(f, "Hexanchus")) m.gills = 6;
    if (inG(f, "Notorynchus")) m.gills = 7;
    if (inG(f, "Alopias")) m.thresher = true;
    if (inG(f, "Sphyrna")) m.hammer = true;
    if (inG(f, "Mitsukurina")) m.snoutLen = 0.12;
    if (inG(f, "Rhincodon")) Object.assign(m, { snout: 0, depth: 1.25 });
    if (inG(f, "Isurus", "Lamna", "Carcharodon")) Object.assign(m, { tail: "lunate", snout: 1 });
    if (inG(f, "Somniosus", "Squalus", "Centrophorus", "Isistius")) Object.assign(m, { dorsalH: 0.55, tail: "pointed" });
  }
  cache.set(f.id, m);
  return m;
}
