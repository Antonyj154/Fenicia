// ============================================================================
// FENICIA · Mundo de juego: la ciudad isométrica de cada partida.
// Terreno horneado una vez + piezas PNG (docs/arte/LEEME*.txt) ordenadas por profundidad.
// Las huellas (planta) de cada edificio se MIDEN en su PNG (vértice inferior), así las sombras,
// el orden de dibujo y las zonas por donde no se camina coinciden con lo que se ve.
// Cada ciudad usa las mismas piezas con otra costa y otra disposición (CITY_LAYOUT).
// ============================================================================
import { Canvas, Iso, R, rng, shade } from '../art/iso';
import { coastDist, HQ, isLand, groundAt, paintTerrain, pier, QX, setCoast, shadePoly, STREET, type CoastCfg } from '../art/tiro';
import { WORKSHOPS } from '../economy/data/invest';
import type { GameState, ShipClass } from '../economy/types';

export const U = 16;                      // medio ancho de baldosa en píxeles de arte
export const BOUNDS = { x0: -22, x1: 54, y0: -22, y1: 64 };

// ---------------------------------------------------------------------------- carga de piezas
export interface Img { el: HTMLImageElement; w: number; h: number; bx: number; mask: Uint8Array }
export interface Strip { img: Img; fw: number; fh: number; px: number; py: number; frames: { x: number; ms: number }[] }

const BASE = './assets';
const imgs = new Map<string, Img | null>();
const strips = new Map<string, Strip | null>();
const metas = new Map<string, any>();

function analyse(el: HTMLImageElement): Img {
  const c = document.createElement('canvas'); c.width = el.width; c.height = el.height;
  const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(el, 0, 0);
  const d = g.getImageData(0, 0, el.width, el.height).data;
  const mask = new Uint8Array(el.width * el.height);
  for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  let bx = el.width / 2;
  for (let y = el.height - 1; y >= 0; y--) {
    let a = -1, b = -1;
    for (let x = 0; x < el.width; x++) if (mask[y * el.width + x]) { if (a < 0) a = x; b = x; }
    if (a >= 0) { bx = (a + b) / 2; break; }
  }
  return { el, w: el.width, h: el.height, bx, mask };
}

function loadImg(path: string): Promise<Img | null> {
  if (imgs.has(path)) return Promise.resolve(imgs.get(path)!);
  return new Promise(res => {
    const el = new Image();
    el.onload = () => { const i = analyse(el); imgs.set(path, i); res(i); };
    el.onerror = () => { imgs.set(path, null); res(null); };
    el.src = `${BASE}/${path}.png`;
  });
}
async function loadMeta(path: string) {
  if (!metas.has(path)) { try { metas.set(path, await (await fetch(`${BASE}/${path}.json`)).json()); } catch { metas.set(path, null); } }
  return metas.get(path);
}

/** Tira de fotogramas. Admite los dos formatos de JSON de los encargos (personas/carretas y barcos/costa). */
async function loadStrip(path: string, defW = 20): Promise<Strip | null> {
  const img = await loadImg(path);
  if (!img) { strips.set(path, null); return null; }
  const m = await loadMeta(path);
  const fw = m?.frame_size?.w ?? m?.ancho_fotograma ?? defW, fh = m?.frame_size?.h ?? m?.alto_fotograma ?? img.h;
  const n = Math.max(1, Math.round(img.w / fw));
  const ms = m?.duracion_ms ?? 150;
  const frames = (m?.frames ?? Array.from({ length: n }, (_, i) => ({ x: i * fw, duration_ms: i ? 140 : 600 }))).map((f: any) => ({ x: f.x, ms: f.duration_ms ?? ms }));
  const piv = m?.pivot ?? m?.pivote;
  const st: Strip = { img, fw, fh, px: piv?.x ?? fw / 2, py: piv?.y ?? fh - 1, frames };
  strips.set(path, st);
  return st;
}

const PIVOT: Record<string, [number, number]> = {
  arbol_cedro_01: [30, 52], arbol_cedro_02: [26, 48], arbol_cipres_01: [6, 60], arbol_cipres_02: [8, 50],
  arbol_olivo_01: [18, 34], arbol_olivo_02: [18, 35], arbol_palmera_01: [16, 53], arbol_palmera_02: [20, 52],
  obj_anforas: [12, 26], obj_cajas_01: [9, 25], obj_cajas_02: [17, 29], obj_cajas_03: [17, 29], obj_sacos: [9, 27],
  obj_mostrador_anforas: [17, 32], obj_mostrador_telas: [17, 32], obj_mostrador_vidrio: [17, 32], obj_mostrador_joyas: [17, 32],
  marca_propio: [3, 23], marca_alquilado: [3, 23], marca_solar: [32, 41], marca_andamio: [32, 69], marca_lleno: [3, 15],
};
const HOUSES = ['casa_01', 'casa_02', 'casa_03', 'casa_04', 'casa_05', 'casa_06', 'casa_07', 'casa_08', 'casa_09'];
const BUILDINGS = [...HOUSES, 'edif_almacen_pequeno', 'edif_almacen_mediano', 'edif_almacen_grande', 'edif_almacen_portuario', 'edif_almacen_comercial',
  'edif_local_alfareros', 'edif_local_mercado', 'edif_casa_comercio', 'edif_gran_bazar', 'edif_oficina_puerto', 'edif_puesto_ambulante', 'edif_puesto_plaza',
  'edif_puesto_puerto', 'edif_puesto_templo', 'edif_templo_melqart', 'edif_astillero', 'edif_caballerizas', 'edif_caballerizas_2', 'edif_puerta_ciudad',
  'muralla_tramo', 'muralla_tramo_b', 'muralla_torre', 'muralla_esquina', ...WORKSHOPS.map(w => w.art)];
const OBJECTS = ['arbol_cedro_01', 'arbol_cedro_02', 'arbol_cipres_01', 'arbol_cipres_02', 'arbol_olivo_01', 'arbol_olivo_02', 'arbol_palmera_01', 'arbol_palmera_02',
  'obj_anforas', 'obj_cajas_01', 'obj_cajas_02', 'obj_cajas_03', 'obj_sacos', 'obj_abrevadero', 'obj_cofre', 'obj_fardos_purpura', 'obj_grua', 'obj_heno', 'obj_lingotes',
  'obj_rueda_carro', 'obj_toneles', 'obj_troncos_cedro', 'obj_mostrador_anforas', 'obj_mostrador_telas', 'obj_mostrador_vidrio', 'obj_mostrador_joyas'];
