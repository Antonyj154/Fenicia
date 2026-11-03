// ============================================================================
// FENICIA · Tiro en isométrico: barrio del puerto.
// Composición (mía): la ciudad arriba a la izquierda, un muelle de sillares en diagonal y la
// dársena abajo a la derecha con barcos de vela a rayas. Hitos tocables: Almacén, Mercado,
// Templo de Melqart (dos columnas, oro y esmeralda, según Heródoto), Astillero, Oficina del puerto.
// ============================================================================
import { Canvas, Iso, R, rng, shade, type RGB } from './iso';

export interface Hotspot { id: string; label: string; x: number; y: number }

// ---------------------------------------------------------------------------- mapa del mundo
export const QX = 28;              // línea del muelle: x < QX es tierra
export const HQ = 0.55;            // altura del muelle sobre el agua (unidades)
export const STREET = 7;           // manzanas cada 7 unidades

// ---- La isla de Tiro: costa irregular (ruido) con un único tramo recto, el muelle (x = QX).
export const ISLAND = { cx: 8, cy: 21, rx: 25, ry: 37, quayY0: 5, quayY1: 45, seed: 0, amp: 0.55 };
/**
 * Cada ciudad tiene su propia costa: misma isla de base, otra semilla y otras proporciones.
 * El centro urbano (plaza, muelle y solares) queda siempre en tierra.
 */
export interface CoastCfg { seed: number; cx: number; cy: number; rx: number; ry: number; amp: number }
let keep: { x0: number; y0: number; x1: number; y1: number }[] = [];
/** keep: zonas (edificios, solares, plaza, camino) que deben quedar en tierra, con 2 unidades de margen. */
export function setCoast(c: CoastCfg, keepRects: { x0: number; y0: number; x1: number; y1: number }[] = []) { Object.assign(ISLAND, c); keep = keepRects; mask = null; }
const inCore = (x: number, y: number) => keep.some(r => x > r.x0 - 2.2 && x < r.x1 + 2.2 && y > r.y0 - 2.2 && y < r.y1 + 2.2);
const MASK = { x0: -34, y0: -34, x1: 64, y1: 76, res: 8 };      // 8 celdas por unidad
const MW = (MASK.x1 - MASK.x0) * MASK.res, MH = (MASK.y1 - MASK.y0) * MASK.res;
let mask: Float32Array | null = null;                              // distancia firmada a la costa (+ tierra)

function hashA(i: number) { let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function angNoise(a: number) {
  // Ruido periódico en el ángulo: cabos y entrantes de varias escalas
  let v = 0, amp = 0.55;
  for (let o = 0; o < 5; o++) {
    const n = 5 * (1 << o), f = (a / (2 * Math.PI)) * n, i = Math.floor(f), t = f - i, u = t * t * (3 - 2 * t);
    v += amp * (hashA((((i % n) + n) % n) + o * 97 + ISLAND.seed * 1013) * (1 - u) + hashA(((((i + 1) % n) + n) % n) + o * 97 + ISLAND.seed * 1013) * u - 0.5);
    amp *= 0.55;
  }
  return v;
}
function vn2(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
  const h = (i: number, j: number) => hashA(i * 7919 + j * 104729 + ISLAND.seed * 31337);
  return h(xi, yi) * (1 - u) * (1 - w) + h(xi + 1, yi) * u * (1 - w) + h(xi, yi + 1) * (1 - u) * w + h(xi + 1, yi + 1) * u * w;
}
/** Tierra o agua. El muelle es el único tramo recto (x = QX). */
function landRaw(x: number, y: number): boolean {
  const dx = (x - ISLAND.cx) / ISLAND.rx, dy = (y - ISLAND.cy) / ISLAND.ry;
  const r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  const rr = 1 + angNoise(a) * ISLAND.amp + (vn2(x / 5, y / 5) - 0.5) * 0.34 + (vn2(x / 2, y / 2) - 0.5) * 0.12;
  const inQuay = y > ISLAND.quayY0 && y < ISLAND.quayY1;
  if (inQuay && x > QX - 7) return x < QX;
  if (x >= QX && y > ISLAND.quayY0 - 6 && y < ISLAND.quayY1 + 6) return false;     // la bahía del muelle
  return (r < rr || inCore(x, y)) && !(inQuay && x >= QX);
}
/** Máscara tierra/agua + transformada de distancia (chaflán 3-4) dentro y fuera: distancia real a la orilla. */
function buildMask() {
  const land = new Uint8Array(MW * MH);
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) land[j * MW + i] = landRaw(MASK.x0 + (i + 0.5) / MASK.res, MASK.y0 + (j + 0.5) / MASK.res) ? 1 : 0;
  const dist = (inside: number) => {
    const d = new Float32Array(MW * MH), INF = 1e9;
    for (let k = 0; k < d.length; k++) d[k] = land[k] === inside ? INF : 0;
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      const k = j * MW + i; if (!d[k]) continue;
      let v = d[k];
      if (i > 0) v = Math.min(v, d[k - 1] + 3);
      if (j > 0) v = Math.min(v, d[k - MW] + 3);
      if (i > 0 && j > 0) v = Math.min(v, d[k - MW - 1] + 4);
      if (i < MW - 1 && j > 0) v = Math.min(v, d[k - MW + 1] + 4);
      d[k] = v;
    }
    for (let j = MH - 1; j >= 0; j--) for (let i = MW - 1; i >= 0; i--) {
      const k = j * MW + i; if (!d[k]) continue;
      let v = d[k];
      if (i < MW - 1) v = Math.min(v, d[k + 1] + 3);
      if (j < MH - 1) v = Math.min(v, d[k + MW] + 3);
      if (i < MW - 1 && j < MH - 1) v = Math.min(v, d[k + MW + 1] + 4);
      if (i > 0 && j < MH - 1) v = Math.min(v, d[k + MW - 1] + 4);
      d[k] = v;
    }
    return d;
  };
  const din = dist(1), dout = dist(0);
  mask = new Float32Array(MW * MH);
  for (let k = 0; k < mask.length; k++) mask[k] = land[k] ? din[k] / (3 * MASK.res) : -dout[k] / (3 * MASK.res);
}
/** Distancia (en unidades) a la costa: positiva en tierra, negativa en el agua. */
export function coastDist(x: number, y: number): number {
  if (!mask) buildMask();
  const i = Math.floor((x - MASK.x0) * MASK.res), j = Math.floor((y - MASK.y0) * MASK.res);
  if (i < 0 || j < 0 || i >= MW || j >= MH) return -20;
  return mask![j * MW + i];
}
export function isLand(x: number, y: number): boolean { return coastDist(x, y) > 0; }
const onQuay = (x: number, y: number) => y > ISLAND.quayY0 && y < ISLAND.quayY1 && x > QX - 3;

