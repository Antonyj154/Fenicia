// ============================================================================
// FENICIA · Mundo isométrico en pixel art de alta densidad ("hi-bit").
// RECETA (adaptada de la referencia del usuario, sin copiar su contenido):
//  MARCA: el píxel a resolución fina (1 celda = 1 px CSS), rampas de 5-6 tonos por material,
//         texturas hechas píxel a píxel (hiladas de teja, juntas de sillar, vetas de tablón,
//         manchas de hierba), sin degradados suaves: los tonos saltan por escalones y dither.
//  BORDE: contorno oscuro sólo donde un volumen se recorta contra otro; aristas iluminadas
//         con un filete claro en el lado del sol.
//  ORDEN: terreno (agua por profundidad → orilla → muros del muelle → suelo y calles) →
//         sombras proyectadas → volúmenes ordenados de atrás hacia delante → gente → brillos.
//  LUZ: sol arriba a la izquierda: techos claros, cara izquierda (+y) media, cara derecha (+x)
//       en sombra; sombras proyectadas hacia abajo a la derecha.
// Proyección isométrica 2:1: x hacia abajo-derecha, y hacia abajo-izquierda, z arriba.
// Puro y determinista (rng con semilla).
// ============================================================================

export type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ramp = (...hs: string[]) => hs.map(hex);

// Rampas de color por material (oscuro → claro)
export const R = {
  deep: ramp('#0d2a45', '#11365a', '#164a72', '#1c5d86', '#23729a'),
  shallow: ramp('#1e6f8f', '#2687a0', '#2f9fae', '#45b8b9', '#7fd3c8'),
  foam: ramp('#a9e3da', '#d8f3ec', '#f4fbf6'),
  grass: ramp('#3d4d22', '#53632b', '#6b7a34', '#8a8f42', '#a7a356', '#c2b86c'),
  dirt: ramp('#6b5034', '#8a6a45', '#a8845a', '#c29d6e', '#d8b886'),
  lime: ramp('#6f5f4c', '#9a856a', '#bba58a', '#d6c4a6', '#ebdcc0', '#f7eedb'), // caliza
  stone: ramp('#4e4a46', '#6c665e', '#8b8378', '#a99f91', '#c5bcad'),
  tile: ramp('#5e2416', '#7d321d', '#9d4426', '#bb5a31', '#d6744a'),
  wood: ramp('#2e1d12', '#47301d', '#64452a', '#82603a', '#a07d52'),
  leaf: ramp('#1d3317', '#2b4a1f', '#3c6227', '#527b32', '#6f9640'),
  olive: ramp('#3a4632', '#4f5d42', '#687656', '#84916b', '#a3ad86'),
  purple: ramp('#3d0d2e', '#5c143f', '#7b1f5d', '#9b3a7a', '#c06aa0'),
  cream: ramp('#b9ab92', '#d9ccb4', '#efe5d2', '#fbf4e4'),
  red: ramp('#6a1c14', '#932a1b', '#bf3e25', '#dc5f3a'),
  gold: ramp('#7a4f12', '#b07a1d', '#e0a92e', '#f6d36a'),
  skin: ramp('#5b3a26', '#7d5236', '#9c6a47', '#b8855c'),
  ink: hex('#120d16'),
};

// ---------------------------------------------------------------------------- utilidades
export function rng(seed: number) {
  let s = seed | 0;
  return () => { let t = (s = (s + 0x6d2b79f5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash2(x: number, y: number, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x: number, y: number, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x: number, y: number, s = 0) => vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15;
const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
/** Escoge un tono de la rampa para un valor continuo t (0..1) con dither ordenado 4x4. */
export function shade(r: RGB[], t: number, x: number, y: number): RGB {
  const f = Math.max(0, Math.min(0.9999, t)) * (r.length - 1);
  const i = Math.floor(f), frac = f - i;
  return r[Math.min(r.length - 1, i + (frac * 16 > BAYER4[y & 3][x & 3] ? 1 : 0))];
}

// ---------------------------------------------------------------------------- lienzo de píxeles
export class Canvas {
  readonly data: Uint8ClampedArray;
  constructor(readonly W: number, readonly H: number) { this.data = new Uint8ClampedArray(W * H * 4); }
  set(x: number, y: number, c: RGB) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.W || y >= this.H) return; const i = (y * this.W + x) * 4; this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = 255; }
  get(x: number, y: number): RGB { const i = (y * this.W + x) * 4; return [this.data[i], this.data[i + 1], this.data[i + 2]]; }
  /** Oscurece un píxel (sombra proyectada): multiplica hacia un azul frío, no hacia el negro. */
  darken(x: number, y: number, k = 0.68) {
    x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    const i = (y * this.W + x) * 4;
    this.data[i] = this.data[i] * k * 0.92; this.data[i + 1] = this.data[i + 1] * k * 0.95; this.data[i + 2] = Math.min(255, this.data[i + 2] * k * 1.08 + 6);
  }
  /** Rellena un polígono en pantalla; la función decide el color de cada píxel. */
  poly(pts: [number, number][], col: (x: number, y: number) => RGB | null) {
    const ys = pts.map(p => p[1]);
    const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(this.H - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5, xs: number[] = [];
      for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= yc) !== (by <= yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax)); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(this.W - 1, Math.floor(xs[k + 1] - 0.5)); x++) { const c = col(x, y); if (c) this.set(x, y, c); }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    for (;;) { this.set(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
}

// ---------------------------------------------------------------------------- proyección
export class Iso {
  constructor(public u: number, public ox: number, public oy: number) {}
  /** Mundo → pantalla. z en unidades de baldosa (1 = altura de un piso bajo). */
  p(x: number, y: number, z = 0): [number, number] { return [this.ox + (x - y) * this.u, this.oy + ((x + y) * this.u) / 2 - z * this.u]; }
  /** Pantalla → mundo sobre el plano z. */
  inv(sx: number, sy: number, z = 0): [number, number] {
    const a = (sx - this.ox) / this.u, b = (2 * (sy - this.oy + z * this.u)) / this.u;
    return [(a + b) / 2, (b - a) / 2];
  }
}