const COAST = ['roca_01', 'roca_02', 'roca_03', 'roca_04', 'roca_05', 'roca_06', 'acantilado_01', 'acantilado_02', 'playa_01', 'playa_02', 'playa_03', 'escollera', 'escollera_b'];
export const CLIENTS = ['pj_cliente_1', 'pj_cliente_2', 'pj_cliente_3', 'pj_cliente_4', 'pj_cliente_5', 'pj_cliente_6', 'pj_cliente_7', 'pj_porteador', 'pj_extranjero'];
const PEOPLE = [...CLIENTS, 'pj_vendedor', 'pj_jugador', 'pj_almacenero', 'pj_arriero', 'pj_capitan', 'pj_marinero', 'pj_sacerdote', 'pj_guardia'];
export const SHIP_ART: Record<ShipClass, string> = { galera_alquiler: 'galera', mercante: 'mercante', avanzado: 'avanzado' };
export const CART_ART: Record<string, string> = { burro: 'carreta_burro', bueyes: 'carreta_bueyes', caravana: 'caravana_camellos' };

export async function loadArt(): Promise<void> {
  await Promise.all([
    ...BUILDINGS.map(b => loadImg(`edificios/${b}`)),
    ...OBJECTS.map(o => loadImg(`objetos/${o}`)),
    ...COAST.map(o => loadImg(`costa/${o}`)),
    loadStrip('costa/faro', 64),
    ...['marca_propio', 'marca_alquilado', 'marca_solar', 'marca_andamio', 'marca_lleno'].map(m => loadImg(`marcas/${m}`)),
    ...PEOPLE.flatMap(p => [loadStrip(`personas/${p}`), loadStrip(`personas/${p}_espalda`)]),
    loadStrip('personas/pj_vendedor_ofrecer'),
    ...Object.values(SHIP_ART).flatMap(a => ['se', 'so'].flatMap(d => [loadImg(`barcos/barco_${a}_${d}_izada`), loadImg(`barcos/barco_${a}_${d}_recogida`), loadStrip(`barcos/barco_${a}_${d}_remos`, 149)])),
    ...['se', 'so'].map(d => loadStrip(`barcos/barca_pesca_${d}`, 65)),
    ...[1, 2, 3].map(i => loadImg(`barcos/barco_construccion_${i}`)),
    ...Object.values(CART_ART).flatMap(a => ['ne', 'no', 'se', 'so'].map(d => loadStrip(`carretas/${a}_${d}`, 70))),
  ]);
}
export const getImg = (path: string) => imgs.get(path) ?? null;
export const getStrip = (path: string) => strips.get(path) ?? null;
export const person = (name: string) => strips.get(`personas/${name}`) ?? null;

/** Huella real de un edificio PNG apoyado por su vértice inferior en (x1, y1). */
export function footprintOf(art: string, x1: number, y1: number): Rect | null {
  const im = getImg(`edificios/${art}`);
  if (!im) return null;
  return { x0: x1 - im.bx / U, y0: y1 - (im.w - im.bx) / U, x1, y1 };
}

// ---------------------------------------------------------------------------- disposición por ciudad
// Mismas piezas, otra costa y otro reparto de casas, árboles y rocas: distinto sin un cambio drástico.
interface CityLayout { coast: CoastCfg; seed: number; trees: string[]; palms: number; foreign: number }
export const CITY_LAYOUT: Record<string, CityLayout> = {
  tiro:    { coast: { seed: 0, cx: 8, cy: 21, rx: 25, ry: 37, amp: 0.75 }, seed: 31, trees: ['arbol_olivo_01', 'arbol_olivo_02', 'arbol_cipres_01', 'arbol_cedro_02'], palms: 0.5, foreign: 2 },
  sidon:   { coast: { seed: 3, cx: 6, cy: 23, rx: 27, ry: 35, amp: 0.7 }, seed: 47, trees: ['arbol_olivo_01', 'arbol_olivo_02', 'arbol_olivo_01', 'arbol_cipres_02'], palms: 0.35, foreign: 2 },
  biblos:  { coast: { seed: 7, cx: 9, cy: 20, rx: 24, ry: 39, amp: 0.8 }, seed: 59, trees: ['arbol_cedro_01', 'arbol_cedro_02', 'arbol_cipres_01', 'arbol_cipres_02'], palms: 0.2, foreign: 1 },
  cartago: { coast: { seed: 11, cx: 5, cy: 24, rx: 29, ry: 34, amp: 0.65 }, seed: 73, trees: ['arbol_palmera_01', 'arbol_palmera_02', 'arbol_olivo_02', 'arbol_cipres_01'], palms: 0.8, foreign: 3 },
  gadir:   { coast: { seed: 5, cx: 8, cy: 22, rx: 23, ry: 38, amp: 0.85 }, seed: 89, trees: ['arbol_olivo_02', 'arbol_cipres_02', 'arbol_palmera_01', 'arbol_cedro_02'], palms: 0.6, foreign: 2 },
};

// ---------------------------------------------------------------------------- sprites
export interface Sprite {
  id?: string; label?: string;
  src: CanvasImageSource;
  sx: number; sy: number; sw: number; sh: number;
  x: number; y: number;              // esquina superior izquierda en píxeles de mundo
  key: number;                       // orden de dibujo (x + y del frente)
  mask?: { m: Uint8Array; w: number; ox: number; oy: number };
  flip?: boolean;
  alpha?: number;
}
export interface Rect { x0: number; y0: number; x1: number; y1: number }