export type Ground = 'calle' | 'plaza' | 'muelle' | 'hierba' | 'patio' | 'playa';
export function groundAt(x: number, y: number): Ground {
  if (onQuay(x, y)) return 'muelle';
  if (coastDist(x, y) < 1.3) return 'playa';
  if (x > 15 && x < 25 && y > 14 && y < 28) return 'plaza';
  const sx = ((x % STREET) + STREET) % STREET, sy = ((y % STREET) + STREET) % STREET;
  if (sx < 1.4 || sy < 1.4) return 'calle';
  return 'patio';
}

// ---------------------------------------------------------------------------- objetos
export type Draw = { key: number; draw: (c: Canvas, iso: Iso) => void; shadow?: (c: Canvas, iso: Iso) => void };

export interface BoxOpts { wall: RGB[]; roof: 'plano' | 'teja' | 'tejaY'; seed: number; windows?: boolean; door?: boolean; awning?: boolean }

export function box(x0: number, y0: number, x1: number, y1: number, h: number, o: BoxOpts): Draw {
  const z0 = HQ;
  const shadowFn = (c: Canvas, iso: Iso) => {
    const L = h * 0.9;
    const pts = [iso.p(x0, y0, z0), iso.p(x1 + L, y0, z0), iso.p(x1 + L, y1, z0), iso.p(x0, y1, z0)];
    c.poly(pts, () => null);
    shadePoly(c, pts);
  };
  const draw = (c: Canvas, iso: Iso) => {
    const zt = z0 + h, u = iso.u;
    const r = rng(o.seed);
    // Cara izquierda (+y): luz media
    c.poly([iso.p(x0, y1, z0), iso.p(x1, y1, z0), iso.p(x1, y1, zt), iso.p(x0, y1, zt)], (sx, sy) => {
      const x = (sx - iso.ox) / u + y1, z = (iso.oy + ((x + y1) * u) / 2 - sy) / u;
      return wallTex(o.wall, 0.62, x, z - z0, sx, sy, o, x1 - x0, h, 'L', x0);
    });
    // Cara derecha (+x): sombra
    c.poly([iso.p(x1, y0, z0), iso.p(x1, y1, z0), iso.p(x1, y1, zt), iso.p(x1, y0, zt)], (sx, sy) => {
      const y = x1 - (sx - iso.ox) / u, z = (iso.oy + ((x1 + y) * u) / 2 - sy) / u;
      return wallTex(o.wall, 0.32, y, z - z0, sx, sy, o, y1 - y0, h, 'R', y0);
    });
    // Arista vertical iluminada y zócalo oscuro
    const [ax, ay] = iso.p(x1, y1, zt), [bx, by] = iso.p(x1, y1, z0);
    c.line(ax, ay, bx, by, o.wall[o.wall.length - 1]);
    c.line(...iso.p(x0, y1, z0), ...iso.p(x1, y1, z0), o.wall[0]);
    c.line(...iso.p(x1, y1, z0), ...iso.p(x1, y0, z0), o.wall[0]);
    if (o.roof === 'plano') {
      // Azotea con pretil: borde claro, interior un tono más bajo, a veces un toldo púrpura
      c.poly([iso.p(x0, y0, zt), iso.p(x1, y0, zt), iso.p(x1, y1, zt), iso.p(x0, y1, zt)], (sx, sy) => {
        const [wx, wy] = iso.inv(sx, sy, zt);
        const rim = wx - x0 < 0.25 || x1 - wx < 0.25 || wy - y0 < 0.25 || y1 - wy < 0.25;
        return rim ? o.wall[o.wall.length - 1] : shade(o.wall, 0.72 + (fbmCell(wx, wy) - 0.5) * 0.15, sx, sy);
      });
      if (o.awning) {
        const ax0 = x0 + 0.4, ay0 = y0 + 0.4, ax1 = x0 + (x1 - x0) * 0.55, ay1 = y1 - 0.4, az = zt + 0.55;
        for (const [px, py] of [[ax0, ay1], [ax1, ay1], [ax1, ay0]]) c.line(...iso.p(px, py, zt), ...iso.p(px, py, az), R.wood[1]);
        c.poly([iso.p(ax0, ay0, az), iso.p(ax1, ay0, az), iso.p(ax1, ay1, az), iso.p(ax0, ay1, az)], (sx, sy) => {
          const [wx] = iso.inv(sx, sy, az); return Math.floor((wx - ax0) * 3) % 2 ? R.cream[2] : R.purple[2];
        });
      }
      if (r() < 0.5) { // jarras y cestos secándose en la azotea
        const [px, py] = iso.p(x0 + 0.6 + r() * (x1 - x0 - 1.2), y0 + 0.6 + r() * (y1 - y0 - 1.2), zt);
        c.poly([[px - 2, py], [px + 2, py], [px + 2, py - 3], [px - 2, py - 3]], () => R.tile[2]); c.set(px - 1, py - 3, R.tile[4]);
      }
    } else roof(c, iso, x0, y0, x1, y1, zt, o.roof === 'teja' ? 'x' : 'y');
  };
  return { key: x1 + y1, draw, shadow: shadowFn };
}

