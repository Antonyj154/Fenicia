// ============================================================================
// FENICIA · Kit de pixel art (receta del plato pixelArt de anidoodle)
// Una cuadrícula indexada a una paleta de 16 colores. Cada celda es UN color de la paleta;
// los medios tonos son dither 2x2 ordenado, nunca transparencia. Se amplía por un entero.
// Puro y determinista: sin reloj, sin Math.random (usar rng(seed)).
// ============================================================================

export const PAL = [
  '#1d1626', // 0  tinta
  '#143d59', // 1  mar profundo
  '#1f6f8b', // 2  mar
  '#2fa6a6', // 3  turquesa somero
  '#bde5e0', // 4  cielo
  '#4e8b3a', // 5  verde palmera
  '#8b6b4b', // 6  piedra oscura
  '#c59b69', // 7  piedra
  '#e8cf9d', // 8  arena
  '#fbf4e4', // 9  crema
  '#c8562f', // 10 terracota
  '#84341f', // 11 terracota oscura
  '#5b3b23', // 12 madera oscura
  '#9a643b', // 13 madera
  '#7b1f5d', // 14 púrpura de Tiro
  '#f2b53d', // 15 oro
] as const;
export const C = { ink: 0, deep: 1, sea: 2, shallow: 3, sky: 4, green: 5, stoneDk: 6, stone: 7, sand: 8, cream: 9, terra: 10, terraDk: 11, woodDk: 12, wood: 13, purple: 14, gold: 15 } as const;
export const T = -1; // transparente (sólo en sprites)

export function rng(seed: number) {
  let s = seed | 0;
  return () => { let t = (s = (s + 0x6d2b79f5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const BAYER = [[0, 2], [3, 1]];

export class Grid {
  readonly buf: Int8Array;
  constructor(readonly W: number, readonly H: number, fill = T) { this.buf = new Int8Array(W * H).fill(fill); }
  get(x: number, y: number) { return x < 0 || y < 0 || x >= this.W || y >= this.H ? T : this.buf[y * this.W + x]; }
  px(x: number, y: number, c: number) {
    x = Math.round(x); y = Math.round(y);
    if (c === T || x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    this.buf[y * this.W + x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: number) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c); }
  /** Medio tono: mezcla a y b con densidad 0..4 (de 4) en patrón Bayer 2x2. */
  dith(x: number, y: number, w: number, h: number, a: number, b: number, level: number) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, BAYER[j & 1][i & 1] < level ? b : a);
  }
  hline(x0: number, x1: number, y: number, c: number) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.px(x, y, c); }
  vline(x: number, y0: number, y1: number, c: number) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.px(x, y, c); }
  /** Bresenham: un píxel por paso en el eje mayor, nunca dobles. */
  line(x0: number, y0: number, x1: number, y1: number, c: number) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    for (;;) { this.px(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  /** Rellena las celdas cuyo centro cae dentro del polígono; devuelve la máscara. */
  poly(pts: [number, number][], c: number | ((x: number, y: number) => number)) {
    const cells: [number, number][] = [];
    const ys = pts.map(p => p[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(this.H - 1, Math.ceil(Math.max(...ys))); y++) {
      const yc = y + 0.5, xs: number[] = [];
      for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; if ((y0 <= yc) !== (y1 <= yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0)); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) cells.push([x, y]);
    }
    for (const [x, y] of cells) this.px(x, y, typeof c === 'function' ? c(x, y) : c);
    return cells;
  }
  /** Estampa un sprite ASCII. '.' = transparente; el resto por el mapa de caracteres. */
  stamp(spr: Sprite, x: number, y: number, flip = false) {
    for (let j = 0; j < spr.h; j++) for (let i = 0; i < spr.w; i++) {
      const c = spr.px[j * spr.w + i];
      if (c !== T) this.px(x + (flip ? spr.w - 1 - i : i), y + j, c);
    }
  }
  /** Contorno exterior de 1 celda alrededor de lo pintado (limpio: sólo 4-vecinos, sin esquinas dobles). */
  outline(c: number) {
    const add: number[] = [];
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      if (this.get(x, y) !== T) continue;
      if (this.get(x - 1, y) !== T || this.get(x + 1, y) !== T || this.get(x, y - 1) !== T || this.get(x, y + 1) !== T) add.push(y * this.W + x);
    }
    for (const i of add) this.buf[i] = c;
  }
}

export interface Sprite { w: number; h: number; px: Int8Array }

/** Sprite a partir de filas ASCII y un mapa carácter → índice de paleta. */
export function sprite(rows: string[], map: Record<string, number>): Sprite {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const px = new Int8Array(w * h).fill(T);
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.' && ch !== ' ') { const c = map[ch]; if (c === undefined) throw new Error(`Carácter sin color: ${ch}`); px[j * w + i] = c; } }));
  return { w, h, px };
}
export function gridSprite(g: Grid): Sprite { return { w: g.W, h: g.H, px: g.buf }; }

/** Pinta la cuadrícula en un canvas: celdas enteras, fillRect por tramos, sin suavizado. */
export function blit(ctx: CanvasRenderingContext2D, g: Grid | Sprite, scale: number, ox = 0, oy = 0) {
  const W = 'W' in g ? g.W : g.w, H = 'H' in g ? g.H : g.h, buf = 'buf' in g ? g.buf : g.px;
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      const c = buf[y * W + x];
      let e = x + 1;
      while (e < W && buf[y * W + e] === c) e++;
      if (c !== T) { ctx.fillStyle = PAL[c]; ctx.fillRect(ox + x * scale, oy + y * scale, (e - x) * scale, scale); }
      x = e;
    }
  }
}

/** Hornea un sprite en un canvas propio a una escala entera (para componer cada fotograma rápido). */
export function bake(g: Grid | Sprite, scale: number): HTMLCanvasElement {
  const W = 'W' in g ? g.W : g.w, H = 'H' in g ? g.H : g.h;
  const cv = document.createElement('canvas');
  cv.width = W * scale; cv.height = H * scale;
  const ctx = cv.getContext('2d')!;
  blit(ctx, g, scale);
  return cv;
}