export interface Lot { id: string; kind: 'venue' | 'ambulante'; ref?: string; label: string; art: string; ax: number; ay: number; x0: number; y0: number; x1: number; y1: number; counter?: string }
/** Venta de puestos y locales: el vértice inferior (ax, ay) es fijo; la planta sale del PNG. */
const LOT_DEFS: Omit<Lot, 'x0' | 'y0' | 'x1' | 'y1'>[] = [
  { id: 'ambulante', kind: 'ambulante', label: 'Tu puesto', art: 'edif_puesto_ambulante', ax: 18.2, ay: 22.2 },
  { id: 'puesto_plaza', kind: 'venue', ref: 'puesto_plaza', label: 'Puesto en la plaza', art: 'edif_puesto_plaza', ax: 17.6, ay: 24.7 },
  { id: 'puesto_templo', kind: 'venue', ref: 'puesto_templo', label: 'Puesto junto al templo', art: 'edif_puesto_templo', ax: 23.6, ay: 22.9 },
  { id: 'puesto_puerto', kind: 'venue', ref: 'puesto_puerto', label: 'Puesto del puerto', art: 'edif_puesto_puerto', ax: 27.2, ay: 27.1 },
  { id: 'local_alfareros', kind: 'venue', ref: 'local_alfareros', label: 'Local de los alfareros', art: 'edif_local_alfareros', ax: 11.1, ay: 25.1, counter: 'obj_mostrador_anforas' },
  { id: 'local_mercado', kind: 'venue', ref: 'local_mercado', label: 'Local del mercado central', art: 'edif_local_mercado', ax: 11.6, ay: 18.6, counter: 'obj_mostrador_telas' },
  { id: 'casa_comercio', kind: 'venue', ref: 'casa_comercio', label: 'Casa de comercio del puerto', art: 'edif_casa_comercio', ax: 19.6, ay: 33.1, counter: 'obj_mostrador_vidrio' },
  { id: 'gran_bazar', kind: 'venue', ref: 'gran_bazar', label: 'Gran bazar', art: 'edif_gran_bazar', ax: 6.8, ay: 20.8, counter: 'obj_mostrador_joyas' },
];
/** Solares de almacén: 4 normales (hasta 4×4) y 2 grandes junto a la ciudad (portuario y comercial, hasta 7×7). */
const WH_SLOTS: (Rect & { big: boolean })[] = [
  { x0: 21.6, y0: 29.6, x1: 25.6, y1: 33.6, big: false }, { x0: 21.6, y0: 34.2, x1: 25.6, y1: 38.2, big: false },
  { x0: 15.6, y0: 36.0, x1: 19.6, y1: 40.0, big: false }, { x0: 8.6, y0: 36.6, x1: 12.6, y1: 40.6, big: false },
  { x0: -6, y0: 8, x1: 1, y1: 15, big: true }, { x0: 1, y0: 1, x1: 8, y1: 8, big: true },
];
export const WH_ART: Record<string, string> = { pequeno: 'edif_almacen_pequeno', mediano: 'edif_almacen_mediano', grande: 'edif_almacen_grande', portuario: 'edif_almacen_portuario', comercial: 'edif_almacen_comercial' };
const BIG_WH = new Set(['portuario', 'comercial']);

/** Puntos fijos de la ciudad (iguales en todas para que el juego se aprenda una vez). */
export const SPOTS = {
  temple: { x1: 22.4, y1: 19.6 }, office: { x1: 26.6, y1: 12.6 },
  yard: { x1: QX + 0.3, y1: 46.2 }, hull: { x1: QX + 0.1, y1: 45.4 },
  stables: { x1: 0.6, y1: 34.1 }, stablesArea: { x0: -6.3, y0: 28.4, x1: 0.9, y1: 34.4 },
  gate: { x1: 0.6, y1: 40.0 }, faro: { x: QX + 7, y: 4.5 },
  docks: [11, 20.5, 30] as number[], dockX: QX + 1.35,
  road: [[1.5, 33.4], [1.5, 36.6], [-1.6, 36.6], [-1.6, 43.5]] as [number, number][],
  plaza: { x: 19, y: 22 }, quay: { x: 31, y: 24 },
};

export class World {
  iso: Iso;
  W: number; H: number;
  city = 'tiro';
  terrain!: HTMLCanvasElement;
  statics: Sprite[] = [];
  blocked: Rect[] = [];              // plantas de edificios: nadie camina por ahí
  lots: Lot[] = [];
  whSlots = WH_SLOTS;
  road = SPOTS.road;
  foreign: { cls: ShipClass; dir: 'se' | 'so'; x: number; y: number; sail: 'izada' | 'recogida'; phase: number }[] = [];
  boats: { x: number; y: number; dir: 'se' | 'so'; t: number; span: number; phase: number }[] = [];
  workshops: { id: string; art: string; x1: number; y1: number }[] = [];

  constructor() {
    const iso = new Iso(U, 0, 0);
    const xs = [iso.p(BOUNDS.x0, BOUNDS.y1)[0], iso.p(BOUNDS.x1, BOUNDS.y0)[0]];
    const ys = [iso.p(BOUNDS.x0, BOUNDS.y0, 4)[1], iso.p(BOUNDS.x1, BOUNDS.y1)[1]];
    this.W = Math.ceil(xs[1] - xs[0]); this.H = Math.ceil(ys[1] - ys[0]);
    iso.ox = -xs[0]; iso.oy = -ys[0];
    this.iso = iso;
  }