const fbmCell = (x: number, y: number) => ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 + 1) % 1;

function wallTex(r: RGB[], base: number, a: number, z: number, sx: number, sy: number, o: BoxOpts, len: number, h: number, side: 'L' | 'R', a0: number): RGB {
  const along = a - a0;
  // Ventanas: huecos oscuros con dintel claro, repartidos a lo largo de la fachada
  if (o.windows !== false && h > 0.9) {
    const n = Math.max(1, Math.floor(len / 1.6));
    for (let i = 0; i < n; i++) {
      const c = (i + 0.5) * (len / n);
      if (Math.abs(along - c) < 0.18 && z > h * 0.55 && z < h * 0.85) return R.ink;
      if (Math.abs(along - c) < 0.24 && z >= h * 0.85 && z < h * 0.9) return r[r.length - 1];
    }
  }
  // Puerta en la cara izquierda
  if (o.door !== false && side === 'L' && Math.abs(along - len * 0.5) < 0.28 && z < Math.min(0.9, h * 0.7)) return along - len * 0.5 > 0.12 ? R.wood[1] : R.wood[2];
  // Revoque: manchas suaves y alguna piedra a la vista
  const n = fbmCell(Math.floor(sx / 2), Math.floor(sy / 2));
  return shade(r, base + (n - 0.5) * 0.12 + z * 0.04, sx, sy);
}

export function shadePoly(c: Canvas, pts: [number, number][]) {
  const ys = pts.map(p => p[1]);
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(c.H - 1, Math.ceil(Math.max(...ys))); y++) {
    const yc = y + 0.5, xs: number[] = [];
    for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= yc) !== (by <= yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax)); }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) c.darken(x, y);
  }
}

/** Tejado de tejas a dos aguas. Cumbrera a lo largo de x ('x') o de y ('y'). Hiladas píxel a píxel. */
function roof(c: Canvas, iso: Iso, x0: number, y0: number, x1: number, y1: number, zt: number, ridge: 'x' | 'y') {
  const e = 0.25, rh = ridge === 'x' ? (y1 - y0) * 0.45 : (x1 - x0) * 0.45;
  const X0 = x0 - e, X1 = x1 + e, Y0 = y0 - e, Y1 = y1 + e;
  const tile = (t: number, sx: number, sy: number, base: number) => {
    // t: distancia a lo largo de la pendiente (0 alero → 1 cumbrera); hiladas cada ~3 px
    const row = Math.floor(t * 9);
    const lip = (t * 9) % 1 > 0.78;
    const k = base + (row % 2 ? 0.05 : -0.03) - (lip ? 0.18 : 0) + (fbmCell(Math.floor(sx / 3) + row * 7, row) - 0.5) * 0.08;
    return shade(R.tile, k, sx, sy);
  };
  if (ridge === 'x') {
    const ym = (Y0 + Y1) / 2, zr = zt + rh;
    // Faldón trasero (-y), luego delantero (+y), luego hastial en +x
    c.poly([iso.p(X0, Y0, zt), iso.p(X1, Y0, zt), iso.p(X1, ym, zr), iso.p(X0, ym, zr)], (sx, sy) => tile(0.5, sx, sy, 0.7));
    c.poly([iso.p(X0, ym, zr), iso.p(X1, ym, zr), iso.p(X1, Y1, zt), iso.p(X0, Y1, zt)], (sx, sy) => {
      const ax = (sx - iso.ox) / iso.u; // a lo largo de la pendiente: aproximación por altura en pantalla
      const [, py] = iso.p(ax + ym, ym, zr), [, qy] = iso.p(ax + Y1, Y1, zt);
      return tile(1 - (sy - py) / Math.max(1, qy - py), sx, sy, 0.5);
    });
    c.poly([iso.p(x1, y0, zt), iso.p(x1, y1, zt), iso.p(x1, ym, zr)], (sx, sy) => shade(R.lime, 0.35, sx, sy));
    c.line(...iso.p(X0, ym, zr), ...iso.p(X1, ym, zr), R.tile[4]);
    c.line(...iso.p(X0, Y1, zt), ...iso.p(X1, Y1, zt), R.tile[0]);
  } else {
    const xm = (X0 + X1) / 2, zr = zt + rh;
    c.poly([iso.p(X0, Y0, zt), iso.p(xm, Y0, zr), iso.p(xm, Y1, zr), iso.p(X0, Y1, zt)], (sx, sy) => tile(0.5, sx, sy, 0.78));
    c.poly([iso.p(xm, Y0, zr), iso.p(X1, Y0, zt), iso.p(X1, Y1, zt), iso.p(xm, Y1, zr)], (sx, sy) => {
      const ay = -(sx - iso.ox) / iso.u;
      const [, py] = iso.p(xm, xm + ay, zr), [, qy] = iso.p(X1, X1 + ay, zt);
      return tile(1 - (sy - py) / Math.max(1, qy - py), sx, sy, 0.32);
    });
    c.poly([iso.p(x0, y1, zt), iso.p(x1, y1, zt), iso.p(xm, y1, zr)], (sx, sy) => shade(R.lime, 0.6, sx, sy));
    c.line(...iso.p(xm, Y0, zr), ...iso.p(xm, Y1, zr), R.tile[4]);
    c.line(...iso.p(X1, Y0, zt), ...iso.p(X1, Y1, zt), R.tile[0]);
  }
}