  /** Hornea terreno, sombras y piezas fijas de una ciudad. */
  bake(city: string) {
    this.city = city;
    const L = CITY_LAYOUT[city] ?? CITY_LAYOUT.tiro;
    this.lots = LOT_DEFS.map(d => { const f = footprintOf(d.art, d.ax, d.ay) ?? { x0: d.ax - 2, y0: d.ay - 2, x1: d.ax, y1: d.ay }; return { ...d, ...f }; });
    const gate = footprintOf('edif_puerta_ciudad', SPOTS.gate.x1, SPOTS.gate.y1)!;
    setCoast(L.coast, [...this.lots, ...WH_SLOTS, SPOTS.stablesArea, { x0: 14.8, y0: 13.8, x1: 25, y1: 28.6 }, { x0: gate.x0 - 6, y0: gate.y0, x1: gate.x1 + 6.5, y1: gate.y1 },
      footprintOf('edif_templo_melqart', SPOTS.temple.x1, SPOTS.temple.y1)!, footprintOf('edif_oficina_puerto', SPOTS.office.x1, SPOTS.office.y1)!, { ...footprintOf('edif_astillero', SPOTS.yard.x1, SPOTS.yard.y1)!, x1: QX - 0.5 },
      { x0: -2.5, y0: 33, x1: 2.5, y1: 44 }]);
    const fixed = compose(this, L);
    const c = new Canvas(this.W, this.H);
    paintTerrain(c, this.iso);
    for (const d of [pier(QX, 15.3, QX + 2.6, 16.1), pier(QX, 24.9, QX + 2.6, 25.7)]) d.draw(c, this.iso);
    // Camino de tierra de las caballerizas a la puerta de la ciudad
    for (let i = 0; i + 1 < this.road.length; i++) {
      const [ax, ay] = this.road[i], [bx, by] = this.road[i + 1];
      const x0 = Math.min(ax, bx) - 0.55, x1 = Math.max(ax, bx) + 0.55, y0 = Math.min(ay, by) - 0.55, y1 = Math.max(ay, by) + 0.55;
      c.poly([this.iso.p(x0, y0, HQ), this.iso.p(x1, y0, HQ), this.iso.p(x1, y1, HQ), this.iso.p(x0, y1, HQ)], (sx, sy) => { const [wx, wy] = this.iso.inv(sx, sy, HQ); return isLand(wx, wy) ? shade(R.dirt, 0.55 + ((sx * 7 + sy * 3) % 5) * 0.03, sx, sy) : null; });
    }
    // Sombras proyectadas + sombra de contacto de todos los edificios fijos, y zonas sin paso
    this.blocked = [];
    for (const st of fixed.buildings) {
      const f = footprintOf(st.art, st.x1, st.y1); if (!f) continue;
      if (!st.walk) this.blocked.push(f);
      if (st.shadowH) { shadePoly(c, shadowPoly(this.iso, f.x0, f.y0, f.x1, f.y1, st.shadowH)); contact(c, this.iso, f); }
    }
    for (const t of fixed.trees) for (let j = -3; j <= 3; j++) for (let i = -2; i <= 14; i++) if ((i - 5) ** 2 / 81 + j * j / 9 < 1) { const [px, py] = this.iso.p(t.x, t.y, HQ); c.darken(px + i, py + j + 1, 0.78); }
    for (const l of this.lots) this.blocked.push(l);
    for (const w of WH_SLOTS) this.blocked.push(w);
    this.blocked.push(SPOTS.stablesArea);
    this.terrain = toCanvas(c);
    // Piezas fijas
    this.statics = [];
    for (const st of fixed.buildings) { const sp = this.buildingSprite(st.art, st.x1, st.y1, st.id, st.label); if (sp) this.statics.push(sp); }
    for (const t of fixed.trees) { const sp = this.objSprite(`objetos/${t.art}`, t.art, t.x, t.y); if (sp) this.statics.push(sp); }
    for (const o of fixed.props) { const sp = this.objSprite(o.path, o.art, o.x, o.y, o.key); if (sp) this.statics.push(sp); }
    this.workshops = fixed.workshops;
    // Barcos extranjeros fondeados y barcas de pesca (decorado)
    const r = rng(L.seed + 5);
    const spots: [number, number][] = [[41, 17], [44, 33], [38.5, 41], [46, 24]];
    this.foreign = spots.slice(0, L.foreign).map(([x, y], i) => ({ cls: (['mercante', 'galera_alquiler', 'mercante', 'avanzado'] as ShipClass[])[i], dir: i % 2 ? 'so' : 'se', x, y, sail: i % 2 ? 'izada' : 'recogida', phase: i * 3 + 1 }));
    this.boats = [{ x: 37, y: 6, dir: 'so', t: r() * 100, span: 14, phase: 0 }, { x: 34, y: 50, dir: 'se', t: r() * 100, span: 9, phase: 2 }];
  }

  buildingSprite(art: string, x1: number, y1: number, id?: string, label?: string, keyAdd = 0): Sprite | null {
    const im = getImg(`edificios/${art}`);
    if (!im) return null;
    const [px, py] = this.iso.p(x1, y1, HQ);
    const x = Math.round(px - im.bx), y = Math.round(py - im.h + 1);
    return { id, label, src: im.el, sx: 0, sy: 0, sw: im.w, sh: im.h, x, y, key: x1 + y1 + keyAdd, mask: { m: im.mask, w: im.w, ox: x, oy: y } };
  }

  /** Objeto apoyado en su pivote (árboles, cajas, rocas…). z = altura del suelo. */
  objSprite(path: string, art: string, x: number, y: number, key = x + y + 0.1, z = HQ): Sprite | null {
    const im = getImg(path);
    if (!im) return null;
    const [px, py] = this.iso.p(x, y, z), [ax, ay] = PIVOT[art] ?? [im.bx, im.h - 1];
    return { src: im.el, sx: 0, sy: 0, sw: im.w, sh: im.h, x: Math.round(px - ax), y: Math.round(py - ay), key };
  }

  /** Fotograma f de una tira con su pivote en (x, y). */
  stripSprite(st: Strip, f: number, x: number, y: number, flip = false, z = HQ, key = x + y + 0.15): Sprite {
    const [px, py] = this.iso.p(x, y, z);
    const ax = flip ? st.fw - 1 - st.px : st.px;
    return { src: st.img.el, sx: st.frames[f].x, sy: 0, sw: st.fw, sh: st.fh, x: Math.round(px - ax), y: Math.round(py - st.py), key, flip };
  }

  /**
   * Barco en el agua con su pivote (centro de la línea de flotación) en (x, y).
   * vela: 'izada' | 'recogida' | 'remos' (tira de 4 fotogramas, t en ms).
   */
  shipSprite(cls: ShipClass, dir: 'se' | 'so', sail: 'izada' | 'recogida' | 'remos', x: number, y: number, t = 0, id?: string): Sprite | null {
    const a = SHIP_ART[cls], rem = getStrip(`barcos/barco_${a}_${dir}_remos`);
    const meta = metas.get(`barcos/barco_${a}_${dir}_remos`);
    const key = x + y + 0.5;
    if (sail === 'remos' && rem) {
      const total = rem.frames.reduce((q, f) => q + f.ms, 0); let m = t % total, f = 0;
      for (const fr of rem.frames) { if (m < fr.ms) break; m -= fr.ms; f++; }
      return { ...this.stripSprite(rem, Math.min(f, rem.frames.length - 1), x, y, false, 0, key), id };
    }
    const im = getImg(`barcos/barco_${a}_${dir}_${sail === 'remos' ? 'recogida' : sail}`), rec = getImg(`barcos/barco_${a}_${dir}_recogida`);
    if (!im || !rec) return null;
    const off = meta?.offset_sprite_quieto ?? { x: 0, y: 0 }, piv = meta?.pivote ?? { x: im.w / 2, y: rec.h - 1 };
    const pxv = piv.x - off.x, pyv = piv.y - off.y + (im.h - rec.h);
    const [px, py] = this.iso.p(x, y, 0);
    const sx = Math.round(px - pxv), sy = Math.round(py - pyv);
    return { id, src: im.el, sx: 0, sy: 0, sw: im.w, sh: im.h, x: sx, y: sy, key, mask: id ? { m: im.mask, w: im.w, ox: sx, oy: sy } : undefined };
  }

  isBlocked(x: number, y: number): boolean {
    return this.blocked.some(b => x > b.x0 - 0.2 && x < b.x1 + 0.2 && y > b.y0 - 0.2 && y < b.y1 + 0.2);
  }

  /** Solar de almacén para el i-ésimo almacén del jugador (los grandes van a los solares grandes). */
  warehousePlaces(s: GameState): { uid: string; def: string; owned: boolean; slot: Rect }[] {
    const smalls = WH_SLOTS.filter(w => !w.big), bigs = WH_SLOTS.filter(w => w.big);
    const out: { uid: string; def: string; owned: boolean; slot: Rect }[] = [];
    for (const w of s.warehouses) {
      const pool = BIG_WH.has(w.defId) ? bigs : smalls;
      const slot = pool.shift(); if (!slot) continue;
      out.push({ uid: w.uid, def: w.defId, owned: w.owned, slot });
    }
    return out;
  }

  /** Piezas que dependen del estado del jugador: puestos, locales, almacenes, caballerizas, talleres y marcas. */
  playerSprites(s: GameState, cache: Map<string, Sprite>, fresh: Map<string, number>, now: number): Sprite[] {
    const out: Sprite[] = [];
    const get = (k: string, make: () => Sprite | null) => { if (!cache.has(k)) { const v = make(); if (v) cache.set(k, v); } return cache.get(k) ?? null; };
    const mark = (sp: Sprite, art: 'marca_propio' | 'marca_alquilado' | 'marca_lleno', dx = 0) => {
      const m = getImg(`marcas/${art}`); if (!m) return;
      out.push({ src: m.el, sx: 0, sy: 0, sw: m.w, sh: m.h, x: Math.round(sp.x + sp.sw * 0.5 - 3 + dx), y: Math.round(sp.y - m.h + 10), key: sp.key + 0.01 });
    };
    // Andamio sobre lo recién ocupado o mejorado (unos segundos)
    const scaffold = (k: string, sp: Sprite) => {
      const t0 = fresh.get(k); if (t0 === undefined || now - t0 > 12000) return;
      const m = getImg('marcas/marca_andamio'); if (!m) return;
      out.push({ src: m.el, sx: 0, sy: 0, sw: m.w, sh: m.h, x: Math.round(sp.x + sp.sw / 2 - m.w / 2), y: Math.round(sp.y + sp.sh - m.h), key: sp.key + 0.02 });
    };
    for (const lot of this.lots) {
      if (lot.kind === 'venue') {
        const v = s.venues.find(x => x.defId === lot.ref);
        if (v) {
          const sp = get(`v:${lot.ref}`, () => this.buildingSprite(lot.art, lot.ax, lot.ay, `lot:${lot.id}`, lot.label));
          if (sp) {
            out.push(sp); mark(sp, v.owned ? 'marca_propio' : 'marca_alquilado');
            if (fullVenue(s, lot.ref!)) mark(sp, 'marca_lleno', 10);
            scaffold(`v:${lot.ref}`, sp);
            if (lot.counter) { const c = get(`c:${lot.id}`, () => this.objSprite(`objetos/${lot.counter}`, lot.counter!, lot.ax + 0.55, lot.y0 + (lot.y1 - lot.y0) / 2, lot.ax + lot.y1 + 0.3)); if (c) out.push(c); }
          }
        } else { const sp = get(`e:${lot.id}`, () => this.solar(lot)); if (sp) out.push(sp); }
      } else if (lot.kind === 'ambulante') {
        if (!s.venues.length) { const sp = get('amb', () => this.buildingSprite(lot.art, lot.ax, lot.ay, 'lot:ambulante', 'Tu puesto')); if (sp) out.push(sp); }
      }
    }
    const places = this.warehousePlaces(s);
    for (const p of places) {
      const art = WH_ART[p.def], im = getImg(`edificios/${art}`); if (!im) continue;
      const fw = im.bx / U, fd = (im.w - im.bx) / U, sw = p.slot.x1 - p.slot.x0, sd = p.slot.y1 - p.slot.y0;
      const x1 = p.slot.x0 + fw + Math.max(0, (sw - fw) / 2), y1 = p.slot.y0 + fd + Math.max(0, (sd - fd) / 2);
      const sp = get(`w:${p.uid}:${p.def}`, () => this.buildingSprite(art, x1, y1, 'lot:almacenes', 'Almacén'));
      if (sp) { out.push(sp); mark(sp, p.owned ? 'marca_propio' : 'marca_alquilado'); scaffold(`w:${p.uid}`, sp); }
    }
    // Solar libre para el próximo almacén pequeño/mediano/grande
    const usedSmall = places.filter(p => !BIG_WH.has(p.def)).length, smalls = WH_SLOTS.filter(w => !w.big);
    if (usedSmall < smalls.length) {
      const slot = smalls[usedSmall];
      const sp = get(`we:${usedSmall}`, () => this.solar({ ...slot } as any, 'lot:almacenes', 'Solar · Almacén'));
      if (sp) out.push(sp);
    }
    // Caballerizas (nivel 1 o ampliadas)
    const lvl2 = s.stables?.level === 2;
    const st = get(`st:${lvl2 ? 2 : 1}`, () => this.buildingSprite(lvl2 ? 'edif_caballerizas_2' : 'edif_caballerizas', SPOTS.stables.x1, SPOTS.stables.y1, 'caballerizas', 'Caballerizas'));
    if (st) { out.push(st); if (s.stables) { mark(st, s.stables.owned ? 'marca_propio' : 'marca_alquilado'); scaffold('stables', st); } }
    // Talleres en los que tienes parte
    for (const w of this.workshops) if (s.workshops?.includes(w.id)) { const sp = this.statics.find(x => x.id === `taller:${w.id}`); if (sp) mark(sp, 'marca_propio'); }
    // Astillero propio
    if (s.hasShipyard || s.shipyardRented) { const sp = this.statics.find(x => x.id === 'astillero'); if (sp) mark(sp, s.hasShipyard ? 'marca_propio' : 'marca_alquilado'); }
    return out;
  }