// Árboles: ciprés, palmera y olivo, con lado iluminado a la izquierda y sombra proyectada
function tree(x: number, y: number, kind: 'cipres' | 'palmera' | 'olivo', seed: number): Draw {
  return {
    key: x + y + 0.3,
    shadow: (c, iso) => { const [px, py] = iso.p(x, y, HQ); for (let j = -3; j <= 3; j++) for (let i = -2; i <= 16; i++) if ((i - 6) ** 2 / 100 + j * j / 9 < 1) c.darken(px + i, py + j + 1, 0.75); },
    draw: (c, iso) => {
      const [px, py] = iso.p(x, y, HQ); const r = rng(seed);
      if (kind === 'cipres') {
        const H = 30 + Math.floor(r() * 8);
        for (let j = 0; j < H; j++) {
          const w = Math.round(Math.sin(Math.min(1, j / H * 1.15) * Math.PI) * 5 * (1 - j / H * 0.35)) + (j < 3 ? 1 : 0);
          for (let i = -w; i <= w; i++) {
            const lit = (-i / Math.max(1, w)) * 0.4 + 0.45 + (r() - 0.5) * 0.35;
            c.set(px + i, py - j - 2, shade(R.leaf, lit, px + i, py - j));
          }
        }
        c.set(px, py - 1, R.wood[1]); c.set(px, py, R.wood[0]);
      } else if (kind === 'palmera') {
        const H = 26 + Math.floor(r() * 6);
        for (let j = 0; j < H; j++) { const bx = px + Math.round(Math.sin(j / H * 1.6) * 3); c.set(bx, py - j, j % 3 ? R.wood[3] : R.wood[1]); c.set(bx + 1, py - j, R.wood[1]); }
        const tx = px + Math.round(Math.sin(1.6) * 3), ty = py - H;
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * Math.PI * 2 + r() * 0.3, len = 11 + r() * 5;
          for (let s = 0; s < len; s++) {
            const fx = tx + Math.cos(a) * s * 1.1, fy = ty + Math.sin(a) * s * 0.55 + (s * s) / len * 0.5;
            c.set(fx, fy, shade(R.leaf, Math.cos(a) < 0 ? 0.85 : 0.45, fx | 0, fy | 0));
            if (s > 2 && s < len - 2) c.set(fx, fy + 1, R.leaf[1]);
          }
        }
        c.set(tx, ty, R.wood[1]); c.set(tx + 1, ty + 1, R.gold[1]);
      } else {
        // Olivo: tronco retorcido y copa de racimos gris verdosos
        c.line(px, py, px - 1, py - 6, R.wood[1]); c.line(px + 1, py, px + 2, py - 5, R.wood[2]);
        for (let k = 0; k < 7; k++) {
          const cx = px + (r() - 0.5) * 14, cy = py - 9 - r() * 6, rr = 3 + r() * 2.5;
          for (let j = -rr; j <= rr; j++) for (let i = -rr * 1.3; i <= rr * 1.3; i++) if (i * i / 1.69 + j * j < rr * rr) c.set(cx + i, cy + j, shade(R.olive, 0.55 - (i + j) / (rr * 4) + (r() - 0.5) * 0.25, (cx + i) | 0, (cy + j) | 0));
        }
      }
    },
  };
}

// Gente: 5 x 11 px, túnicas de varios colores, algunos con carga
function person(x: number, y: number, seed: number): Draw {
  return {
    key: x + y + 0.2,
    draw: (c, iso) => {
      const [px, py] = iso.p(x, y, HQ); const r = rng(seed);
      const tun = [R.cream, R.purple, R.red, R.shallow, R.dirt][Math.floor(r() * 5)];
      const skin = R.skin[1 + Math.floor(r() * 3)];
      for (let i = -2; i <= 2; i++) c.darken(px + i + 1, py + 1, 0.7);
      c.set(px - 1, py, R.ink); c.set(px + 1, py, R.ink);                       // pies
      c.set(px - 1, py - 1, skin); c.set(px + 1, py - 1, skin);
      for (let j = 2; j <= 6; j++) for (let i = -1; i <= 1; i++) c.set(px + i, py - j, tun[i < 0 ? 3 : i > 0 ? 1 : 2] ?? tun[1]);
      c.set(px - 2, py - 5, skin); c.set(px + 2, py - 4, skin);                 // brazos
      c.set(px, py - 7, skin); c.set(px - 1, py - 8, skin); c.set(px, py - 8, skin); c.set(px + 1, py - 8, R.skin[0]);
      c.set(px - 1, py - 9, R.wood[0]); c.set(px, py - 9, R.wood[0]); c.set(px + 1, py - 9, R.wood[1]); // pelo
      if (r() < 0.25) { c.set(px, py - 11, R.tile[2]); c.set(px - 1, py - 10, R.tile[3]); c.set(px, py - 10, R.tile[2]); c.set(px + 1, py - 10, R.tile[1]); } // ánfora en la cabeza
    },
  };
}

function crateStack(x: number, y: number, seed: number): Draw {
  return {
    key: x + y + 0.4,
    draw: (c, iso) => {
      const r = rng(seed);
      const n = 2 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const ox = (k % 2) * 0.45, oy = Math.floor(k / 2) * 0.45, oz = k === n - 1 && n > 2 ? 0.38 : 0;
        const b0 = [x + ox, y + oy], s = 0.38, z0 = HQ + oz, z1 = z0 + 0.36;
        c.poly([iso.p(b0[0], b0[1] + s, z0), iso.p(b0[0] + s, b0[1] + s, z0), iso.p(b0[0] + s, b0[1] + s, z1), iso.p(b0[0], b0[1] + s, z1)], (sx, sy) => (sx + sy) % 4 === 0 ? R.wood[1] : R.wood[3]);
        c.poly([iso.p(b0[0] + s, b0[1], z0), iso.p(b0[0] + s, b0[1] + s, z0), iso.p(b0[0] + s, b0[1] + s, z1), iso.p(b0[0] + s, b0[1], z1)], () => R.wood[2]);
        c.poly([iso.p(b0[0], b0[1], z1), iso.p(b0[0] + s, b0[1], z1), iso.p(b0[0] + s, b0[1] + s, z1), iso.p(b0[0], b0[1] + s, z1)], () => R.wood[4]);
      }
    },
  };
}