  /** Solar libre: la marca PNG centrada en el solar. */
  solar(lot: Rect, id = `lot:${(lot as Lot).id}`, label = `Solar · ${(lot as Lot).label}`): Sprite | null {
    const cx = (lot.x0 + lot.x1) / 2 + 1, cy = (lot.y0 + lot.y1) / 2 + 1;
    const sp = this.objSprite('marcas/marca_solar', 'marca_solar', cx, cy, lot.x1 + lot.y1);
    if (!sp) return null;
    const im = getImg('marcas/marca_solar')!;
    return { ...sp, id, label, mask: { m: im.mask, w: im.w, ox: sp.x, oy: sp.y } };
  }

  /** Punto del camino de las carretas (t de 0 a 1) y su dirección. */
  roadPoint(t: number): { x: number; y: number; dir: 'ne' | 'no' | 'se' | 'so' } {
    const R2 = this.road, segs = R2.slice(1).map((p, i) => Math.hypot(p[0] - R2[i][0], p[1] - R2[i][1]));
    let d = Math.max(0, Math.min(1, t)) * segs.reduce((a, b) => a + b, 0);
    for (let i = 0; i < segs.length; i++) {
      if (d <= segs[i] || i === segs.length - 1) {
        const k = Math.min(1, d / segs[i]), a = R2[i], b = R2[i + 1], dx = b[0] - a[0], dy = b[1] - a[1];
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'se' : 'no') : (dy > 0 ? 'so' : 'ne');
        return { x: a[0] + dx * k, y: a[1] + dy * k, dir };
      }
      d -= segs[i];
    }
    return { x: R2[0][0], y: R2[0][1], dir: 'so' };
  }
}

function fullVenue(s: GameState, ref: string): boolean {
  const n = s.workers.filter(w => w.venueId === ref).length;
  const slots: Record<string, number> = { puesto_plaza: 2, puesto_puerto: 2, puesto_templo: 3, local_alfareros: 3, local_mercado: 4, casa_comercio: 6, gran_bazar: 8 };
  return n >= (slots[ref] ?? 99);
}

function shadowPoly(iso: Iso, x0: number, y0: number, x1: number, y1: number, h: number): [number, number][] {
  const L = h * 0.9;
  return [iso.p(x0, y0, HQ), iso.p(x1 + L, y0, HQ), iso.p(x1 + L, y1, HQ), iso.p(x0, y1, HQ)];
}
/** Sombra de contacto: un borde oscuro de 1-2 px alrededor de la planta, que asienta el edificio. */
function contact(c: Canvas, iso: Iso, f: Rect) {
  const pts = [iso.p(f.x0 - 0.12, f.y1 + 0.12, HQ), iso.p(f.x1 + 0.12, f.y1 + 0.12, HQ), iso.p(f.x1 + 0.12, f.y0 - 0.12, HQ)];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let k = 0; k <= n; k++) { const x = ax + (bx - ax) * k / n, y = ay + (by - ay) * k / n; c.darken(x, y, 0.6); c.darken(x, y + 1, 0.75); }
  }
}

function toCanvas(c: Canvas): HTMLCanvasElement {
  const el = document.createElement('canvas'); el.width = c.W; el.height = c.H;
  el.getContext('2d')!.putImageData(new ImageData(c.data, c.W, c.H), 0, 0);
  return el;
}

// ---------------------------------------------------------------------------- composición de la ciudad
interface Fixed { art: string; x1: number; y1: number; shadowH: number; id?: string; label?: string; walk?: boolean }
interface Composition { buildings: Fixed[]; trees: { art: string; x: number; y: number }[]; props: { path: string; art: string; x: number; y: number; key?: number }[]; workshops: { id: string; art: string; x1: number; y1: number }[] }