function amphorae(x: number, y: number): Draw {
  return {
    key: x + y + 0.4,
    draw: (c, iso) => {
      for (let k = 0; k < 5; k++) {
        const [px, py] = iso.p(x + (k % 3) * 0.35, y + Math.floor(k / 3) * 0.35, HQ);
        for (let j = 0; j < 8; j++) { const w = j < 2 ? 0 : j < 6 ? 2 : 1; for (let i = -w; i <= w; i++) c.set(px + i, py - j, shade(R.tile, 0.75 - i * 0.18, px + i, py - j)); }
        c.set(px - 2, py - 7, R.tile[1]); c.set(px + 2, py - 7, R.tile[1]); c.set(px, py - 8, R.tile[3]);
      }
    },
  };
}

// Barco mercante en isométrico: casco a lo largo de x, vela cuadrada en el plano x = mástil
export function ship(xa: number, xb: number, yc: number, seed: number, sail = true): Draw {
  const half = (t: number) => 1.15 * Math.pow(Math.sin(Math.PI * t), 0.55);
  const deckZ = (t: number) => 0.45 + 0.9 * Math.pow(Math.abs(t - 0.5) * 2, 3);
  return {
    key: xb + yc + 1.2,
    draw: (c, iso) => {
      const N = 40, pts = (side: 1 | -1, z: (t: number) => number) => Array.from({ length: N + 1 }, (_, i) => { const t = i / N; return iso.p(xa + (xb - xa) * t, yc + side * half(t), z(t)); });
      const deckL = pts(1, deckZ), deckR = pts(-1, deckZ), waterL = pts(1, () => 0);
      // Reflejo oscuro y espuma
      for (const [sx, sy] of waterL) { for (let k = 1; k < 5; k++) c.darken(sx, sy + k, 0.82); }
      // Cubierta
      c.poly([...deckR, ...[...deckL].reverse()], (sx, sy) => shade(R.wood, (sx + sy) % 5 === 0 ? 0.5 : 0.78, sx, sy));
      // Costado visible (+y): tablones horizontales
      c.poly([...deckL, ...[...waterL].reverse()], (sx, sy) => shade(R.wood, 0.42 + (Math.floor(sy / 3) % 2 ? 0.08 : -0.06), sx, sy));
      // Borda y línea de flotación
      for (let i = 0; i < N; i++) { c.line(...deckL[i], ...deckL[i + 1], R.wood[4]); c.line(...waterL[i], ...waterL[i + 1], R.wood[0]); }
      // Ojo en la proa y carga en cubierta
      const [ex, ey] = iso.p(xa + (xb - xa) * 0.93, yc + 0.35, 0.55); c.set(ex, ey, R.cream[3]); c.set(ex + 1, ey, R.ink);
      const r = rng(seed);
      for (let k = 0; k < 6; k++) { const [ax, ay] = iso.p(xa + (xb - xa) * (0.2 + r() * 0.6), yc + (r() - 0.5) * 1.2, 0.5); c.set(ax, ay, R.tile[3]); c.set(ax, ay - 1, R.tile[2]); c.set(ax + 1, ay, R.tile[1]); }
      const xm = xa + (xb - xa) * 0.5;
      const [mx, my] = iso.p(xm, yc, 0.5), [tx, ty] = iso.p(xm, yc, sail ? 5.2 : 3);
      // Jarcia
      c.line(tx, ty, ...iso.p(xa + 0.2, yc, deckZ(0)), R.ink); c.line(tx, ty, ...iso.p(xb - 0.2, yc, deckZ(1)), R.ink);
      c.line(mx, my, tx, ty, R.wood[1]); c.line(mx + 1, my, tx + 1, ty, R.wood[0]);
      if (sail) {
        const yA = yc - 2.1, yB = yc + 2.1, zA = 1.6, zB = 4.8;
        c.line(...iso.p(xm, yA - 0.2, zB + 0.1), ...iso.p(xm, yB + 0.2, zB + 0.1), R.wood[1]);
        c.poly([iso.p(xm, yA, zB), iso.p(xm, yB, zB), iso.p(xm + 0.35, yB, zA), iso.p(xm + 0.35, yA, zA)], (sx, sy) => {
          const y = xm - (sx - iso.ox) / iso.u;
          const stripe = Math.floor((y - yA) * 2.4) % 2 === 0;
          const lit = 0.75 - ((y - yA) / (yB - yA)) * 0.35;
          return stripe ? shade(R.red, lit, sx, sy) : shade(R.cream, lit, sx, sy);
        });
      }
    },
  };
}

// ---------------------------------------------------------------------------- composición
export function renderTiro(W: number, H: number) {
  const c = new Canvas(W, H);
  const u = 16;
  // Centro de cámara en el mundo
  const cx = 24, cy = 24;
  const iso = new Iso(u, 0, 0);
  const [px, py] = iso.p(cx, cy, 0);
  iso.ox = W / 2 - px; iso.oy = H * 0.52 - py;

  paintTerrain(c, iso);

  // ---- 2. Objetos del barrio
  const items: Draw[] = [];
  const hotspots: Hotspot[] = [];
  const r = rng(11);
  // Manzanas de casas (procedural): cada manzana con 2-4 casas de caliza, azoteas o tejas
  for (let bx = -14; bx < 28; bx += STREET) for (let by = -14; by < 60; by += STREET) {
    const x0 = bx + 1.6, y0 = by + 1.6, x1 = bx + STREET - 0.2, y1 = by + STREET - 0.2;
    if (x1 > QX - 3.2) continue;
    if (x0 < 25 && x1 > 15 && y0 < 28 && y1 > 14) continue; // plaza
    if (y0 > 36 && x0 > 5) continue;                       // astillero
    const split = r() < 0.5;
    const parts: [number, number, number, number][] = split
      ? [[x0, y0, (x0 + x1) / 2 - 0.15, y1], [(x0 + x1) / 2 + 0.15, y0, x1, y1]]
      : [[x0, y0, x1, (y0 + y1) / 2 - 0.15], [x0, (y0 + y1) / 2 + 0.15, x1, y1]];
    for (const [a, b, cc, d] of parts) {
      if (r() < 0.12) { items.push(tree((a + cc) / 2, (b + d) / 2, r() < 0.5 ? 'olivo' : 'cipres', Math.floor(r() * 1e6))); continue; }
      const h = 1.1 + Math.floor(r() * 3) * 0.55;
      const tiled = r() < 0.3;
      items.push(box(a, b, cc, d, h, { wall: R.lime, roof: tiled ? (r() < 0.5 ? 'teja' : 'tejaY') : 'plano', seed: Math.floor(r() * 1e6), awning: !tiled && r() < 0.35 }));
    }
  }
  // Plaza del mercado y templo de Melqart
  items.push(...temple(17.5, 15.5));
  hotspots.push({ id: 'templo', label: 'Templo de Melqart', ...pt(iso, 19.8, 17.5, 4.8) });
  for (let k = 0; k < 5; k++) items.push(stall(16.2 + (k % 3) * 2.4, 22.6 + Math.floor(k / 3) * 2.4, k));
  hotspots.push({ id: 'mercado', label: 'Mercado', ...pt(iso, 18.6, 24.2, 2.2) });
  // Almacenes en fila sobre el muelle, tejados de teja
  items.push(box(22.6, 30.5, 26.4, 36.5, 1.9, { wall: R.lime, roof: 'tejaY', seed: 5, windows: true }));
  items.push(box(22.6, 37.2, 26.4, 40.2, 1.6, { wall: R.lime, roof: 'plano', seed: 6, awning: true }));
  hotspots.push({ id: 'almacen', label: 'Almacén', ...pt(iso, 24.5, 33.5, 3.3) });
  items.push(box(22.4, 8.5, 26.6, 12.5, 2.6, { wall: R.lime, roof: 'plano', seed: 9 }));
  hotspots.push({ id: 'oficina', label: 'Oficina del puerto', ...pt(iso, 24.5, 10.5, 3.6) });
  // Astillero: casco en grada con cuadernas
  items.push(...shipyard(8, 40));
  hotspots.push({ id: 'astillero', label: 'Astillero', ...pt(iso, 12, 42, 2.8) });
  // Carga y gente en el muelle y las calles
  for (const [x, y] of [[26.6, 14], [26.8, 21.2], [26.5, 27.5], [27, 38], [20, 30.2], [12, 29.8]] as [number, number][]) items.push(crateStack(x, y, Math.floor(x * 31 + y)));
  for (const [x, y] of [[26.8, 18.5], [25.6, 29], [21.4, 12.8], [14.4, 21.2]] as [number, number][]) items.push(amphorae(x, y));
  for (const [x, y, k] of [[14.6, 15, 'palmera'], [14.6, 26.6, 'palmera'], [25.6, 15, 'palmera'], [27.2, 4, 'cipres'], [27.2, 44.5, 'palmera']] as [number, number, 'palmera' | 'cipres'][]) items.push(tree(x, y, k, Math.floor(x * 7 + y)));
  for (let i = 0; i < 150; i++) {
    let x = 0, y = 0;
    for (let t = 0; t < 20; t++) {
      x = -14 + r() * 42; y = -14 + r() * 60;
      const g = groundAt(x, y);
      if (isLand(x, y) && x < QX - 0.3 && (g === 'calle' || g === 'plaza' || g === 'muelle')) break;
    }
    items.push(person(x, y, i * 97 + 3));
  }
  // Embarcaderos de madera hacia la dársena y barcos
  items.push(pier(QX, 22.4, 36, 23.3), pier(QX, 31.6, 37, 32.5));
  items.push(ship(29.6, 36.6, 20.6, 1), ship(29.8, 36.8, 25.2, 2), ship(30, 37, 34.6, 3), ship(39, 46.5, 30, 4), ship(43, 50, 38.5, 5));
  hotspots.push({ id: 'muelle', label: 'Muelle', ...pt(iso, 33, 25, 5.6) });

  // ---- 3. Sombras proyectadas, luego volúmenes de atrás hacia delante
  for (const it of items) it.shadow?.(c, iso);
  items.sort((a, b) => a.key - b.key);
  for (const it of items) it.draw(c, iso);

  // ---- 4. Brillos del sol en el agua (al final)
  const rr = rng(23);
  for (let i = 0; i < W * H / 260; i++) {
    const sx = Math.floor(rr() * W), sy = Math.floor(rr() * H);
    const [wx, wy] = iso.inv(sx, sy, 0);
    const p = c.get(sx, sy);
    if (!isLand(wx, wy) && p[2] > 110 && p[0] < 80) { c.set(sx, sy, R.foam[1]); c.set(sx + 1, sy, R.foam[0]); }
  }
  return { canvas: c, hotspots, iso };
}

const pt = (iso: Iso, x: number, y: number, z: number) => { const [sx, sy] = iso.p(x, y, z); return { x: sx, y: sy }; };