function compose(w: World, L: CityLayout): Composition {
  const r = rng(L.seed);
  const out: Composition = { buildings: [], trees: [], props: [], workshops: [] };
  out.buildings.push({ art: 'edif_templo_melqart', ...SPOTS.temple, shadowH: 3, id: 'templo', label: '{templo}' });
  out.buildings.push({ art: 'edif_oficina_puerto', ...SPOTS.office, shadowH: 3.2, id: 'oficina', label: 'Oficina del puerto' });
  out.buildings.push({ art: 'edif_astillero', ...SPOTS.yard, shadowH: 1.2, id: 'astillero', label: 'Astillero' });
  // Puerta de la ciudad con su muralla, por donde salen las carretas
  const g = SPOTS.gate, gf = footprintOf('edif_puerta_ciudad', g.x1, g.y1)!;
  out.buildings.push({ art: 'edif_puerta_ciudad', ...g, shadowH: 2.2, id: 'puerta', label: 'Puerta de la ciudad' });
  const wallY = g.y1;
  for (const [art, x1, y1] of [['muralla_tramo', gf.x0, wallY], ['muralla_torre', gf.x0 - 4, wallY + 0.5], ['muralla_tramo', g.x1 + 4, wallY], ['muralla_torre', g.x1 + 6, wallY + 0.5]] as [string, number, number][]) {
    const f = footprintOf(art, x1, y1); if (f && [[f.x0, f.y0], [f.x1, f.y1], [f.x0, f.y1], [f.x1, f.y0]].every(([x, y]) => coastDist(x, y) > 0.8)) out.buildings.push({ art, x1, y1, shadowH: 1.4 });
  }
  const reservedRects: Rect[] = [
    ...w.lots, ...WH_SLOTS, SPOTS.stablesArea,
    { x0: 14.8, y0: 13.8, x1: 25, y1: 28.6 },                                    // plaza
    footprintOf('edif_oficina_puerto', SPOTS.office.x1, SPOTS.office.y1)!, footprintOf('edif_astillero', SPOTS.yard.x1, SPOTS.yard.y1)!,
    { x0: gf.x0 - 6.3, y0: wallY - 2.2, x1: g.x1 + 6.5, y1: wallY + 0.8 },       // puerta y muralla
  ];
  for (let i = 0; i + 1 < SPOTS.road.length; i++) { const [ax, ay] = SPOTS.road[i], [bx, by] = SPOTS.road[i + 1]; reservedRects.push({ x0: Math.min(ax, bx) - 0.8, y0: Math.min(ay, by) - 0.8, x1: Math.max(ax, bx) + 0.8, y1: Math.max(ay, by) + 0.8 }); }
  const reserved = (x0: number, y0: number, x1: number, y1: number) => x1 > QX - 3.2 || reservedRects.some(l => x0 < l.x1 + 0.3 && x1 > l.x0 - 0.3 && y0 < l.y1 + 0.3 && y1 > l.y0 - 0.3);
  const dims = (art: string) => { const im = getImg(`edificios/${art}`); return { w: im ? im.bx / U : 2.5, l: im ? (im.w - im.bx) / U : 2.5, h: im ? im.h / 40 : 1.6 }; };
  const small = ['casa_01', 'casa_05', 'casa_07', 'casa_09'], big = ['casa_02', 'casa_03', 'casa_04', 'casa_06', 'casa_08'];
  const shops = WORKSHOPS.map(x => x.id);
  // Talleres: los 5 siempre, en las manzanas libres más cercanas al centro (orden distinto en cada ciudad)
  const order = shops.map(id => ({ id, k: r() })).sort((a, b) => a.k - b.k).map(x => x.id);
  const blocks: [number, number][] = [];
  for (let bx = BOUNDS.x0; bx < QX; bx += STREET) for (let by = BOUNDS.y0; by < BOUNDS.y1; by += STREET) blocks.push([bx, by]);
  const shopBlocks = new Set<string>();
  const cand = [...blocks].sort((a, b) => Math.hypot(a[0] + 3.5 - 10, a[1] + 3.5 - 24) - Math.hypot(b[0] + 3.5 - 10, b[1] + 3.5 - 24) + (r() - 0.5) * 6);
  for (const [bx, by] of cand) {
    if (!order.length) break;
    const id = order[0], wd = WORKSHOPS.find(x => x.id === id)!, d = dims(wd.art);
    const ix = bx + 1.6, iy = by + 1.6, x1 = ix + d.w, y1 = iy + d.l;
    if (reserved(ix, iy, x1, y1) || ![[ix, iy], [x1, iy], [ix, y1], [x1, y1]].every(([x, y]) => coastDist(x, y) > 1.6)) continue;
    order.shift(); shopBlocks.add(`${bx},${by}`);
    out.buildings.push({ art: wd.art, x1, y1, shadowH: d.h, id: `taller:${id}`, label: wd.name });
    out.workshops.push({ id, art: wd.art, x1, y1 });
  }
  for (let bx = BOUNDS.x0; bx < QX; bx += STREET) for (let by = BOUNDS.y0; by < BOUNDS.y1; by += STREET) {
    const ix = bx + 1.6, iy = by + 1.6;
    const isBig = r() < 0.4;
    if (shopBlocks.has(`${bx},${by}`)) { if (!reserved(ix + 3.6, iy + 3.6, ix + 5, iy + 5) && coastDist(ix + 4.3, iy + 4.3) > 1.6) out.trees.push({ art: L.trees[Math.floor(r() * L.trees.length)], x: ix + 4.3, y: iy + 4.3 }); continue; }
    const slots: [number, number][] = isBig ? [[ix, iy]] : [[ix, iy], [ix + 2.75, iy], [ix, iy + 2.75], [ix + 2.75, iy + 2.75]];
    for (const [sx, sy] of slots) {
      const art = isBig ? big[Math.floor(r() * big.length)] : small[Math.floor(r() * small.length)], d = dims(art);
      const x1 = sx + d.w, y1 = sy + d.l;
      const ok = [[sx, sy], [x1, sy], [sx, y1], [x1, y1]].every(([x, y]) => coastDist(x, y) > 1.6);
      if (reserved(sx, sy, x1, y1) || !ok || x1 > bx + STREET || y1 > by + STREET) continue;
      if (!isBig && r() < 0.15) { out.trees.push({ art: L.trees[Math.floor(r() * L.trees.length)], x: sx + 1.3, y: sy + 1.3 }); continue; }
      out.buildings.push({ art, x1, y1, shadowH: d.h });
    }
    if (isBig && !reserved(ix + 3.3, iy + 3.3, ix + 5, iy + 5) && coastDist(ix + 4.2, iy + 4.2) > 1.6) out.trees.push({ art: L.trees[Math.floor(r() * L.trees.length)], x: ix + 4.2, y: iy + 4.2 });
  }
  // Plaza y muelle
  for (const [art, x, y] of [['arbol_palmera_01', 15.3, 15.2], ['arbol_palmera_02', 15.3, 20.5], ['arbol_cipres_01', 23.8, 14.4], ['arbol_cipres_02', 24.4, 19.4], ['arbol_palmera_01', 24.6, 27.8], ['arbol_cedro_01', 14.8, 27.6]] as [string, number, number][]) out.trees.push({ art, x, y });
  // Árboles sueltos en las calas y playas de la costa
  for (let i = 0; i < 500 && out.trees.length < 80; i++) {
    const x = BOUNDS.x0 + r() * (QX - BOUNDS.x0), y = BOUNDS.y0 + r() * (BOUNDS.y1 - BOUNDS.y0), d = coastDist(x, y);
    if (d > 0.5 && d < 1.2 && groundAt(x, y) === 'playa' && !reserved(x - 0.5, y - 0.5, x + 0.5, y + 0.5)) out.trees.push({ art: r() < L.palms ? (r() < 0.5 ? 'arbol_palmera_01' : 'arbol_palmera_02') : L.trees[Math.floor(r() * L.trees.length)], x, y });
  }
  const prop = (art: string, x: number, y: number, key?: number) => out.props.push({ path: `objetos/${art}`, art, x, y, key });
  const quay: [string, number, number][] = [['obj_cajas_03', 26.8, 14.2], ['obj_anforas', 27.2, 17.6], ['obj_sacos', 26.9, 22.4], ['obj_grua', 27.6, 19.2], ['obj_cajas_01', 27.3, 24], ['obj_fardos_purpura', 27, 29.6], ['obj_toneles', 27.3, 33.6], ['obj_sacos', 27.2, 36.4], ['obj_grua', 27.6, 37.8], ['obj_cofre', 26.9, 31.8], ['obj_cajas_03', 20.8, 28.6], ['obj_anforas', 14.9, 24.6], ['obj_lingotes', 26.8, 26.4]];
  for (const [art, x, y] of quay) prop(art, x, y);
  // Astillero: troncos de cedro; caballerizas: heno, abrevadero y rueda
  prop('obj_troncos_cedro', 17.7, 45.8); prop('obj_troncos_cedro', 17.9, 43.2);
  prop('obj_heno', 1.6, 29.4); prop('obj_abrevadero', 2.0, 31.2); prop('obj_rueda_carro', -6.8, 33.8); prop('obj_heno', -6.9, 31.6);
  // Costa: escollera con faro al norte del muelle, rocas en el agua, acantilados y playas
  const f = SPOTS.faro;
  for (let i = 0; i < 2; i++) out.props.push({ path: 'costa/escollera', art: 'escollera', x: QX + 3.05 * (i + 1), y: f.y, key: QX + 3 * i + f.y });
  for (let i = 0, n = 0; i < 3000 && n < 30; i++) {
    const x = BOUNDS.x0 + r() * (BOUNDS.x1 - BOUNDS.x0), y = BOUNDS.y0 + r() * (BOUNDS.y1 - BOUNDS.y0), d = coastDist(x, y);
    if (x > QX - 2 && y > 0 && y < 50) continue;
    if (d < -0.15 && d > -1.1) { const art = `roca_0${1 + Math.floor(r() * 6)}`; out.props.push({ path: `costa/${art}`, art, x, y, key: x + y }); n++; }
  }
  for (let i = 0, n = 0; i < 3000 && n < 12; i++) {
    const x = BOUNDS.x0 + r() * (QX - 3 - BOUNDS.x0), y = BOUNDS.y0 + r() * (BOUNDS.y1 - BOUNDS.y0), d = coastDist(x, y);
    if (d > 0.05 && d < 0.35 && groundAt(x, y) !== 'playa' && !reserved(x - 1, y - 1, x + 1, y + 1)) { const art = `acantilado_0${1 + Math.floor(r() * 2)}`; out.props.push({ path: `costa/${art}`, art, x, y, key: x + y }); n++; }
  }
  for (let i = 0, n = 0; i < 3000 && n < 10; i++) {
    const x = BOUNDS.x0 + r() * (QX - 3 - BOUNDS.x0), y = BOUNDS.y0 + r() * (BOUNDS.y1 - BOUNDS.y0), d = coastDist(x, y);
    if (d > 0.4 && d < 1.0 && groundAt(x, y) === 'playa' && !reserved(x - 1, y - 1, x + 1, y + 1)) { const art = `playa_0${1 + Math.floor(r() * 3)}`; out.props.push({ path: `costa/${art}`, art, x, y, key: x + y - 2 }); n++; }
  }
  return out;
}

// ---------------------------------------------------------------------------- gente que camina
export interface Walker { art: string; x: number; y: number; dir: [number, number]; speed: number; t: number; until: number; zone?: 'muelle' }

const walkable = (w: World, x: number, y: number, zone?: 'muelle') => {
  if (!isLand(x, y) || x > QX - 0.4 || w.isBlocked(x, y)) return false;
  const g = groundAt(x, y);
  if (zone === 'muelle') return g === 'muelle';
  return g === 'calle' || g === 'plaza' || g === 'muelle';
};
export function spawnWalkers(w: World, n: number, seed = 5): Walker[] {
  const r = rng(seed), out: Walker[] = [];
  for (let i = 0; i < n; i++) out.push(newWalker(w, r, i));
  return out;
}
/** Paseantes: clientes, porteadores y forasteros por las calles; marineros en el muelle; un sacerdote y guardias. */
export function newWalker(w: World, r: () => number, i = 0): Walker {
  const sailor = i % 9 === 4, art = sailor ? 'pj_marinero' : i % 23 === 7 ? 'pj_sacerdote' : i % 17 === 3 ? 'pj_guardia' : CLIENTS[Math.floor(r() * CLIENTS.length)];
  for (let k = 0; k < 80; k++) {
    let x: number, y: number, alongX: boolean;
    if (sailor) { alongX = false; x = QX - 1 - r() * 1.4; y = 6 + r() * 38; }
    else { alongX = r() < 0.5; const line = Math.floor(r() * 12) * STREET + BOUNDS.x0 - 1 + 0.7; x = alongX ? BOUNDS.x0 + r() * (QX - BOUNDS.x0) : line; y = alongX ? line : BOUNDS.y0 + r() * (BOUNDS.y1 - BOUNDS.y0); }
    if (!walkable(w, x, y, sailor ? 'muelle' : undefined)) continue;
    const sgn = r() < 0.5 ? 1 : -1;
    return { art, x, y, dir: alongX ? [sgn, 0] : [0, sgn], speed: 0.55 + r() * 0.35, t: r() * 1000, until: 4 + r() * 10, zone: sailor ? 'muelle' : undefined };
  }
  return { art: CLIENTS[0], x: 20, y: 25.5, dir: [1, 0], speed: 0.6, t: 0, until: 5 };
}
/** Avanza a un caminante; gira en los cruces y da media vuelta ante un edificio o la costa. mult acelera el paso (×6). */
export function stepWalker(w: World, wk: Walker, dt: number, r: () => number, mult = 1): void {
  wk.t += dt * 1000 * mult;
  const v = wk.speed * mult;
  const nx = wk.x + wk.dir[0] * v * dt, ny = wk.y + wk.dir[1] * v * dt;
  wk.until -= dt * mult;
  if (!walkable(w, nx, ny, wk.zone) || wk.until < 0) {
    const atCross = (((nx % STREET) + STREET) % STREET < 1.4) && (((ny % STREET) + STREET) % STREET < 1.4);
    wk.dir = wk.zone ? [0, -wk.dir[1]] : atCross && r() < 0.6 ? (wk.dir[0] ? [0, r() < 0.5 ? 1 : -1] : [r() < 0.5 ? 1 : -1, 0]) : [-wk.dir[0], -wk.dir[1]] as [number, number];
    wk.until = 3 + r() * 10;
    return;
  }
  wk.x = nx; wk.y = ny;
}