export function groundColor(x: number, y: number, sx: number, sy: number): RGB {
  const g = groundAt(x, y);
  if (g === 'playa') {
    const d = coastDist(x, y), n = fbmCell(Math.floor(sx / 2), Math.floor(sy / 2));
    if (d < 0.35) return shade(R.lime, 0.55 + n * 0.2, sx, sy);           // arena mojada clara junto a las rocas
    return n > 0.93 ? R.cream[2] : shade(R.dirt, 0.82 + (n - 0.5) * 0.15, sx, sy);
  }
  if (g === 'muelle') {
    // Losas grandes de caliza con juntas
    const fx = (x * 1.25) % 1, fy = (y * 1.25 + (Math.floor(x * 1.25) % 2) * 0.5) % 1;
    if (fx < 0.07 || fy < 0.07) return R.lime[1];
    return shade(R.lime, 0.62 + (fbmCell(Math.floor(x * 1.25), Math.floor(y * 1.25 + 0.5)) - 0.5) * 0.18, sx, sy);
  }
  if (g === 'plaza') {
    const fx = (x * 2) % 1, fy = (y * 2) % 1;
    if (fx < 0.08 || fy < 0.08) return R.lime[2];
    return shade(R.lime, 0.75 + (fbmCell(Math.floor(x * 2), Math.floor(y * 2)) - 0.5) * 0.15, sx, sy);
  }
  if (g === 'calle') {
    const n = fbmCell(Math.floor(sx / 2), Math.floor(sy / 2));
    return shade(R.dirt, 0.6 + (n - 0.5) * 0.25, sx, sy);
  }
  // Patio: tierra con matas de hierba seca
  const n = (Math.sin(x * 2.3) + Math.cos(y * 1.7) + fbmCell(Math.floor(x * 3), Math.floor(y * 3))) / 3;
  return n > 0.25 ? shade(R.grass, 0.45 + n * 0.5, sx, sy) : shade(R.dirt, 0.5 + n * 0.3, sx, sy);
}

export function waterColor(x: number, y: number, sx: number, sy: number): RGB {
  const d = Math.max(0, -coastDist(x, y));
  const depth = Math.min(1, d / 9);
  const ripple = Math.sin(x * 3.1 + y * 1.3 + Math.sin(y * 0.7) * 2) * 0.5 + 0.5;
  if (depth < 0.35) return shade(R.shallow, 0.8 - depth * 1.6 + (ripple - 0.5) * 0.25, sx, sy);
  return shade(R.deep, 0.95 - depth * 0.7 + (ripple - 0.5) * 0.3, sx, sy);
}

function temple(x: number, y: number): Draw[] {
  const out: Draw[] = [];
  // Podio escalonado y naos con tejado a dos aguas
  const podium = box(x, y, x + 5.5, y + 4.5, 0.35, { wall: R.lime, roof: 'plano', seed: 1, windows: false, door: false });
  out.push(podium);
  const naos = box(x + 1, y + 0.8, x + 4.4, y + 3.6, 2.2, { wall: R.lime, roof: 'tejaY', seed: 2, windows: false });
  naos.key = podium.key + 0.01;
  const d0 = naos.draw; naos.draw = (c, iso) => { const o = iso.oy; iso.oy -= 0.35 * iso.u; d0(c, iso); iso.oy = o; };
  out.push(naos);
  // Las dos columnas exentas: Jaquín y Boaz de Tiro, una de oro y otra de esmeralda
  for (const [cy, rampCol] of [[y + 1.2, R.gold], [y + 3.2, R.leaf]] as [number, RGB[]][]) {
    out.push({
      key: x + y + 10.02 + cy * 0.001,
      draw: (c, iso) => {
        const [bx, by] = iso.p(x + 5.1, cy, HQ + 0.35);
        for (let j = 0; j < 46; j++) for (let i = -2; i <= 2; i++) c.set(bx + i, by - j, shade(rampCol, 0.85 - (i + 2) * 0.16, bx + i, by - j));
        for (let i = -3; i <= 3; i++) { c.set(bx + i, by - 46, rampCol[rampCol.length - 1]); c.set(bx + i, by - 47, rampCol[1]); c.set(bx + i, by, R.lime[2]); }
      },
    });
  }
  return out;
}

function stall(x: number, y: number, k: number): Draw {
  return {
    key: x + y + 1.4,
    shadow: (c, iso) => shadePoly(c, [iso.p(x, y, HQ), iso.p(x + 2.2, y, HQ), iso.p(x + 2.2, y + 1.4, HQ), iso.p(x, y + 1.4, HQ)]),
    draw: (c, iso) => {
      const z = HQ + 1.1, col = [R.purple, R.red, R.shallow][k % 3];
      for (const [px, py] of [[x, y + 1.4], [x + 1.4, y + 1.4], [x + 1.4, y]]) c.line(...iso.p(px, py, HQ), ...iso.p(px, py, z), R.wood[1]);
      // Mesa con mercancía
      c.poly([iso.p(x + 0.1, y + 0.1, HQ + 0.45), iso.p(x + 1.3, y + 0.1, HQ + 0.45), iso.p(x + 1.3, y + 1.3, HQ + 0.45), iso.p(x + 0.1, y + 1.3, HQ + 0.45)], (sx, sy) => ((sx >> 1) + (sy >> 1)) % 3 ? R.wood[3] : [R.tile[3], R.gold[2], R.cream[2], R.purple[3]][(sx * 7 + sy * 3 + k) % 4]);
      c.poly([iso.p(x - 0.15, y - 0.15, z), iso.p(x + 1.55, y - 0.15, z), iso.p(x + 1.55, y + 1.55, z + 0.15), iso.p(x - 0.15, y + 1.55, z + 0.15)], (sx, sy) => {
        const [wx] = iso.inv(sx, sy, z); return Math.floor((wx - x) * 4) % 2 ? R.cream[2] : col[2];
      });
    },
  };
}

export function pier(x0: number, y0: number, x1: number, y1: number): Draw {
  return {
    key: x1 + y0 + 0.5,
    draw: (c, iso) => {
      const z = HQ - 0.1;
      for (let x = x0; x < x1; x += 0.8) for (const y of [y0, y1]) { const [a, b] = iso.p(x, y, z), [, d] = iso.p(x, y, -0.2); c.line(a, b, a, d, R.wood[0]); }
      c.poly([iso.p(x0, y0, z), iso.p(x1, y0, z), iso.p(x1, y1, z), iso.p(x0, y1, z)], (sx, sy) => {
        const [wx] = iso.inv(sx, sy, z); return (wx * 3) % 1 < 0.15 ? R.wood[1] : shade(R.wood, 0.7, sx, sy);
      });
      c.poly([iso.p(x0, y1, z), iso.p(x1, y1, z), iso.p(x1, y1, z - 0.12), iso.p(x0, y1, z - 0.12)], () => R.wood[1]);
    },
  };
}

export function shipyard(x: number, y: number): Draw[] {
  const out: Draw[] = [];
  out.push(box(x - 5, y + 0.5, x - 1, y + 4, 1.6, { wall: R.wood, roof: 'teja', seed: 3 }));
  out.push({
    key: x + 9 + y + 2,
    draw: (c, iso) => {
      // Grada de madera y casco a medio construir (cuadernas a la vista)
      c.poly([iso.p(x, y + 0.6, HQ + 0.05), iso.p(x + 10, y + 0.6, HQ + 0.05), iso.p(x + 10, y + 3.4, HQ + 0.05), iso.p(x, y + 3.4, HQ + 0.05)], (sx, sy) => (sx + 2 * sy) % 6 < 1 ? R.wood[1] : R.wood[3]);
      const yc = y + 2, half = (t: number) => 1.2 * Math.pow(Math.sin(Math.PI * t), 0.55);
      for (let i = 1; i < 18; i++) {
        const t = i / 18, xx = x + 1 + t * 8;
        const top = 0.9 + 0.7 * Math.pow(Math.abs(t - 0.5) * 2, 3);
        const left = iso.p(xx, yc + half(t), HQ + top), bot = iso.p(xx, yc, HQ + 0.2), right = iso.p(xx, yc - half(t), HQ + top);
        c.line(...left, ...bot, R.wood[i % 2 ? 2 : 3]); c.line(...bot, ...right, R.wood[1]);
      }
      c.line(...iso.p(x + 1, yc, HQ + 0.2), ...iso.p(x + 9, yc, HQ + 0.2), R.wood[0]);           // quilla
      for (let i = 0; i < 9; i++) { const t = i / 9; const a = iso.p(x + 1 + t * 8, yc + half(t), HQ + 0.6), b = iso.p(x + 1 + (t + 1 / 9) * 8, yc + half(t + 1 / 9), HQ + 0.6); c.line(...a, ...b, R.wood[4]); } // primera traca
      // Andamios
      for (const px of [x + 2, x + 5, x + 8]) { const a = iso.p(px, y + 3.6, HQ), b = iso.p(px, y + 3.6, HQ + 2.2); c.line(...a, ...b, R.wood[1]); }
      c.line(...iso.p(x + 2, y + 3.6, HQ + 1.6), ...iso.p(x + 8, y + 3.6, HQ + 1.6), R.wood[2]);
    },
  });
  return out;
}

/** Terreno píxel a píxel: suelo, muros del muelle, agua por profundidad y espuma. */
export function paintTerrain(c: Canvas, iso: Iso) {
  const W = c.W, H = c.H, u = iso.u;
  // ---- 1. Terreno píxel a píxel
  for (let sy = 0; sy < H; sy++) for (let sx = 0; sx < W; sx++) {
    const [lx, ly] = iso.inv(sx, sy, HQ);
    if (isLand(lx, ly)) { c.set(sx, sy, groundColor(lx, ly, sx, sy)); continue; }
    // ¿Cara vertical de la orilla? Buscar tierra bajando desde la altura del suelo
    let wall = false, zHit = 0, wx = 0, wy = 0;
    for (let z = HQ - 1 / u; z >= 0; z -= 1 / u) {
      [wx, wy] = iso.inv(sx, sy, z);
      if (isLand(wx, wy)) { wall = true; zHit = z; break; }
    }
    if (wall) {
      if (onQuay(wx, wy) && Math.abs(wx - QX) < 0.3) {
        const row = Math.floor((zHit / HQ) * 3);
        const mortar = (zHit / HQ * 3) % 1 < 0.2 || (Math.floor(sx / 7) + row) % 3 === 0 && sx % 7 === 0;
        c.set(sx, sy, mortar ? R.stone[1] : shade(R.lime, 0.25, sx, sy));
      } else {
        // Roca costera: bloques irregulares con algas en la base
        const n = fbmCell(Math.floor(sx / 3), Math.floor(sy / 2));
        c.set(sx, sy, zHit < 0.12 ? (n > 0.5 ? R.leaf[2] : R.stone[1]) : shade(R.stone, 0.35 + zHit + (n - 0.5) * 0.35, sx, sy));
      }
      continue;
    }
    const [ax, ay] = iso.inv(sx, sy, 0);
    c.set(sx, sy, waterColor(ax, ay, sx, sy));
  }
  // Espuma a lo largo de toda la orilla
  for (let sy = 1; sy < H; sy++) for (let sx = 0; sx < W; sx++) {
    const [wx, wy] = iso.inv(sx, sy, 0);
    const d = coastDist(wx, wy);
    if (d > 0 || d < -0.45) continue;
    const k = ((sx >> 1) + sy) % 3;
    if (d > -0.18 ? k : (k === 0 && ((sx * 7 + sy * 3) % 5 === 0))) c.set(sx, sy, R.foam[(sx + sy) % 3]);
  }

}
