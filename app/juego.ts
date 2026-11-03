// ============================================================================
// FENICIA · Juego (Fase 2, iteración 2)
// Pantalla de inicio → ciudad isométrica jugable. Ver docs/arte y Lista_de_mejoras_01.
// ============================================================================
import './juego.css';
import * as E from '../src/economy';
import type { CartClass, GameState, Notification } from '../src/economy/types';
import { TimeGesture } from '../src/ui/timeGesture';
import { CART_ART, WH_ART, getStrip, loadArt, person, spawnWalkers, SPOTS, stepWalker, World, type Sprite, type Strip, type Walker } from '../src/game/world';
import { HQ, QX } from '../src/art/tiro';
import { rng } from '../src/art/iso';
import { AudioManager } from '../src/game/audio';
import { INFO, INTROS, MESSAGES, TUTORIAL } from '../src/game/guide';

const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');
const sign = (n: number) => (n > 0 ? '+' : '') + fmt(n);
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const img = (path: string, cls = '') => `<img class="px ${cls}" src="./assets/${path}.png" alt="">`;
const ui = (n: string, cls = '') => img(`ui/${n.startsWith('ui_') || /^(aviso|ind|fin|hito|dif|ev)_/.test(n) ? n : 'ui_' + n}`, cls);
const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
const CAT_NAME: Record<string, string> = { artesania: 'artesanía', ceramica: 'cerámica', vidrio: 'vidrio', alimento: 'alimentos', textil: 'telas', metal: 'metal', joyeria: 'joyería', madera: 'madera', lujo: 'lujo', especia: 'especias', mayorista: 'mayorista' };
const CAT_COLOR: Record<string, string> = { artesania: '#a8845a', ceramica: '#bb5a31', vidrio: '#45b8b9', alimento: '#6f9640', textil: '#efe5d2', metal: '#a99f91', joyeria: '#e0a92e', madera: '#82603a', lujo: '#c06aa0', especia: '#bf3e25', mayorista: '#7b1f5d' };
const goodIcon = (id: string) => { const g = E.GOOD_BY_ID[id]; return g ? img(`mercancias/merc_${slug(g.name)}`) : `<i style="background:${CAT_COLOR.artesania}"></i>`; };
const DIFF: Record<string, string> = { facil: 'Fácil', media: 'Media', dificil: 'Difícil' };
/** Textos para mostrar: «hito N» con el número visible (1, 2, 3… sin saltos) y el nombre de la ciudad de la partida. */
const H = (t: string) => E.milestoneText(t).replace(/\{ciudad\}/g, cityName()).replace(/\{templo\}/g, templeName());
const cityName = () => E.PORT_BY_ID[s.cityId]?.name ?? 'la ciudad';
const TEMPLES: Record<string, string> = { tiro: 'Templo de Melqart', sidon: 'Templo de Eshmún', biblos: 'Templo de Baalat', cartago: 'Templo de Tanit', gadir: 'Templo de Melqart' };
const templeName = () => TEMPLES[s.cityId] ?? 'Templo';

// ---------------------------------------------------------------------------- guardado
const store: E.KeyValueStore = {
  getItem: k => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  removeItem: k => { try { localStorage.removeItem(k); } catch { /* */ } },
};
const saves = new E.SaveManager(store);
/**
 * Una sola vez: borra las partidas de prueba de versiones anteriores (v1-v2). Desde aquí cada persona
 * conserva las suyas en su dispositivo y el juego arranca sin partidas guardadas.
 */
function resetOldSaves() {
  if (store.getItem('fenicia.reset.v3')) return;
  for (const x of saves.list()) { const raw = store.getItem('fenicia.save.' + x.id); let v = 0; try { v = raw ? JSON.parse(raw).version ?? 1 : 0; } catch { /* */ } if (v < 3) saves.remove(x.id); }
  store.setItem('fenicia.reset.v3', '1');
}
const SLOT = 'fenicia.juego.actual';
const audio = new AudioManager();

let s: GameState = E.createGame('tiro');     // se reemplaza al elegir partida
let running = false;

// ---------------------------------------------------------------------------- DOM base
const root = document.getElementById('game')!;
root.innerHTML = `<canvas class="scene"></canvas><div class="labels"></div>`;
const cv = root.querySelector('canvas')!, ctx = cv.getContext('2d')!;
const labels = root.querySelector<HTMLElement>('.labels')!;
const layer = (cls: string, tag = 'div') => { const e = document.createElement(tag); e.className = cls; return e; };
const hud = layer('top'), goal = layer('panel goal'), toasts = layer('toasts'), nav = layer('panel nav', 'nav');
const ring = layer('ring'), sheetEl = layer('panel sheet', 'section'), modal = layer('modal'), tutor = layer('tutor'), startEl = layer('start');
ring.hidden = true; sheetEl.hidden = true; modal.hidden = true; tutor.hidden = true;

let world = new World();
let walkers: Walker[] = [];
const wr = rng(77);
const cache = new Map<string, Sprite>();
const gesture = new TimeGesture();
let cam = { x: 0, y: 0 }, k = 3, dpr = 1, zoom = 1;
let sheet: string | null = null, sheetTab = 'comprar';
let animClock = 0;                       // reloj de animación: se detiene en pausa (los NPC se paran)
let lastRunSpeed: 1 | 6 = 1;            // velocidad a la que vuelve «Continuar»

// Acercar/alejar la ciudad: escalas enteras de píxel (nítidas) entre ZMIN y ZMAX
let kUser = 0;
const ZMIN = 1, ZMAX = 5;
function resize() {
  dpr = devicePixelRatio || 1;
  const def = dpr >= 2 ? 3 : 2;
  k = Math.max(ZMIN, Math.min(ZMAX, kUser || def));
  // No alejar tanto que se vea fuera del mundo
  while ((innerWidth * dpr / k > world.W || innerHeight * dpr / k > world.H) && k < ZMAX) k++;
  zoom = k / dpr;
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  clampCam();
}
/** Cambia el zoom manteniendo fijo el punto de pantalla (px, py). */
function setZoom(nk: number, px = innerWidth / 2, py = innerHeight / 2) {
  const dprNow = devicePixelRatio || 1;
  nk = Math.max(ZMIN, Math.min(ZMAX, Math.round(nk)));
  if (innerWidth * dprNow / nk > world.W || innerHeight * dprNow / nk > world.H) return;
  if (nk === k) return;
  const wx = cam.x + px / zoom, wy = cam.y + py / zoom;
  kUser = nk; resize();
  cam.x = wx - px / zoom; cam.y = wy - py / zoom; clampCam();
}
const viewW = () => innerWidth / zoom, viewH = () => innerHeight / zoom;
function clampCam() { cam.x = Math.max(0, Math.min(world.W - viewW(), cam.x)); cam.y = Math.max(0, Math.min(world.H - viewH(), cam.y)); }
function focus(x: number, y: number, at = 0.45) { const [px, py] = world.iso.p(x, y, HQ); cam.x = px - viewW() / 2; cam.y = py - viewH() * at; clampCam(); }
/** Dónde está cada cosa en la ciudad (para «Ir allí»). */
function placeOf(id: string): [number, number] | null {
  switch (id) {
    case 'caballerizas': return [-1.5, 31];
    case 'muelle': return [31, 22];
    case 'astillero': return [24, 43];
    case 'almacenes': { const p = world.warehousePlaces(s)[0]; const r = p?.slot ?? world.whSlots[0]; return [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2]; }
    case 'oficina': case 'finanzas': return [24.5, 10.5];
    case 'templo': return [19.5, 17];
    case 'talleres': { const w = world.workshops[0]; return w ? [w.x1 - 1.5, w.y1 - 1.5] : null; }
    case 'contratos': case 'proveedores': case 'vender': case 'mercado': return [19, 22];
  }
  if (id.startsWith('lot:')) { const l = world.lots.find(x => `lot:${x.id}` === id); return l ? [(l.x0 + l.x1) / 2, (l.y0 + l.y1) / 2] : null; }
  return null;
}
/** Abre una pantalla y lleva la cámara a su lugar (la hoja tapa la mitad de abajo: el lugar queda arriba). */
function goTo(id: string) {
  const p = placeOf(id);
  if (['contratos', 'proveedores', 'vender'].includes(id)) { sheetTab = id; openSheet('mercado'); } else openSheet(id);
  if (p) focus(p[0], p[1], 0.24);
}
const toScreen = (wx: number, wy: number) => [(wx - cam.x) * zoom, (wy - cam.y) * zoom];

// ---------------------------------------------------------------------------- animación de barcos y carretas
interface ShipAnim { shipId: string; t0: number; dir: 'out' | 'in'; dock: number }
const shipAnims: ShipAnim[] = [];
const SAIL_MS = 11000;
let prevAtSea = new Set<string>();
function dockOf(shipId: string) { const i = s.ships.findIndex(x => x.id === shipId); return Math.max(0, i); }
function trackShips() {
  const atSea = new Set(s.ships.filter(x => x.voyageId).map(x => x.id));
  for (const id of atSea) if (!prevAtSea.has(id)) shipAnims.push({ shipId: id, t0: animClock, dir: 'out', dock: dockOf(id) });
  for (const id of prevAtSea) if (!atSea.has(id) && s.ships.some(x => x.id === id)) shipAnims.push({ shipId: id, t0: animClock, dir: 'in', dock: dockOf(id) });
  prevAtSea = atSea;
  for (let i = shipAnims.length - 1; i >= 0; i--) if (animClock - shipAnims[i].t0 > SAIL_MS) shipAnims.splice(i, 1);
}
// Edificios recién ocupados o mejorados: se ven con andamio unos segundos
const freshMap = new Map<string, number>();
let prevOwned = '';
function trackFresh() {
  const keys = [...s.venues.map(v => `v:${v.defId}`), ...s.warehouses.map(w => `w:${w.uid}`), ...(s.stables ? [`stables`] : [])];
  const sig = keys.join(',') + '|' + (s.stables?.level ?? 0) + (s.stables?.owned ? 'o' : '');
  if (sig === prevOwned) return;
  const before = new Set(prevOwned.split('|')[0].split(','));
  if (prevOwned) for (const k of keys) if (!before.has(k)) freshMap.set(k, animClock);
  if (prevOwned && prevOwned.split('|')[1] !== sig.split('|')[1]) freshMap.set('stables', animClock);
  prevOwned = sig;
}
const bob = (ph: number) => [0, 0, 1, 1, 0, 0, -1, -1][(Math.floor(animClock / 220) + ph) % 8];

// ---------------------------------------------------------------------------- dibujo
let frameSprites: Sprite[] = [];
function draw() {
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1d5d78'; ctx.fillRect(0, 0, cv.width, cv.height);
  const sx = Math.round(cam.x), sy = Math.round(cam.y), w = Math.ceil(viewW()) + 2, h = Math.ceil(viewH()) + 2;
  ctx.drawImage(world.terrain, sx, sy, w, h, 0, 0, w * k, h * k);
  const list: Sprite[] = [...world.statics, ...world.playerSprites(s, cache, freshMap, animClock).filter(sp => !sp.label?.startsWith('Solar') || lotAvailable(sp.id!))];
  // Barcos del jugador: atracados junto al muelle, zarpando despacio o volviendo
  let docked = 0;
  s.ships.forEach((sh, i) => {
    if (sh.underConstruction > 0) return;
    const an = shipAnims.find(a => a.shipId === sh.id);
    if (sh.voyageId && !an) return;                                   // en alta mar
    const slot = i < SPOTS.docks.length ? SPOTS.docks[i] : null;
    const dx0 = slot !== null ? SPOTS.dockX : 34 + (i % 2) * 4, dy0 = slot ?? 14 + (i - SPOTS.docks.length) * 9;
    if (!an) { docked++; const sp = world.shipSprite(sh.cls, 'so', 'recogida', dx0, dy0 + bob(i * 3) * 0.04, 0, 'muelle'); if (sp) list.push(sp); return; }
    const t = Math.min(1, (animClock - an.t0) / SAIL_MS);
    if (an.dir === 'out') {
      // Sale remando despacio hacia mar abierto; luego iza la vela y se aleja
      const e = t * t, x = dx0 + e * 24, sail = t < 0.35 ? 'remos' : 'izada';
      const sp = world.shipSprite(sh.cls, 'se', sail, x, dy0, animClock); if (sp) list.push({ ...sp, alpha: t > 0.85 ? (1 - t) / 0.15 : 1 });
    } else {
      // Vuelve costeando desde el norte a remo y atraca
      const e = 1 - (1 - t) * (1 - t), y = dy0 - (1 - e) * 22;
      const sp = world.shipSprite(sh.cls, 'so', t > 0.6 ? 'remos' : 'izada', dx0 + (1 - e) * 3, y, animClock); if (sp) list.push({ ...sp, alpha: t < 0.12 ? t / 0.12 : 1 });
    }
  });
  void docked;
  // Barco en construcción en la grada del astillero (3 fases)
  const build = s.ships.find(x => x.underConstruction > 0);
  if (build) {
    const total = E.SHIPS[build.cls].buildCycles, done = 1 - build.underConstruction / Math.max(1, total);
    const ph = done < 0.34 ? 1 : done < 0.67 ? 2 : 3, sp = world.objSprite(`barcos/barco_construccion_${ph}`, `barco_construccion_${ph}`, SPOTS.hull.x1, SPOTS.hull.y1, SPOTS.yard.x1 + SPOTS.yard.y1 + 0.3);
    if (sp) list.push(sp);
  }
  // Barcos extranjeros fondeados, barcas de pesca y el faro
  for (const f of world.foreign) { const sp = world.shipSprite(f.cls, f.dir, f.sail, f.x, f.y + bob(f.phase) * 0.04); if (sp) list.push(sp); }
  for (const b of world.boats) {
    const st = getStrip(`barcos/barca_pesca_${b.dir}`); if (!st) continue;
    const u = ((animClock / 1000 / 40 + b.t) % 2), q = u < 1 ? u : 2 - u;    // va y vuelve despacio
    const x = b.x + (b.dir === 'se' ? q * b.span : 0), y = b.y + (b.dir === 'so' ? q * b.span : 0);
    list.push(world.stripSprite(st, Math.floor(animClock / 400) % 2, x, y, u >= 1, 0, x + y + 0.4));
  }
  const faro = getStrip('costa/faro');
  if (faro) list.push(world.stripSprite(faro, Math.floor(animClock / 220) % 2, SPOTS.faro.x + 8, SPOTS.faro.y, false, HQ, SPOTS.faro.x + 8 + SPOTS.faro.y));
  // Carretas: aparcadas en las caballerizas y en camino
  if (s.stables) {
    const free = E.cartSlots(s) - s.landTrips.length;
    for (let i = 0; i < Math.min(free, 3); i++) { const sp = cartSprite('burro', 'so', 2.7 + i * 0.1, 29.6 + i * 1.6, 0); if (sp) list.push(sp); }
    for (const t of s.landTrips) {
      const leg = Math.max(1, t.legCycles), done = leg - t.cyclesLeft + s.time.cycleElapsed / E.BALANCE.cycleSeconds;
      const p = Math.min(1, done / Math.min(leg, 1.2));              // recorre el camino y sale por la puerta
      if (p >= 1) continue;
      const pt = world.roadPoint(t.phase === 'ida' ? p : 1 - p);
      const dir = t.phase === 'ida' ? pt.dir : ({ ne: 'so', so: 'ne', se: 'no', no: 'se' } as const)[pt.dir];
      const sp = cartSprite(t.cart, dir, pt.x, pt.y, animClock);
      if (sp) list.push({ ...sp, alpha: p > 0.9 ? (1 - p) / 0.1 : 1 });
    }
  }
  // Gente: caminantes, vendedores ofreciendo en puestos, personal y el mercader
  for (const wk of walkers) { const sp = personSprite(wk.art, wk.x, wk.y, wk.t, wk.dir, true); if (sp) list.push(sp); }
  for (const p of standing()) list.push(p);
  list.sort((a, b) => a.key - b.key);
  frameSprites = list;
  const x0 = cam.x - 260, x1 = cam.x + viewW() + 260, y0 = cam.y - 300, y1 = cam.y + viewH() + 260;
  for (const sp of list) {
    if (sp.x > x1 || sp.y > y1 || sp.x + sp.sw < x0 || sp.y + sp.sh < y0) continue;
    const dx = Math.round((sp.x - sx) * k), dy = Math.round((sp.y - sy) * k);
    if (sp.alpha !== undefined) ctx.globalAlpha = Math.max(0, Math.min(1, sp.alpha));
    if (sp.flip) { ctx.save(); ctx.translate(dx + sp.sw * k, dy); ctx.scale(-1, 1); ctx.drawImage(sp.src, sp.sx, sp.sy, sp.sw, sp.sh, 0, 0, sp.sw * k, sp.sh * k); ctx.restore(); }
    else ctx.drawImage(sp.src, sp.sx, sp.sy, sp.sw, sp.sh, dx, dy, sp.sw * k, sp.sh * k);
    ctx.globalAlpha = 1;
  }
  placeLabels(list);
}

function cartSprite(cart: string, dir: 'ne' | 'no' | 'se' | 'so', x: number, y: number, t: number): Sprite | null {
  const st = getStrip(`carretas/${CART_ART[cart]}_${dir}`); if (!st) return null;
  return world.stripSprite(st, t ? loopFrame(st, t) : 0, x, y, false, HQ, x + y + 0.2);
}

/** Elige la tira (frente o espaldas) y el espejo según la dirección de la marcha. */
function personSprite(art: string, x: number, y: number, t: number, dir: [number, number], walking: boolean): Sprite | null {
  const up = dir[0] < 0 || dir[1] < 0;                 // hacia arriba en pantalla: se ve la espalda
  const st = (up ? person(`${art}_espalda`) : null) ?? person(art);
  if (!st) return null;
  const flip = up ? dir[0] < 0 : dir[1] > 0;          // el frente mira abajo-derecha; la espalda, arriba-derecha
  let f = 0;
  if (walking) { const cyc = st.frames.slice(1); const total = cyc.reduce((a, b) => a + b.ms, 0); let m = t % total; f = 1; for (const fr of cyc) { if (m < fr.ms) break; m -= fr.ms; f++; } f = Math.min(f, st.frames.length - 1); }
  return world.stripSprite(st, f, x, y, flip);
}
function loopFrame(st: Strip, t: number) {
  const total = st.frames.reduce((a, b) => a + b.ms, 0); let m = t % total, f = 0;
  for (const fr of st.frames) { if (m < fr.ms) break; m -= fr.ms; f++; }
  return Math.min(f, st.frames.length - 1);
}

/** Vendedores ofreciendo en puestos y en la calle (en locales, almacenes y bazar trabajan dentro); almaceneros, arrieros y capitanes. */
function standing(): Sprite[] {
  const out: Sprite[] = [];
  const offer = person('pj_vendedor_ofrecer') ?? person('pj_vendedor')!;
  const amb = world.lots.find(l => l.id === 'ambulante')!;
  if (!s.venues.length) { const j = person('pj_jugador'); if (j) out.push(world.stripSprite(j, 0, amb.x1 + 0.4, amb.y1 + 0.2, false)); }
  for (const lot of world.lots) {
    if (lot.kind !== 'venue' || !lot.ref?.startsWith('puesto') || !s.venues.some(v => v.defId === lot.ref)) continue;
    s.workers.filter(w => w.venueId === lot.ref).forEach((_, i) => out.push(world.stripSprite(offer, loopFrame(offer, animClock + i * 333), lot.x1 + 0.3, lot.y0 + 0.4 + i * 0.7, true)));
  }
  const n = s.workers.filter(w => w.role === 'vendedor' && !w.venueId).length;
  for (let i = 0; i < n; i++) out.push(world.stripSprite(offer, loopFrame(offer, animClock + i * 271), amb.x0 - 0.8 - i * 0.8, amb.y1 + 0.6, false));
  // Almaceneros yendo y viniendo delante de los almacenes
  const places = world.warehousePlaces(s), wk = s.workers.filter(w => w.role === 'almacenero');
  wk.slice(0, 6).forEach((_, i) => {
    const p = places[i % Math.max(1, places.length)]; if (!p) return;
    const u = ((animClock / 1000 / 6 + i * 0.37) % 2), q = u < 1 ? u : 2 - u;
    const sp = personSprite('pj_almacenero', p.slot.x1 + 0.5, p.slot.y0 + 0.4 + q * (p.slot.y1 - p.slot.y0 - 0.8), animClock + i * 200, [0, u < 1 ? 1 : -1], true); if (sp) out.push(sp);
  });
  // Arriero junto a las caballerizas; capitanes en el muelle
  if (s.stables) { const sp = personSprite('pj_arriero', 2.2, 32.6, 0, [1, 0], false); if (sp) out.push(sp); }
  s.captains.slice(0, 3).forEach((_, i) => { const sp = personSprite('pj_capitan', QX - 0.6, SPOTS.docks[i] - 0.6, 0, [1, 0], false); if (sp) out.push(sp); });
  return out;
}

// Etiquetas: edificios con nombre y solares que ya se pueden ocupar
const tagEls = new Map<string, HTMLElement>();
function lotAvailable(id: string): boolean {
  if (id === 'lot:almacenes') return E.hasMilestone(s, 8);
  const lot = world.lots.find(l => `lot:${l.id}` === id);
  return !lot?.ref || !E.venueBlock(s, lot.ref, 'rent');
}
function placeLabels(list: Sprite[]) {
  const seen = new Set<string>();
  const cands = list.filter(sp => sp.id && sp.label && (!sp.label.startsWith('Solar') || lotAvailable(sp.id)) && (sp.id !== 'caballerizas' || E.hasMilestone(s, 30)))
    .sort((a, b) => Number(a.label!.startsWith('Solar')) - Number(b.label!.startsWith('Solar')));
  const boxes: { l: number; r: number; t: number; b: number }[] = [];
  for (const sp of cands) {
    if (seen.has(sp.id!)) continue;
    seen.add(sp.id!);
    let el = tagEls.get(sp.id!);
    if (!el) { el = document.createElement('div'); labels.appendChild(el); tagEls.set(sp.id!, el); }
    el.className = `panel tag ${sp.label!.startsWith('Solar') ? 'lot' : ''}`;
    const lab = H(sp.label!);
    if (el.textContent !== lab) el.textContent = lab;
    const [x, y] = toScreen(sp.x + sp.sw / 2, sp.y + 4);
    const w = lab.length * 6.6 + 18, hh = 24;
    const bx = { l: x - w / 2, r: x + w / 2, t: y - hh, b: y };
    const clash = boxes.some(o => bx.l < o.r && bx.r > o.l && bx.t < o.b && bx.b > o.t);
    el.hidden = clash || x < -80 || x > innerWidth + 80 || y < 120 || y > innerHeight - 80;
    if (!el.hidden) boxes.push(bx);
    el.style.left = `${x}px`; el.style.top = `${y}px`;
  }
  for (const [id, el] of tagEls) if (!seen.has(id)) { el.remove(); tagEls.delete(id); }
}

function hitTest(cx: number, cy: number): Sprite | null {
  const wx = cam.x + cx / zoom, wy = cam.y + cy / zoom;
  for (let i = frameSprites.length - 1; i >= 0; i--) {
    const sp = frameSprites[i];
    if (!sp.id || !sp.mask) continue;
    const lx = Math.floor(wx - sp.x), ly = Math.floor(wy - sp.y);
    if (lx < 0 || ly < 0 || lx >= sp.mask.w || ly >= sp.sh) continue;
    if (sp.mask.m[ly * sp.mask.w + lx]) return sp;
  }
  return null;
}

// ---------------------------------------------------------------------------- barra superior
function nextMilestone() {
  for (const id of E.MILESTONE_ORDER) { const m = E.MILESTONES.find(x => x.id === id)!; if (!E.hasMilestone(s, id) && !m.pending) return m; }
  return null;
}
function renderHud() {
  const bs = E.balanceSheet(s), lp = E.levelProgress(s), nm = nextMilestone();
  const recent = s.history.slice(-5), avg = recent.length ? recent.reduce((a, r) => a + r.netProfit, 0) / recent.length : 0;
  const cyc = s.time.cycleElapsed / E.BALANCE.cycleSeconds;
  const used = E.inventoryUnits(s), cap = E.storageCapacity(s);
  hud.innerHTML = H(`
    <button class="panel hudhito" data-act="open" data-a="hitos" aria-label="Camino de hitos">${nm ? ui(`hito_${E.MILESTONE_FAMILY[nm.id]}`) : ui('aviso_nivel')}<small>${nm ? 'Hito ' + nm.id : '✓'}</small></button>
    <div class="panel res"><div class="row"><span class="cash">${ui('moneda')}${fmt(s.cash)}</span><span class="rate ${avg < 0 ? 'down' : ''}">${avg >= 0 ? '▲' : '▼'} ${sign(avg)}/ciclo</span></div>
      <div class="row"><span class="mini">${ui('patrimonio')}${fmt(bs.netWorth)}</span><span class="mini store ${used >= cap ? 'full' : ''}">${ui('almacen')}${fmt(used)}/${fmt(cap)}</span>${s.arrears > 0 ? `<span class="mini debt">${ui('fin_deuda')}${fmt(s.arrears)}</span>` : ''}</div></div>
    <button class="panel lvl" data-act="open" data-a="hitos" aria-label="Nivel"><span class="t">${ui('nivel')}Nivel ${s.level}</span><div class="bar"><i style="width:${Math.round((lp?.xp ?? 1) * 100)}%"></i></div>
      <span class="cyc">${ui(s.time.speed === 0 ? 'pausa' : s.time.speed === 6 ? 'x6' : 'ciclo')}<span class="bar"><i style="width:${Math.round(cyc * 100)}%"></i></span><span class="spd ${s.time.speed === 6 ? 'fast' : s.time.speed === 0 ? 'paused' : ''}">${s.time.speed === 0 ? 'II' : '×' + s.time.speed}</span></span></button>`);
  goal.innerHTML = H(`<button class="crest" data-act="pause" aria-label="Pausa y menú">${img(`escudos/escudo_${s.cityId}`)}<b class="pz">II</b></button><span>${goalText(nm)}</span>`);
  const unread = s.notifications.length - seenNotes;
  nav.innerHTML = NAV.map(([id, l, icon]) => `<button data-act="nav" data-a="${id}" class="${navOn() === id ? 'on' : ''}">${ui(icon)}${l}${id === 'avisos' && unread > 0 ? `<b class="badge">${Math.min(99, unread)}</b>` : ''}</button>`).join('');
}
const NAV: [string, string, string][] = [['ciudad', 'Ciudad', 'ciudad'], ['mercado', 'Mercado', 'mercado'], ['muelle', 'Muelle', 'muelle'], ['mapa', 'Mapa', 'mapa'], ['avisos', 'Avisos', 'avisos']];
const navOn = () => (sheet && ['mercado', 'muelle', 'mapa', 'avisos'].includes(sheet) ? sheet : 'ciudad');
function goalText(nm: ReturnType<typeof nextMilestone>): string {
  if (s.arrears > 0) return `<b class="neg">Tienes ${fmt(s.arrears)} en deudas.</b> Págalas en la Oficina del puerto`;
  return nm ? `<b>Hito ${nm.id}:</b> ${esc(nm.name)} · ${esc(nm.condition)}` : '<b>Has alcanzado todos los hitos</b>';
}

// ---------------------------------------------------------------------------- avisos
let seenNotes = 0;
let lastNote: Notification | null = null;
const KIND_ICON: Record<string, string> = { info: 'aviso_info', exito: 'aviso_exito', alerta: 'aviso_alerta', evento: 'aviso_evento', hito: 'aviso_hito', nivel: 'aviso_nivel' };
const EVENT_ICON: Record<string, string> = { escasez_cedro: 'ev_escasez_cedro', malas_cosechas: 'ev_malas_cosechas', nuevo_proveedor: 'ev_nuevo_proveedor', bloqueo_portuario: 'ev_bloqueo_portuario', pirateria: 'ev_pirateria', demanda_lujo: 'ev_fiebre_lujo', cambio_gobierno: 'ev_cambio_gobierno', nuevos_impuestos: 'ev_nuevos_impuestos', feria: 'ev_feria', crisis_competidores: 'ev_crisis_competidores', descubrimiento_ruta: 'ev_nueva_ruta' };
function noteIcon(n: Notification): string {
  const t = n.text;
  if (n.kind === 'evento' || /^Terminó: /.test(t)) { const ev = E.EVENTS.find(e => t.startsWith(e.name) || t.startsWith(`Terminó: ${e.name}`)); if (ev) return EVENT_ICON[ev.id] ?? KIND_ICON.evento; }
  if (n.kind === 'hito' || n.kind === 'nivel' || n.kind === 'evento') return KIND_ICON[n.kind];
  if (/[Bb]loqueo/.test(t)) return 'ev_bloqueo_portuario';
  if (/barco|galera|nave|Piratas|expedición|ruta|astillero/i.test(t)) return 'aviso_barco';
  if (/[Cc]ontrato/.test(t)) return 'aviso_contrato';
  if (/[Cc]ontrataste|trabajador|renunci|capitán|vendedor/.test(t)) return 'aviso_personal';
  if (/[Dd]euda|[Pp]réstamo|embarg|acreedor|monedas/.test(t)) return 'aviso_dinero';
  return KIND_ICON[n.kind] ?? 'aviso_info';
}
function pushToasts() {
  const idx = lastNote ? s.notifications.lastIndexOf(lastNote) + 1 : s.notifications.length;
  const fresh = s.notifications.slice(idx);
  if (s.notifications.length) lastNote = s.notifications[s.notifications.length - 1];
  for (const n of fresh.slice(-3)) toast(n.text, n.kind, noteIcon(n));
  if (fresh.length) audio.sfx('notificacion');
}
/** Aviso flotante. Los errores puntuales (falta dinero, sin espacio) sólo se muestran aquí, no se guardan. */
function toast(text: string, kind = 'info', icon = KIND_ICON[kind] ?? 'aviso_info', action?: { label: string; act: string; a?: string }) {
  const t = document.createElement('div'); t.className = `panel toast ${kind}`;
  t.innerHTML = `${ui(icon)}<span>${esc(H(text))}</span>${action ? `<button class="btn small" data-act="${action.act}" data-a="${action.a ?? ''}">${esc(action.label)}</button>` : ''}`;
  t.addEventListener('click', e => { if (!(e.target as HTMLElement).closest('button')) t.remove(); });
  toasts.appendChild(t); setTimeout(() => t.remove(), action ? 9000 : 6500);
  while (toasts.children.length > 3) toasts.firstElementChild!.remove();
}

// Monedas que saltan sobre los puestos con cada venta
let lastRevenue = 0, lastPop = 0;
function coinPops(now: number) {
  if (now - lastPop < 1400) return;
  lastPop = now;
  const gained = s.stats.lifetimeRevenue - lastRevenue; lastRevenue = s.stats.lifetimeRevenue;
  if (gained < 1) return;
  const spots = frameSprites.filter(sp => sp.id?.startsWith('lot:') && !sp.label?.startsWith('Solar') && sp.id !== 'lot:almacenes');
  const sp = spots[Math.floor(Math.random() * spots.length)];
  if (!sp) return;
  const [x, y] = toScreen(sp.x + sp.sw / 2, sp.y);
  const p = document.createElement('div'); p.className = 'pop'; p.innerHTML = `+${fmt(gained)}${ui('moneda')}`;
  p.style.left = `${x}px`; p.style.top = `${y}px`;
  labels.appendChild(p); setTimeout(() => p.remove(), 1350);
}

// ---------------------------------------------------------------------------- hojas
const A = E.actions;
type R = E.ActionResult<any>;
function act(r: R, ok?: string, sfx: 'compra' | null = null) {
  if (sfx) audio.sfx(sfx);
  if (!r.ok) {
    if ((r.data as any)?.noSpace) toast(r.error ?? 'Sin espacio', 'alerta', 'ui_almacen', E.hasMilestone(s, 8) ? { label: 'Ver almacenes', act: 'open', a: 'almacenes' } : undefined);
    else toast(r.error ?? 'No se pudo', 'alerta');
  } else if (r.warning) toast(r.warning, 'alerta', 'aviso_dinero');
  else if (ok) toast(ok, 'exito');
  renderSheet(true); renderHud();
}
function openSheet(id: string | null) {
  if (id && id !== sheet) audio.sfx('abrir');
  sheet = id;
  if (id === 'avisos') seenNotes = s.notifications.length;
  if (id === 'mercado' && !['comprar', 'vender', 'proveedores', 'contratos'].includes(sheetTab)) sheetTab = 'comprar';
  renderSheet(true); renderHud();
}
const TITLES: Record<string, string> = { mercado: 'Mercado', muelle: 'Muelle', mapa: 'Rutas y expediciones', hitos: 'Camino de hitos', oficina: 'Oficina del puerto · Finanzas', finanzas: 'Finanzas', almacenes: 'Almacenes y almaceneros', menu: 'Menú', astillero: 'Astillero', caballerizas: 'Caballerizas · Rutas por tierra', avisos: 'Avisos', ayuda: 'Qué significa cada mensaje', ajustes: 'Ajustes de sonido', templo: '{templo}', talleres: 'Talleres de la ciudad' };

let sheetBusy = false, lastSheetHtml = '';
function renderSheet(force = false) {
  if (!sheet) { sheetEl.hidden = true; return; }
  if (!force && sheetBusy) return;
  sheetEl.hidden = false;
  const lot = sheet.startsWith('lot:') ? world.lots.find(l => `lot:${l.id}` === sheet) : null;
  const title = lot ? lot.label : sheet.startsWith('taller:') ? E.WORKSHOPS.find(w => w.id === sheet!.slice(7))?.name ?? 'Taller' : TITLES[sheet] ?? '';
  let head = '', body = '';
  switch (sheet) {
    case 'mercado': [head, body] = sheetMarket(); break;
    case 'muelle': case 'astillero': body = sheetDock(); break;
    case 'mapa': body = sheetMap(); break;
    case 'hitos': body = sheetHitos(); break;
    case 'templo': body = sheetTemple(); break;
    case 'talleres': body = sheetWorkshops(); break;
    case 'oficina': case 'finanzas': body = sheetFinance(); break;
    case 'almacenes': case 'lot:almacenes': body = sheetWarehouses(); break;
    case 'caballerizas': body = sheetStables(); break;
    case 'avisos': body = sheetNotes(); break;
    case 'ayuda': body = sheetHelp(); break;
    case 'ajustes': body = sheetSettings(); break;
    default: body = sheet.startsWith('taller:') ? sheetWorkshops(sheet.slice(7)) : lot?.kind === 'ambulante' ? sheetAmbulant() : lot ? sheetVenue(lot.ref!) : '';
  }
  const html = H(`<header><h2>${esc(title)}</h2><button class="x" data-act="close" aria-label="Cerrar">✕</button></header>${head ? `<div class="fixed">${head}</div>` : ''}<div class="body">${body}</div>`);
  if (html === lastSheetHtml && sheetEl.firstChild) return;      // nada cambió: no se toca el DOM
  lastSheetHtml = html;
  const scroll = sheetEl.querySelector('.body')?.scrollTop ?? 0;
  sheetEl.innerHTML = html;
  sheetEl.querySelector('.body')!.scrollTop = scroll;
}

// ---- indicador de venta junto a «Tienes»
function stockIndicator(id: string): string {
  const st = E.stockOf(s, id), gs = s.goodStats[id];
  if (st <= 0) return `<span class="ind" title="Sin stock">${ui('ind_sin_stock')}</span>`;
  if (gs && s.time.simSeconds - gs.lastSale < 8) return `<span class="ind" title="Se vende">${ui('ind_vende')}</span>`;
  if (E.availableDemand(s, id) <= 0) return `<span class="ind" title="Estancado: no hay más clientes este ciclo">${ui('ind_estancado')}</span>`;
  if (st > Math.max(20, E.demandPerCycle(s, id) * 4)) return `<span class="ind" title="Demasiado stock">${ui('ind_exceso')}</span>`;
  return '';
}
const qtyBtns = (actn: string, id: string, label: string, dis: boolean) =>
  `<button class="btn gold" data-act="${actn}" data-a="${id}" data-q="1" ${dis ? 'disabled' : ''}>${label}</button>${[10, 50].map(q => `<button class="btn q" data-act="${actn}" data-a="${id}" data-q="${q}" ${dis ? 'disabled' : ''}>×${q}</button>`).join('')}<button class="btn q" data-act="${actn}" data-a="${id}" data-q="max" ${dis ? 'disabled' : ''}>Máx</button>`;

function sheetMarket(): [string, string] {
  const tabs: [string, string][] = [['comprar', 'Comprar'], ['vender', 'Vender'], ...(E.hasMilestone(s, 11) ? [['proveedores', 'Proveedores'] as [string, string]] : []), ...(E.hasMilestone(s, 2) ? [['contratos', 'Contratos'] as [string, string]] : [])];
  const head = `<div class="tabs">${tabs.map(([id, l]) => `<button class="${sheetTab === id ? 'on' : ''}" data-act="tab" data-a="${id}">${l}</button>`).join('')}</div>`
    + (sheetTab === 'vender' ? `<p class="hint">${s.time.speed === 0 ? 'El tiempo está en pausa: no hay clientes.' : `Puedes atender a <b>${Math.floor(s.manualCapacityLeft)}</b> clientes más este ciclo. Los clientes compran de uno en uno.`}${E.hasMilestone(s, 14) ? ` <button class="infobtn" data-act="info" data-a="vender_distribuir">${ui('info')} Vender o distribuir</button>` : ''} <button class="infobtn" data-act="info" data-a="indicadores">${ui('info')} Indicadores</button></p>` : '')
    + (sheetTab === 'comprar' ? `<p class="hint">Compra barato y vende en la pestaña Vender. <button class="infobtn" data-act="info" data-a="indicadores">${ui('info')} Indicadores</button></p>` : '');
  let out = '';
  if (sheetTab === 'comprar' || sheetTab === 'vender') {
    const goods = sheetTab === 'comprar' ? E.GOODS.filter(g => g.unlockLevel <= s.level + 1) : E.GOODS.filter(g => E.stockOf(s, g.id) > 0);
    if (!goods.length) out += '<p>No tienes mercancía. Compra primero en la pestaña Comprar.</p>';
    out += goods.map(g => {
      const lock = E.goodLockReason(s, g.id), st = E.stockOf(s, g.id), b = E.buyPrice(s, g.id), v = E.sellPrice(s, g.id);
      const qd = E.queuedFor(s, g.id), wait = s.sellQueue.find(o => o.goodId === g.id)?.waiting;
      const detail = sheetTab === 'comprar' ? `Compra ${fmt(b)} · Venta ${fmt(v)} · Tienes ${fmt(st)}` : `Venta ${fmt(v)} · Costo ${s.inventory[g.id].avgCost.toFixed(1)} · Tienes ${fmt(st)}${qd ? ` · <b class="pos">a la venta ${fmt(qd)}</b>${wait ? ` <span class="why">(${esc(wait)})</span>` : ''}` : ''}`;
      const acts = sheetTab === 'comprar' ? qtyBtns('buy', g.id, 'Comprar', !!lock)
        : qtyBtns('sell', g.id, 'Vender', qd >= st) + (qd ? `<button class="chip" data-act="sellstop" data-a="${g.id}">Parar</button>` : '') + (E.hasMilestone(s, 14) ? `<button class="btn" data-act="dist" data-a="${g.id}" data-q="max">Distribuir</button>` : '');
      return `<div class="good ${lock ? 'locked' : ''}"><span class="ic">${goodIcon(g.id)}</span><span class="nm">${esc(g.name)}<small>${lock ? esc(lock) : detail} ${lock ? '' : stockIndicator(g.id)}</small></span><span class="acts">${acts}</span></div>`;
    }).join('');
  } else if (sheetTab === 'proveedores') out = sheetSuppliers();
  else out = sheetContracts();
  return [head, out];
}

// ---- proveedores: oferta → costo → «lo está pensando» → respuesta (con el retrato del proveedor)
const PORTRAIT_FRAME: Record<string, number> = { pensando: 0, acepta: 2, contraoferta: 3, rechaza: 4 };
function portrait(name: string, state: string): string {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `<span class="portrait ${state}" style="--i:${PORTRAIT_FRAME[state]};background-image:url(./assets/retratos/retrato_proveedor_${1 + h % 4}.png)"></span>`;
}
interface Nego { offerId: string; pct: number; phase: 'confirm' | 'thinking' | 'answer'; outcome?: 'aceptada' | 'contraoferta' | 'rechazada'; price?: number; t0: number }
let nego: Nego | null = null;
function sheetSuppliers(): string {
  let out = '<p>Los proveedores venden lotes grandes. Toca una oferta: verás lo que te costaría antes de proponerla.</p>';
  out += s.supplierOffers.map(o => {
    const g = E.GOOD_BY_ID[o.goodId], price = o.agreedPrice ?? o.refPrice, n = nego?.offerId === o.id ? nego : null;
    let mid = '';
    if (n?.phase === 'confirm') {
      const p = Math.round(o.refPrice * (1 - n.pct / 100));
      mid = `<div class="nego">Ofreces <b>${fmt(p)}</b> por unidad: el lote mínimo de ${fmt(o.minQty)} te costaría <b>${fmt(p * o.minQty)}</b>.<div class="row"><button class="btn gold" data-act="nego_go" data-a="${o.id}">Proponer</button><button class="btn" data-act="nego_cancel">Cambiar</button></div></div>`;
    } else if (n?.phase === 'thinking') mid = `<div class="nego thinking">${portrait(o.supplierName, 'pensando')} El proveedor lo está pensando<span class="dots"><i>.</i><i>.</i><i>.</i></span></div>`;
    else if (n?.phase === 'answer') mid = n.outcome === 'aceptada' ? `<div class="nego ok">${portrait(o.supplierName, 'acepta')}<span>✓ <b>Acepta</b> a ${fmt(n.price!)} por unidad.</span></div>`
      : n.outcome === 'contraoferta' ? `<div class="nego warn">${portrait(o.supplierName, 'contraoferta')}<span>El proveedor <b>contraoferta</b>: ${fmt(n.price!)} por unidad (lote ${fmt(o.minQty)} = ${fmt(n.price! * o.minQty)}).<div class="row"><button class="btn gold" data-act="counter" data-a="${o.id}">Aceptar ${fmt(n.price!)}</button></div></span></div>`
      : `<div class="nego bad">${portrait(o.supplierName, 'rechaza')}<span>✕ <b>Rechaza</b>: tu oferta es demasiado baja.${o.attemptsLeft ? ' Prueba con otra.' : ' Ya no quiere negociar hoy.'}</span></div>`;
    return `<div class="card"><div class="row"><span class="ic">${goodIcon(o.goodId)}</span><b>${esc(g.name)}</b><span class="pill">${esc(o.supplierName)}</span>${o.wholesale ? '<span class="pill gold">Mayorista</span>' : ''}</div>
      <div class="kv"><span>Precio de referencia</span><span>${fmt(o.refPrice)} (mercado ${fmt(E.buyPrice(s, o.goodId))})</span><span>Lote</span><span>${fmt(o.minQty)}–${fmt(o.maxQty)} u.</span><span>Intentos</span><span>${o.attemptsLeft}</span></div>
      ${mid}
      <div class="row">${o.agreedPrice !== null ? `<span class="pill ok">Pactado ${fmt(o.agreedPrice)}</span>` : (n && n.phase !== 'answer') ? '' : [5, 10, 15].map(p => `<button class="chip" data-act="nego" data-a="${o.id}|${p}" ${o.attemptsLeft ? '' : 'disabled'}>Ofrecer −${p}%</button>`).join('')}
      <button class="btn" data-act="supbuy" data-a="${o.id}" ${n?.phase === 'thinking' ? 'disabled' : ''}>Comprar ${fmt(o.minQty)} × ${fmt(price)} = ${fmt(o.minQty * price)}</button></div></div>`;
  }).join('') || '<p>No hay ofertas ahora; llegan nuevas cada ciclo.</p>';
  return out;
}

function sheetContracts(): string {
  const list = s.contracts.filter(c => c.status === 'oferta' || c.status === 'aceptado');
  let out = `<p>Cumplir contratos da prestigio; incumplirlos lo resta.</p>` + (list.map(c => `<div class="card"><div class="row"><span class="ic">${goodIcon(c.goodId)}</span><b>${c.qty} ${esc(E.GOOD_BY_ID[c.goodId].name)}</b>${c.kind === 'internacional' ? `<span class="pill">→ ${esc(E.PORT_BY_ID[c.port!].name)}</span>` : ''}</div>
      <div class="kv"><span>Pago por unidad</span><span>${fmt(c.unitPrice)}</span><span>${c.status === 'oferta' ? 'La oferta vence en' : 'Plazo'}</span><span>${(c.status === 'oferta' ? c.offerExpires : c.deadline) - s.time.cycle} ciclos</span><span>Prestigio</span><span>+${c.prestige}</span></div>
      <div class="row">${c.status === 'oferta' ? `<button class="btn gold" data-act="acceptk" data-a="${c.id}">Aceptar</button>` : c.kind === 'local' ? `<button class="btn gold" data-act="deliver" data-a="${c.id}">Entregar (${c.delivered}/${c.qty} · tienes ${E.stockOf(s, c.goodId)})</button>` : '<span class="pill">Se entrega con un barco</span>'}</div></div>`).join('') || '<p>No hay contratos ahora.</p>');
  // Contratos exclusivos
  out += `<h3>${ui('ui_contrato_exclusivo')} Contratos exclusivos</h3><p>Al vender ${fmt(E.BALANCE.exclusiveUnits)} unidades de un producto, puedes pactar una compra automática y permanente cada ciclo a precio rebajado.</p>`;
  const goods = E.GOODS.filter(g => (s.goodStats[g.id]?.units ?? 0) > 0).sort((a, b) => (s.goodStats[b.id]?.units ?? 0) - (s.goodStats[a.id]?.units ?? 0)).slice(0, 8);
  out += goods.map(g => {
    const u = s.goodStats[g.id]?.units ?? 0, ok = E.exclusiveAvailable(s, g.id), k = s.exclusives.find(x => x.goodId === g.id);
    return `<div class="good ${ok ? '' : 'locked'}"><span class="ic">${goodIcon(g.id)}</span><span class="nm">${esc(g.name)}<small>${ok ? (k?.active ? `Activo: ${k.qty} por ciclo a ${fmt(k.price)}` : 'Disponible') : `${fmt(u)} / ${fmt(E.BALANCE.exclusiveUnits)} vendidas`}</small></span>
      <span class="acts">${ok ? [0, 10, 25, 50].map(q => `<button class="chip ${k?.active && k.qty === q || (!k?.active && q === 0) ? 'on' : ''}" data-act="excl" data-a="${g.id}|${q}">${q ? q + '/ciclo' : 'No'}</button>`).join('') : ''}${E.hasMilestone(s, 28) && k?.active ? (s.monopolies.includes(g.id) ? `<button class="chip on" data-act="mono" data-a="${g.id}|0">Monopolio ✓</button>` : `<button class="chip" data-act="mono" data-a="${g.id}|1" ${E.monopolyBlock(s, g.id) ? 'disabled' : ''}>Monopolio · ${fmt(E.MONOPOLY_FEE)}/ciclo</button>`) : ''}</span></div>`;
  }).join('') || '<p>Aún no has vendido nada.</p>';
  return out;
}

// ---- personal y lugares
const infoBtn = (key: string) => `<button class="infobtn" data-act="info" data-a="${key}" aria-label="Información">${ui('info')}</button>`;
function staffList(role: 'vendedor' | 'almacenero', venue?: string | null): string {
  const list = s.workers.filter(w => w.role === role && (venue === undefined || w.venueId === venue));
  return list.map(w => `<div class="row staff"><span>${esc(w.name)}</span><span class="pill">${w.salary}/ciclo</span><button class="chip" data-act="fire" data-a="${w.id}">Despedir</button></div>`).join('');
}
function hireBtn(role: 'vendedor' | 'almacenero', venue: string | null, label = `Contratar ${E.ROLES[role].name.toLowerCase()}`) {
  const block = E.canHire(s, role, venue);
  return `<button class="btn gold" data-act="hire" data-a="${role}|${venue ?? ''}" ${block ? 'disabled' : ''}>${label} · ${E.salaryFor(s, role)}/ciclo</button>${block ? `<small class="why">${esc(block)}</small>` : ''}`;
}
function sheetAmbulant(): string {
  return `<p>Vendes en la calle con tu cesta. <b>Tú</b> atiendes hasta ${E.BALANCE.manualCustomersPerCycle} clientes por ciclo desde el Mercado; un <b>vendedor ambulante</b> vende solo lo que tengas en inventario.</p>
    <div class="kv"><span>Clientes que puedes atender</span><span>${Math.floor(s.manualCapacityLeft)}</span><span>Capacidad de tus vendedores</span><span>${fmt(E.salesCapacity(s))} u/ciclo</span></div>
    <div class="row"><button class="btn" data-act="nav" data-a="mercado">Ir al mercado</button></div>
    <h3>Vendedores ambulantes ${infoBtn('vendedor')}</h3>${staffList('vendedor', null) || '<p>Nadie vende por ti todavía.</p>'}
    <div class="row">${hireBtn('vendedor', null, 'Contratar vendedor ambulante')}</div>`;
}
function sheetVenue(ref: string): string {
  const d = E.VENUES.find(v => v.id === ref)!, v = s.venues.find(x => x.defId === ref);
  const info = `<div class="kv"><span>Tráfico</span><span>×${d.traffic} ventas por vendedor</span><span>Plazas de vendedor</span><span>${v ? `${E.slotsUsed(s, ref)}/` : ''}${d.slots}</span><span>Almacena</span><span>${d.storage} u.</span><span>Alquiler</span><span>${E.venueRent(s, d)}/ciclo</span>${d.price ? `<span>Compra</span><span>${fmt(d.price)} (mantenimiento ${E.venueUpkeep(s, d)}/ciclo)</span>` : ''}</div>`;
  if (!v) {
    const rb = E.venueBlock(s, ref, 'rent'), bb = d.price ? E.venueBlock(s, ref, 'buy') : null;
    return `<p>${rb ? `<span class="why">${esc(rb)}</span>` : 'Este solar está libre.'}</p>${info}
      <div class="row"><button class="btn gold" data-act="rentv" data-a="${ref}" ${rb ? 'disabled' : ''}>Alquilar</button>${d.price ? `<button class="btn" data-act="buyv" data-a="${ref}" ${bb ? 'disabled' : ''}>Comprar · ${fmt(d.price)}</button>` : ''}</div>${bb && !rb && d.price ? `<small class="why">${esc(bb)}</small>` : ''}`;
  }
  const amb = s.workers.some(w => w.role === 'vendedor' && !w.venueId), full = E.slotsUsed(s, ref) >= d.slots;
  return `<div class="row"><span class="pill ${v.owned ? 'ok' : 'gold'}">${v.owned ? 'Propio' : 'Alquilado'}</span>${d.kind === 'local' ? '<span class="pill">Los vendedores trabajan dentro</span>' : ''}</div>${info}
    <h3>Vendedores aquí</h3>${staffList('vendedor', ref) || '<p>Nadie trabaja aquí todavía.</p>'}
    <div class="row">${hireBtn('vendedor', ref)} ${infoBtn('vendedor')}</div>
    ${amb ? `<div class="row"><button class="btn" data-act="move" data-a="${ref}" ${full ? 'disabled' : ''}>Traer un vendedor ambulante</button> ${infoBtn('ambulante')}</div>` : ''}
    <div class="row">${!v.owned && d.price ? `<button class="btn" data-act="buyv" data-a="${ref}" ${E.hasMilestone(s, 10) ? '' : 'disabled'}>Comprar · ${fmt(d.price)}</button>` : ''}${v.owned ? `<button class="btn" data-act="ask_sellv" data-a="${ref}">Vender</button>` : `<button class="btn" data-act="ask_relv" data-a="${ref}">Dejar el alquiler</button>`}</div>`;
}
function sheetWarehouses(): string {
  const used = E.inventoryUnits(s), cap = E.storageCapacity(s);
  const own = s.warehouses.map(w => {
    const d = E.WAREHOUSES.find(x => x.id === w.defId)!, need = used - (cap - d.capacity);
    return `<div class="good"><span class="ic">${img(`edificios/${WH_ART[d.id]}`, 'w30')}</span><span class="nm">${esc(d.name)} · ${fmt(d.capacity)} u.<small>${w.owned ? 'Propio' : `Alquilado · ${E.warehouseRent(s, d)}/ciclo`}${need > 0 ? ` · <span class="why">para dejarlo vende antes ${fmt(need)} u.</span>` : ''}</small></span><span class="acts"><button class="btn" data-act="ask_relw" data-a="${w.uid}">${w.owned ? 'Vender' : 'Dejar el alquiler'}</button></span></div>`;
  }).join('');
  const rs = E.hasMilestone(s, 9) && s.workers.some(w => w.role === 'almacenero');
  const goods = E.GOODS.filter(g => E.stockOf(s, g.id) > 0 || (s.goodStats[g.id]?.units ?? 0) > 0);
  const restock = goods.map(g => {
    const t = E.settingsOf(s, g.id).restockTarget, auto = E.restockTargetOf(s, g.id);
    const chip = (v: number, l: string) => `<button class="chip ${t === v ? 'on' : ''}" data-act="restock" data-a="${g.id}|${v}">${l}</button>`;
    return `<div class="good"><span class="ic">${goodIcon(g.id)}</span><span class="nm">${esc(g.name)}<small>Tienes ${fmt(E.stockOf(s, g.id))}${auto > 0 ? ` · repone hasta ${fmt(auto)}` : ' · no repone'}</small></span><span class="acts">${chip(-1, 'Auto')}${[50, 200].map(v => chip(v, String(v))).join('')}${chip(0, 'No')}</span></div>`;
  }).join('');
  return `<div class="kv"><span>Espacio usado</span><span>${fmt(used)} / ${fmt(cap)}</span></div>
    <h3>Tus almacenes</h3>${own || '<p>Aún no tienes almacenes. Tu cesta guarda 60 unidades.</p>'}
    <h3>Alquilar o comprar</h3>
    ${E.WAREHOUSES.map(d => { const rb = E.warehouseBlock(s, d.id, 'rent'), bb = E.warehouseBlock(s, d.id, 'buy'); return `<div class="good ${rb ? 'locked' : ''}"><span class="ic">${img(`edificios/${WH_ART[d.id]}`, 'w30')}</span><span class="nm">${esc(d.name)}<small>${rb ? esc(rb) : `${fmt(d.capacity)} u. · alquiler ${E.warehouseRent(s, d)}/ciclo · compra ${fmt(d.price)}`}</small></span><span class="acts"><button class="btn gold" data-act="rentw" data-a="${d.id}" ${rb ? 'disabled' : ''}>Alquilar</button><button class="btn" data-act="buyw" data-a="${d.id}" ${bb ? 'disabled' : ''} title="${esc(bb ?? '')}">Comprar</button></span></div>`; }).join('')}
    <h3>Almaceneros ${infoBtn('almacenero')}</h3>${staffList('almacenero') || '<p>Ninguno.</p>'}<div class="row">${hireBtn('almacenero', null)}</div>
    ${rs ? `<h3>Reposición ${infoBtn('restock')}</h3>${restock || '<p>Cuando vendas algo, aquí eliges qué reponen.</p>'}` : ''}`;
}

// ---- finanzas (mejora 8)
function sheetFinance(): string {
  const h = s.history.slice(-10), n = Math.max(1, h.length), last = h[h.length - 1];
  const sum = (pre: string) => h.reduce((a, r) => a + Object.entries(r.lines).filter(([k2]) => k2.startsWith(pre)).reduce((b, [, v]) => b + v, 0), 0);
  const rev = sum('revenue.'), cogs = sum('cogs.');
  const cats: [string, string, number][] = [
    ['fin_mercancia', 'Mercancía vendida (lo que te costó)', cogs],
    ['fin_sueldos', 'Sueldos', sum('fixed.salarios') + sum('fixed.capitanes')],
    ['fin_alquileres', 'Alquileres', sum('fixed.alquiler')],
    ['fin_impuestos', 'Impuestos y mantenimiento', sum('fixed.mantenimiento') + sum('fixed.amarre') + sum('fixed.astillero') + sum('fixed.rutas') + sum('fixed.reparaciones')],
    ['fin_transporte', 'Transporte (barcos y carretas)', sum('variable.')],
    ['fin_intereses', 'Intereses y recargos', sum('interest.')],
  ];
  const spent = cats.reduce((a, c) => a + c[2], 0) + sum('loss.');
  const channels: [string, number][] = [['Ventas propias', sum('revenue.manual')], ['Vendedores', sum('revenue.auto')], ['Distribución', sum('revenue.wholesale')], ['Pueblos (carretas)', sum('revenue.tierra')], ['Puertos (barcos)', sum('revenue.maritime')], ['Contratos', sum('revenue.contracts')]];
  const top = Object.entries(s.goodStats).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
  const bs = E.balanceSheet(s), max = Math.max(1, ...cats.map(c => c[2]));
  return `<div class="tabs"><span class="pill">Últimos ${n} ciclos</span></div>
    <div class="fin-sum"><div>${ui('fin_ventas')}<span>Vendes</span><b class="pos">${fmt(rev / n)}</b><small>por ciclo</small></div><div>${ui('fin_mercancia')}<span>Gastas</span><b class="neg">${fmt(spent / n)}</b><small>por ciclo</small></div><div>${ui('moneda')}<span>Ganas</span><b class="${rev - spent >= 0 ? 'pos' : 'neg'}">${sign((rev - spent) / n)}</b><small>por ciclo</small></div></div>
    <h3>¿De dónde vienen tus ventas?</h3>${channels.filter(c => c[1] > 0).map(([l, v]) => `<div class="kv"><span>${l}</span><span>${fmt(v / n)}/ciclo</span></div>`).join('') || '<p>Aún no has vendido.</p>'}
    <h3>Productos más vendidos</h3>${top.map(([id, g], i) => `<div class="good"><span class="ic">${goodIcon(id)}</span><span class="nm">${i + 1}. ${esc(E.GOOD_BY_ID[id].name)}<small>${fmt(g.units)} unidades · ${fmt(g.revenue)} en total · ${fmt(g.prevCycleUnits)} el último ciclo</small></span></div>`).join('') || '<p>—</p>'}
    <h3>¿En qué gastas? (por ciclo)</h3>${cats.map(([ic, l, v]) => `<div class="exp">${ui(ic)}<span>${l}</span><b>${fmt(v / n)}</b><i style="width:${Math.round(v / max * 100)}%"></i></div>`).join('')}
    <h3>Deudas</h3>${s.arrears > 0 ? `<div class="card debtcard">${ui('fin_deuda')}<span>Tienes <b>${fmt(s.arrears)}</b> en deudas pendientes (gastos que no pudiste pagar). Suman un 5 % de recargo cada ciclo y, si siguen, los acreedores embargan mercancía.</span><button class="btn gold" data-act="payarrears" ${s.cash > 0 ? '' : 'disabled'}>Pagar deudas (${fmt(Math.min(s.cash, s.arrears))})</button></div>` : '<p>No tienes deudas pendientes. ✓</p>'}
    <p>Gastos fijos del próximo cierre: <b>${fmt(E.fixedCostTotal(s))}</b>${s.loans.length ? ` + cuotas de préstamos ${fmt(s.loans.reduce((a, l) => a + l.installment, 0))}` : ''}.</p>
    <h3>Patrimonio</h3><div class="kv"><span>Dinero</span><span>${fmt(bs.cash)}</span><span>Mercancía</span><span>${fmt(bs.inventory + bs.cargo)}</span><span>Propiedades y barcos</span><span>${fmt(bs.venues + bs.warehouses + bs.ships + bs.shipyard)}</span><span>Deudas y préstamos</span><span>${bs.liabilities ? '−' : ''}${fmt(bs.liabilities)}</span><span><b>Patrimonio neto</b></span><span><b>${fmt(bs.netWorth)}</b></span></div>
    ${last ? `<h3>Último ciclo, línea a línea</h3>${Object.entries(last.lines).filter(([k2]) => /^(revenue|cogs|variable|fixed|interest|loss)\./.test(k2)).map(([k2, v]) => `<div class="kv"><span>${esc(E.LEDGER_LABELS[k2] ?? k2)}</span><span class="${k2.startsWith('revenue') ? 'pos' : ''}">${k2.startsWith('revenue') ? '' : '−'}${fmt(v)}</span></div>`).join('')}` : ''}
    ${E.hasMilestone(s, 22) ? `<h3>Préstamos</h3><p>Interés total ${Math.round(E.loanRate(s) * 100)}% · crédito disponible ${fmt(E.creditAvailable(s))}</p><div class="row">${E.BALANCE.loanTerms.map(t => { const q = E.quoteLoan(s, Math.floor(E.creditAvailable(s) * 0.5), t); return `<button class="btn" data-act="loan" data-a="${q.principal}|${t}" ${q.principal > 0 ? '' : 'disabled'}>${fmt(q.principal)} a ${t} ciclos</button>`; }).join('')}</div>${s.loans.map(l => `<div class="row staff"><span>${fmt(l.remainingPrincipal)} pendientes · cuota ${fmt(l.installment)} · ${l.installmentsLeft} cuotas</span><button class="chip" data-act="repay" data-a="${l.id}">Saldar</button></div>`).join('')}` : ''}`;
}

// ---- hitos (mejora 3)
function sheetHitos(): string {
  const lp = E.levelProgress(s), rank = E.prestigeRank(s), nm = nextMilestone();
  const lvl = `<div class="card"><div class="row">${ui('nivel')}<b>Nivel ${s.level} · ${esc(E.LEVELS[s.level - 1].category)}</b></div>
    ${lp ? `<div class="bar big"><i style="width:${Math.round(lp.xp * 100)}%"></i></div><p>Para el nivel ${lp.next.level}: ${fmt(lp.next.xp)} de experiencia (${Math.round(lp.xp * 100)}%)${lp.netWorthOk ? '' : `, ${fmt(lp.next.netWorth)} de patrimonio`}${lp.rankOk ? '' : `, prestigio «${esc(E.prestigeRankName(lp.next.prestigeRank))}»`}. Nuevas mercancías: ${E.GOODS.filter(g => g.unlockLevel === lp.next.level).map(g => esc(g.name)).join(', ') || '—'}.</p>` : '<p>Nivel máximo.</p>'}
    <p>Prestigio: <b>${esc(E.prestigeRankName(rank))}</b> (${fmt(s.prestige)} puntos).</p></div>`;
  const path = E.MILESTONE_ORDER.map(id => {
    const m = E.MILESTONES.find(x => x.id === id)!, done = E.hasMilestone(s, id), next = nm?.id === id;
    return `<div class="step ${done ? 'done' : next ? 'next' : 'locked'}"><span class="ic">${ui(`hito_${E.MILESTONE_FAMILY[id]}`)}</span><span class="nm"><b>${E.milestoneNo(id)}. ${esc(m.name)}</b>${m.pending ? ' <span class="pill">En diseño</span>' : ''}<small>${done ? '✓ Conseguido' : esc(m.condition)}</small><small class="unl">Desbloquea: ${esc(m.unlocks)}</small></span></div>`;
  }).join('');
  return lvl + `<h3>Camino de hitos</h3><div class="path">${path}</div>`;
}

// ---- templo: camino de hitos y, con el hito 29, el tesoro
function sheetTemple(): string {
  let out = '';
  if (E.hasMilestone(s, 29)) out += `<h3>${ui('hito_finanzas')} Tesoro del templo</h3><p>Depositado: <b>${fmt(s.treasury)}</b> · rinde ${(E.TREASURY_RATE * 100).toFixed(1)}% por ciclo (${fmt(s.treasury * E.TREASURY_RATE)}).</p>
    <div class="row">${[0.25, 0.5, 1].map(f => `<button class="btn" data-act="deposit" data-a="${Math.floor(s.cash * f)}" ${s.cash >= 1 ? '' : 'disabled'}>Depositar ${fmt(s.cash * f)}</button>`).join('')}</div>
    <div class="row"><button class="btn" data-act="withdraw" data-a="${Math.floor(s.treasury)}" ${s.treasury >= 1 ? '' : 'disabled'}>Retirar todo</button></div>`;
  else out += `<p>${ui('hito_finanzas')} Con el hito 29 podrás depositar dinero en el tesoro del templo y cobrar intereses.</p>`;
  return out + sheetHitos();
}
// ---- talleres (hito 23)
function sheetWorkshops(only?: string): string {
  const list = E.WORKSHOPS.filter(w => !only || w.id === only);
  const lock = E.hasMilestone(s, 23) ? null : 'Requiere el hito 23: Participación en otros negocios';
  return `<p>Compra parte de un taller: cobras un <b>dividendo cada ciclo</b> y compras su mercancía un <b>10% más barata</b>.</p>${lock ? `<p class="why">${esc(lock)}</p>` : ''}` + list.map(w => {
    const own = s.workshops.includes(w.id);
    return `<div class="good"><span class="ic">${img(`edificios/${w.art}`, 'w30')}</span><span class="nm">${esc(w.name)}<small>${fmt(w.price)} · dividendo ${fmt(w.dividend)}/ciclo · abarata ${esc(CAT_NAME[w.category] ?? w.category)}</small></span><span class="acts">${own ? `<span class="pill ok">Tuyo</span><button class="chip" data-act="wsell" data-a="${w.id}">Vender · ${fmt(w.price * 0.8)}</button>` : `<button class="btn gold" data-act="wbuy" data-a="${w.id}" ${!lock && s.cash >= w.price ? '' : 'disabled'}>Comprar parte</button>`}</span></div>`;
  }).join('') + (only ? '<div class="row"><button class="btn" data-act="open" data-a="talleres">Ver todos los talleres</button></div>' : '');
}

// ---- marítimo, tierra y mapa
function bestCargo(price: (id: string) => number, cap: number, limit: (id: string) => number) {
  return Object.keys(s.inventory).map(id => ({ id, p: price(id) - s.inventory[id].avgCost })).filter(x => x.p > 0).sort((a, b) => b.p - a.p)
    .reduce<{ goodId: string; qty: number }[]>((acc, x) => { const used = acc.reduce((a, c) => a + c.qty, 0); const q = Math.min(E.stockOf(s, x.id), cap - used, limit(x.id)); if (q > 0) acc.push({ goodId: x.id, qty: q }); return acc; }, []);
}
const shipCargo = (port: string, cap: number) => bestCargo(id => E.portSalePrice(s, id, port) * 0.85, cap, () => Infinity);
const SHIP_PIC: Record<string, string> = { galera_alquiler: 'barcos/barco_galera_se_recogida', mercante: 'barcos/barco_mercante_se_recogida', avanzado: 'barcos/barco_avanzado_se_recogida' };
function sheetDock(): string {
  if (!E.hasMilestone(s, 15)) return `<p>${ui('hito_mar')} El comercio marítimo llega con el <b>hito 15</b>: ${esc(E.MILESTONES.find(m => m.id === 15)!.condition)}. Antes, abre rutas por tierra desde las Caballerizas.</p>${shipyardInfo()}`;
  const ships = s.ships.map(sh => {
    const v = s.voyages.find(x => x.id === sh.voyageId);
    const state = v ? `${v.phase === 'ida' ? 'Navegando hacia' : v.turnedBack ? 'Vuelve (bloqueo) de' : 'Volviendo de'} ${esc(E.PORT_BY_ID[v.to].name)} · ${v.cyclesLeft} ciclos`
      : sh.underConstruction ? `En la grada del astillero · listo en ${sh.underConstruction} ciclos` : 'En puerto. Vende toda la carga en destino y vuelve.';
    const routes = !v && !sh.underConstruction ? s.knownRoutes.map(p => {
      if (E.isPortBlocked(s, p)) { const ev = s.events.find(e => e.effects.blockedPort === p)!; return `<button class="btn" disabled>${esc(E.PORT_BY_ID[p].name)} · bloqueado ${ev.endCycle - s.time.cycle} ciclos</button>`; }
      const cargo = shipCargo(p, E.shipCapacity(sh)); const est = E.estimateVoyageProfit(s, sh.id, p, cargo, 'ninguna', null);
      return `<button class="btn" data-act="sail" data-a="${sh.id}|${p}" ${cargo.length ? '' : 'disabled'}>Enviar a ${esc(E.PORT_BY_ID[p].name)} · ${est.cycles} ciclos · ${sign(est.profit)}</button>`;
    }).join('') : '';
    const extra = !v && !sh.underConstruction ? (!sh.owned ? `<button class="chip" data-act="ask_retship" data-a="${sh.id}">Devolver la galera</button>` : '') : '';
    return `<div class="card"><div class="row"><span class="ic shipic">${img(SHIP_PIC[sh.cls])}</span><b>${esc(sh.name)}</b><span class="pill">${esc(E.SHIPS[sh.cls].name)} · ${E.shipCapacity(sh)} u.</span>${sh.owned ? `<span class="pill">estado ${Math.round(sh.condition * 100)}%</span>` : ''}${extra}</div><p>${state}</p>${routes ? `<div class="row">${routes}</div>` : ''}</div>`;
  }).join('');
  return `<div class="row"><button class="btn" data-act="rentship">Alquilar galera · ${E.SHIPS.galera_alquiler.rentPerCycle} por ciclo navegando</button></div>
    ${ships || '<p>No tienes barcos. Alquila una galera para empezar.</p>'}
    <h3>Capitanes ${infoBtn('capitan')}</h3>${s.captains.map(c => `<div class="row staff"><span>${esc(c.name)} · pericia ${Math.round(c.skill * 100)}%</span><span class="pill">${c.salary}/ciclo</span><button class="chip" data-act="firecap" data-a="${c.id}">Despedir</button></div>`).join('') || '<p>Sin capitanes fijos: se contrata uno por viaje.</p>'}
    ${E.hasMilestone(s, 16) ? '<div class="row"><button class="btn gold" data-act="captain">Contratar capitán</button></div>' : ''}
    ${shipyardInfo()}`;
}
/** Astillero: contratarlo (hito 20) o comprarlo (hito 24). Sin astillero no se pueden tener barcos propios. */
function shipyardInfo() {
  const yard = s.hasShipyard || s.shipyardRented, building = s.ships.find(x => x.underConstruction > 0);
  const disc = s.hasShipyard ? E.BALANCE.shipyardBuildDiscount : 1;
  let out = `<h3>${ui('hito_astillero')} Astillero</h3>`;
  if (s.hasShipyard) out += '<p>Es tuyo: construye barcos un 30% más baratos, los repara a mitad de precio y los mejora.</p>';
  else if (s.shipyardRented) out += `<p>Tienes contrato con el astillero de la ciudad (${fmt(E.BALANCE.shipyardRent)}/ciclo). <button class="chip" data-act="yard_release" ${building ? 'disabled' : ''}>Terminar el contrato</button></p>`;
  else out += `<p>Los barcos propios se construyen aquí. ${E.hasMilestone(s, 20) ? '' : 'Con el <b>hito 20</b> podrás contratarlo para encargar barcos.'}</p>${E.hasMilestone(s, 20) ? `<div class="row"><button class="btn gold" data-act="yard_rent">Contratar el astillero · ${fmt(E.BALANCE.shipyardRent)}/ciclo</button></div>` : ''}`;
  if (E.hasMilestone(s, 20)) {
    out += `<div class="row">${(['mercante', 'avanzado'] as const).filter(c => c === 'mercante' || E.hasMilestone(s, 21)).map(c => { const price = Math.round(E.SHIPS[c].price * disc); return `<button class="btn" data-act="buyship" data-a="${c}" ${yard && !building && s.cash >= price ? '' : 'disabled'}>Encargar ${esc(E.SHIPS[c].name.toLowerCase())} · ${fmt(price)} · ${E.SHIPS[c].buildCycles} ciclos</button>`; }).join('')}</div>`;
    if (!yard) out += '<small class="why">Para encargar un barco necesitas el astillero.</small>';
    if (building) out += `<p>En la grada: <b>${esc(building.name)}</b> · faltan ${building.underConstruction} ciclos.</p>`;
  }
  if (!s.hasShipyard) out += `<p>${E.hasMilestone(s, 24) ? '' : 'Comprarlo llega con el hito 24 (1.500.000 de patrimonio).'}</p>${E.hasMilestone(s, 24) ? `<button class="btn gold" data-act="yard">Comprar el astillero · ${fmt(E.BALANCE.shipyardPrice)}</button>` : ''}`;
  else out += s.ships.filter(x => x.owned && !x.voyageId && x.condition < 1).map(x => `<div class="row staff"><span>${esc(x.name)} · estado ${Math.round(x.condition * 100)}%</span><button class="chip" data-act="repair" data-a="${x.id}">Reparar · ${fmt(E.repairCost(s, x.id))}</button></div>`).join('');
  return out;
}

function sheetStables(): string {
  if (!E.hasMilestone(s, 30)) return `<p>${ui('hito_tierra')} Las rutas por tierra llegan con el <b>hito 30</b>: ${esc(E.MILESTONES.find(m => m.id === 30)!.condition)}.</p>`;
  if (!s.stables) return `<p>Alquila las caballerizas para mandar carretas con tu mercancía a los pueblos. Allí se vende <b>toda la carga</b>.</p><div class="row"><button class="btn gold" data-act="stables_rent">Alquilar · ${E.STABLES.rent}/ciclo</button><button class="btn" data-act="stables_buy">Comprar · ${fmt(E.STABLES.price)}</button></div>`;
  const free = E.cartSlots(s) - s.landTrips.length;
  const carts = (Object.keys(E.CARTS) as CartClass[]).filter(c => E.CARTS[c].minLevel <= s.stables!.level);
  return `<div class="row"><span class="pill ${s.stables.owned ? 'ok' : 'gold'}">${s.stables.owned ? 'Propias' : 'Alquiladas'}</span><span class="pill">Carretas libres ${free}/${E.cartSlots(s)}</span>${!s.stables.owned ? `<button class="chip" data-act="stables_buy">Comprar · ${fmt(E.STABLES.price)}</button>` : s.stables.level === 1 ? `<button class="chip" data-act="stables_up">Ampliar (caravanas, 4 carretas) · ${fmt(E.STABLES.upgradePrice)}</button>` : ''}</div>
    ${s.landTrips.map(t => `<div class="row staff"><span>${esc(E.CARTS[t.cart].name)} ${t.phase === 'ida' ? '→' : '←'} ${esc(E.townById(s, t.town)!.name)}</span><span class="pill">${t.cyclesLeft} ciclos</span></div>`).join('')}
    <h3>Enviar una carreta</h3>
    <div class="tabs">${carts.map(c => `<button class="${cartSel === c ? 'on' : ''}" data-act="cart" data-a="${c}">${esc(E.CARTS[c].name)} · ${E.CARTS[c].capacity} u.</button>`).join('')}</div>
    ${E.towns(s).map(t => { const cargo = bestCargo(id => E.townUnitPrice(s, t, id, 20), E.CARTS[cartSel].capacity, id => Math.ceil(E.GOOD_BY_ID[id].retailDemand * t.size)); const est = E.estimateTrip(s, cartSel, t.id, cargo); return `<div class="good"><span class="ic">${ui('hito_tierra')}</span><span class="nm">${esc(t.name)} · ${t.km} km<small>${esc(t.specialties)} · ${est.cycles} ciclos · llevaría ${cargo.reduce((a, c) => a + c.qty, 0)} u. · ${sign(est.profit)}</small></span><span class="acts"><button class="btn gold" data-act="sendcart" data-a="${t.id}" ${free > 0 && cargo.length ? '' : 'disabled'}>Enviar</button></span></div>`; }).join('')}
    <p>La carga se elige sola: lo más rentable de tu inventario para cada pueblo, sin saturarlo.</p>`;
}
let cartSel: CartClass = 'burro';

// ---- mapa: imagen del Mediterráneo (o de la región de Tiro) que se acerca y se aleja
const MED_PLACE: Record<string, string> = { tiro: 'tiro', sidon: 'sidon', biblos: 'biblos', kition: 'chipre', menfis: 'delta_nilo', rodas: 'rodas', cnosos: 'creta', cartago: 'cartago', tharros: 'cerdena', gadir: 'estrecho_gadir' };
let mapsMeta: any = null;
fetch('./assets/mapas/mapas_lugares.json').then(r => r.json()).then(j => { mapsMeta = j; }).catch(() => { /* sin mapa */ });
let mapView: 'mar' | 'tierra' = 'mar';
const mapZoom = { z: 1, x: 0.5, y: 0.5 };
function mapPins(): string {
  if (!mapsMeta) return '';
  if (mapView === 'tierra') {
    const L = mapsMeta.mapa_region_tiro.lugares, out: string[] = [];
    for (const t of E.towns(s)) { const p = L[t.id] ?? (t.id === 'damasco' ? L.salida_damasco : null); if (!p) continue; const busy = s.landTrips.some(x => x.town === t.id); out.push(pin(p.x, p.y, t.name, busy ? 'go' : '', `${t.km} km`)); }
    out.push(pin(L.tiro.x, L.tiro.y, cityName(), 'home', ''));
    return out.join('');
  }
  const L = mapsMeta.mapa_mediterraneo.lugares, out: string[] = [];
  for (const p of E.PORTS) {
    const q = L[MED_PLACE[p.id]]; if (!q) continue;
    const home = p.id === s.cityId, known = s.knownRoutes.includes(p.id), blocked = E.isPortBlocked(s, p.id), sailing = s.voyages.some(v => v.to === p.id);
    out.push(pin(q.x, q.y, p.name, home ? 'home' : blocked ? 'blocked' : sailing ? 'go' : known ? 'known' : 'unknown', home ? '' : blocked ? 'Bloqueado' : known ? `${fmt(E.seaDistanceKm(s.cityId, p.id))} km` : 'Sin ruta'));
  }
  return out.join('');
}
const pin = (x: number, y: number, name: string, cls: string, sub: string) => `<span class="pin ${cls}" style="left:${x / 10.8}%;top:${y / 19.2}%"><i></i><b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>`;
function sheetMap(): string {
  const region = s.cityId === 'tiro';
  const viewer = `<div class="tabs"><button class="${mapView === 'mar' ? 'on' : ''}" data-act="mapview" data-a="mar">Mediterráneo</button>${region ? `<button class="${mapView === 'tierra' ? 'on' : ''}" data-act="mapview" data-a="tierra">Región</button>` : ''}<span class="grow"></span><button class="chip" data-act="mapzoom" data-a="-1" aria-label="Alejar">−</button><button class="chip" data-act="mapzoom" data-a="1" aria-label="Acercar">+</button></div>
    <div class="mapbox" data-map="1"><div class="mapin" style="--z:${mapZoom.z};transform:translate(${(0.5 - mapZoom.x) * 100 * mapZoom.z}%, ${(0.5 - mapZoom.y) * 100 * mapZoom.z}%) scale(${mapZoom.z})"><img class="px" src="./assets/mapas/${mapView === 'tierra' && region ? 'mapa_region_tiro' : 'mapa_mediterraneo'}.png" alt="Mapa">${mapPins()}</div></div>
    <p class="hint">Pellizca o usa + y − para acercar; arrastra para moverte.${mapView === 'mar' ? ' El este queda arriba.' : ''}</p>`;
  return viewer + `<h3>${ui('hito_tierra')} Rutas por tierra</h3>${E.hasMilestone(s, 30) ? E.towns(s).map(t => `<div class="row staff"><span>${esc(t.name)} · ${t.km} km</span><span class="pill">${esc(t.specialties)}</span></div>`).join('') + '<div class="row"><button class="btn" data-act="goto" data-a="caballerizas">Ir a las caballerizas</button></div>' : '<p>Se abren con el hito 30.</p>'}
    <h3>${ui('hito_mar')} Rutas por mar</h3>${s.knownRoutes.map(p => `<div class="row staff"><span>${esc(E.PORT_BY_ID[p].name)} · ${fmt(E.seaDistanceKm(s.cityId, p))} km</span><span class="pill ${E.isPortBlocked(s, p) ? 'bad' : ''}">${E.isPortBlocked(s, p) ? 'Bloqueado' : esc(E.PORT_BY_ID[p].specialties)}</span></div>`).join('')}
    <h3>Expediciones</h3>${E.hasMilestone(s, 17) ? E.PORTS.filter(p => p.id !== s.cityId && !s.knownRoutes.includes(p.id)).map(p => { const ex = s.expeditions.find(e => e.target === p.id); const req = E.expeditionRequired(s, p.id); return `<div class="row staff"><span>${esc(p.name)}</span>${ex ? `<span class="pill gold">En curso · ${ex.cyclesLeft} ciclos</span>` : `<button class="btn" data-act="exped" data-a="${p.id}">Financiar · ${fmt(req)} (${Math.round(E.expeditionChance(s, p.id, req) * 100)}%)</button>`}</div>`; }).join('') : '<p>Se desbloquean con el hito 17.</p>'}`;
}

function sheetNotes(): string {
  const list = [...s.notifications].reverse();
  return `<p>Historial de avisos de la partida. Los errores puntuales («falta dinero», «sin espacio») no se guardan. <button class="infobtn" data-act="open" data-a="ayuda">${ui('info')} Qué significa cada mensaje</button></p>
    <div class="notes">${list.map(n => `<div class="note ${n.kind}">${ui(noteIcon(n))}<span><small>Ciclo ${n.cycle + 1}</small>${esc(n.text)}</span></div>`).join('') || '<p>Sin avisos.</p>'}</div>`;
}
function sheetHelp(): string {
  return MESSAGES.map(m => `<div class="card"><b>${esc(m.message)}</b><p><b>Cuándo:</b> ${esc(m.when)}</p><p><b>Qué significa:</b> ${esc(m.meaning)}</p><p><b>Qué hacer:</b> ${esc(m.todo)}</p></div>`).join('');
}
// ---- menú de pausa: Continuar, Ajustes y Volver al menú principal
function openPause() {
  if (!running) return;
  if (s.time.speed !== 0) { lastRunSpeed = s.time.speed as 1 | 6; E.setSpeed(s, 0); }
  closeModal();
  audio.sfx('abrir');
  showModal(`<div class="pause"><h2>Pausa</h2><p>${img(`escudos/escudo_${s.cityId}`, 'w30')} ${esc(cityName())} · ${DIFF[E.PORT_BY_ID[s.cityId].difficulty!]} · ciclo ${s.time.cycle + 1}. La partida se guarda sola.</p>
    <button class="btn gold big" data-act="resume">${ui('x1')} Continuar</button>
    <button class="btn big" data-act="pause_settings">${ui('ui_avisos')} Ajustes</button>
    <button class="btn big" data-act="tostart">${ui('ciudad')} Volver al menú principal</button>
    <div class="menu-mini"><button class="link" data-act="pause_open" data-a="finanzas">Finanzas</button><button class="link" data-act="pause_open" data-a="hitos">Camino de hitos</button><button class="link" data-act="pause_open" data-a="ayuda">Qué significa cada mensaje</button><button class="link" data-act="tutorial">Repetir los primeros pasos</button></div></div>`);
}
function sheetSettings(): string {
  const v = audio.vol;
  const sl = (k2: keyof typeof v, l: string) => `<label class="slider">${l}<input id="vol_${k2}" type="range" min="0" max="1" step="0.05" value="${v[k2]}" data-vol="${k2}"><span>${Math.round(v[k2] * 100)}%</span></label>`;
  return `${sl('music', 'Música')}${sl('ambient', 'Ambiente')}${sl('sfx', 'Efectos')}<p>Pon un volumen a 0% para apagarlo.</p>${running ? '<div class="row"><button class="btn gold" data-act="resume">Continuar</button></div>' : ''}`;
}

// ---------------------------------------------------------------------------- ventanas: info, confirmación, anuncios
function showModal(html: string, onClose?: () => void) {
  modal.innerHTML = `<div class="panel box">${H(html)}</div>`;
  modal.hidden = false;
  modalClose = onClose ?? null;
}
let modalClose: (() => void) | null = null;
function closeModal() { modal.hidden = true; const f = modalClose; modalClose = null; f?.(); }
function confirmBox(text: string, yes: string, act2: string, a: string) {
  showModal(`<p>${text}</p><div class="row end"><button class="btn" data-act="modal_close">Cancelar</button><button class="btn gold" data-act="${act2}" data-a="${a}">${yes}</button></div>`);
}

// Anuncio de función nueva: pausa el juego y explica (mejora 2.2)
let introQueue: number[] = [], speedBeforeIntro: 0 | 1 | 6 = 1;
function checkIntros() {
  for (const id of E.MILESTONE_ORDER) if (E.hasMilestone(s, id) && INTROS[id] && !s.seenIntros.includes(`h${id}`) && !introQueue.includes(id)) introQueue.push(id);
  if (introQueue.length && modal.hidden && tutor.hidden) {
    const id = introQueue.shift()!, it = INTROS[id];
    s.seenIntros.push(`h${id}`);
    speedBeforeIntro = s.time.speed || speedBeforeIntro; E.setSpeed(s, 0);
    audio.sfx('anuncio');
    showModal(`<div class="intro">${ui(it.icon, 'big')}<h2>${esc(it.title)}</h2><p>${it.body}</p><p class="where"><b>Dónde:</b> ${it.where}</p></div>
      <div class="row end">${it.go ? `<button class="btn" data-act="intro_go" data-a="${it.go}">Ir allí</button>` : ''}<button class="btn gold" data-act="modal_close">Entendido</button></div>`, () => E.setSpeed(s, speedBeforeIntro));
  }
}

// ---------------------------------------------------------------------------- primeros pasos
let tutStep = -1;
function startTutorial() { tutStep = 0; openSheet(null); renderTutor(); }
function tutDone(id: string): boolean {
  switch (id) {
    case 'abrir_mercado': return sheet === 'mercado';
    case 'comprar': return E.inventoryUnits(s) > 0;
    case 'pestana_vender': return sheet === 'mercado' && sheetTab === 'vender';
    case 'vender': return s.stats.lifetimeRevenue > 0;
    default: return false;
  }
}
function renderTutor() {
  if (tutStep < 0 || tutStep >= TUTORIAL.length) { tutor.hidden = true; tutor.dataset.key = ''; document.querySelectorAll('.glow').forEach(e => e.classList.remove('glow')); return; }
  const st = TUTORIAL[tutStep];
  if (!st.button && tutDone(st.id)) { tutStep++; return renderTutor(); }
  tutor.hidden = false;
  const key = `${tutStep}|${s.cityId}`;
  if (tutor.dataset.key !== key) { tutor.dataset.key = key; tutor.innerHTML = `<div class="panel bubble"><span class="who">${img('escudos/escudo_' + s.cityId, 'w30')}</span><div><small>Primeros pasos · ${tutStep + 1}/${TUTORIAL.length}</small><p>${H(st.text)}</p>${st.button ? `<button class="btn gold" data-act="tut_next">${st.button}</button>` : ''}<button class="link" data-act="tut_skip">Saltar</button></div></div>` }
  document.querySelectorAll('.glow').forEach(e => e.classList.remove('glow'));
  if (st.target) document.querySelector(st.target)?.classList.add('glow');
  tutor.classList.toggle('low', sheet !== null);
}

// ---------------------------------------------------------------------------- acciones
const q = (el: HTMLElement, id: string, kind: 'buy' | 'sell' | 'dist') => {
  const v = el.dataset.q ?? '1';
  if (v !== 'max') return Number(v);
  if (kind === 'buy') return Math.max(1, Math.min(Math.floor(s.cash / E.buyPrice(s, id)), E.freeStorage(s) || 1e9, E.availableSupply(s, id)));
  return Math.max(1, E.stockOf(s, id) - (kind === 'sell' ? E.queuedFor(s, id) : 0));
};
const handlers: Record<string, (a: string, el: HTMLElement) => void> = {
  close: () => openSheet(null),
  open: a => openSheet(a),
  nav: a => { if (a === 'ciudad') { openSheet(null); focus(19, 22); } else { openSheet(a); if (a === 'muelle') focus(31, 22, 0.24); } },
  tab: a => { sheetTab = a; nego = null; renderSheet(true); },
  buy: (a, el) => act(A.buy(s, a, q(el, a, 'buy')), undefined, 'compra'),
  sell: (a, el) => act(A.queueSell(s, a, q(el, a, 'sell')), undefined, 'compra'),
  sellstop: a => act(A.cancelSell(s, a)),
  dist: (a, el) => act(A.distribute(s, a, q(el, a, 'dist')), undefined, 'compra'),
  nego: a => { const [id, p] = a.split('|'); nego = { offerId: id, pct: Number(p), phase: 'confirm', t0: performance.now() }; audio.sfx('compra'); renderSheet(true); },
  nego_cancel: () => { nego = null; renderSheet(true); },
  nego_go: a => {
    if (!nego) return; const o = s.supplierOffers.find(x => x.id === a)!;
    const price = Math.round(o.refPrice * (1 - nego.pct / 100)); nego.phase = 'thinking'; audio.sfx('compra'); renderSheet(true);
    setTimeout(() => { const r = A.negotiate(s, a, price); if (nego && r.ok) { nego.phase = 'answer'; nego.outcome = r.data!.outcome; nego.price = r.data!.price; } else if (!r.ok) { toast(r.error!, 'alerta'); nego = null; } renderSheet(true); }, 1600);
  },
  counter: a => { act(A.acceptCounter(s, a), 'Precio pactado', 'compra'); nego = null; },
  supbuy: a => { const o = s.supplierOffers.find(x => x.id === a); if (o) { act(A.purchaseFromSupplier(s, a, o.minQty), 'Lote comprado', 'compra'); nego = null; } },
  acceptk: a => act(A.acceptContract(s, a), 'Contrato aceptado', 'compra'),
  deliver: a => act(A.deliverContract(s, a), undefined, 'compra'),
  excl: a => { const [id, n] = a.split('|'); act(A.setExclusive(s, id, Number(n)), undefined, 'compra'); },
  hire: a => { const [role, venue] = a.split('|'); act(A.hireWorker(s, role as any, venue || null)); },
  fire: a => act(A.fireWorker(s, a)),
  move: a => { const w = s.workers.find(x => x.role === 'vendedor' && !x.venueId); if (w) act(A.assignWorker(s, w.id, a)); },
  rentv: a => act(A.rentVenue(s, a)), buyv: a => act(A.buyVenue(s, a)),
  ask_sellv: a => { const v = s.venues.find(x => x.defId === a)!; confirmBox(`¿Vender <b>${esc(E.VENUES.find(d => d.id === a)!.name)}</b> por <b>${fmt(v.bookValue * 0.8)}</b> (80% de lo que costó)? Sus vendedores pasarán a la calle si hay plaza.`, 'Vender', 'sellv', a); },
  sellv: a => { closeModal(); act(A.sellVenue(s, a)); },
  ask_relv: a => confirmBox('¿Dejar el alquiler de este lugar? Dejarás de pagarlo, y sus vendedores pasarán a la calle si hay plaza.', 'Dejar', 'relv', a),
  relv: a => { closeModal(); act(A.releaseVenue(s, a)); },
  rentw: a => act(A.rentWarehouse(s, a)), buyw: a => act(A.buyWarehouse(s, a)),
  ask_relw: a => { const w = s.warehouses.find(x => x.uid === a)!; confirmBox(w.owned ? `¿Vender este almacén por ${fmt(w.bookValue * 0.8)}?` : '¿Dejar el alquiler de este almacén? Dejarás de pagarlo desde el próximo cierre.', w.owned ? 'Vender' : 'Dejar el alquiler', 'relw', a); },
  restock: a => { const [id, v] = a.split('|'); act(A.setGoodSettings(s, id, { restockTarget: Number(v) })); },
  relw: a => { closeModal(); act(A.releaseWarehouse(s, a)); },
  rentship: () => act(A.rentShip(s, 'por_viaje')), buyship: a => act(A.buyShip(s, a as any)),
  ask_retship: a => confirmBox('¿Devolver esta galera? Dejas de tenerla y no pagas más su alquiler.', 'Devolver', 'retship', a),
  retship: a => { closeModal(); act(A.returnShip(s, a), 'Galera devuelta'); },
  yard_rent: () => act(A.rentShipyard(s)), yard_release: () => act(A.releaseShipyard(s)), repair: a => act(A.repairShip(s, a)), captain: () => act(A.hireCaptain(s)), firecap: a => act(A.fireCaptain(s, a)),
  sail: a => { const [id, p] = a.split('|'); const sh = s.ships.find(x => x.id === id)!; const cap = s.captains.find(c => !s.voyages.some(v => v.captainId === c.id)); const r = A.launchVoyage(s, { shipId: id, to: p, cargo: shipCargo(p, E.shipCapacity(sh)), captainId: cap?.id ?? null }); act(r, '¡Leven anclas!'); if (r.ok) { openSheet(null); const i = s.ships.indexOf(sh); focus(SPOTS.dockX + 5, SPOTS.docks[Math.min(i, SPOTS.docks.length - 1)]); } },
  stables_rent: () => act(A.rentStables(s)), stables_buy: () => act(A.buyStables(s)), stables_up: () => act(A.upgradeStables(s)),
  cart: a => { cartSel = a as CartClass; renderSheet(true); },
  sendcart: a => { const t = E.townById(s, a)!; const cargo = bestCargo(id => E.townUnitPrice(s, t, id, 20), E.CARTS[cartSel].capacity, id => Math.ceil(E.GOOD_BY_ID[id].retailDemand * t.size)); act(A.sendCart(s, cartSel, a, cargo), `Carreta en camino a ${t.name}`); },
  mapview: a => { mapView = a as any; mapZoom.z = 1; mapZoom.x = mapZoom.y = 0.5; renderSheet(true); },
  mapzoom: a => { mapZoom.z = Math.max(1, Math.min(4, mapZoom.z * (Number(a) > 0 ? 1.5 : 1 / 1.5))); clampMap(); renderSheet(true); },
  exped: a => act(A.fundExpedition(s, a, E.expeditionRequired(s, a)), 'Expedición en marcha'),
  yard: () => act(A.buyShipyard(s)),
  wbuy: a => act(A.buyWorkshop(s, a)), wsell: a => confirmBox('¿Vender tu parte del taller al 80% de lo que pagaste?', 'Vender', 'wsell_ok', a),
  wsell_ok: a => { closeModal(); act(A.sellWorkshop(s, a)); },
  mono: a => { const [id, on] = a.split('|'); act(A.setMonopoly(s, id, on === '1')); },
  deposit: a => act(A.deposit(s, Number(a)), 'Depositado en el tesoro'), withdraw: a => act(A.withdraw(s, Number(a)), 'Retirado del tesoro'),
  loan: a => { const [p, t] = a.split('|'); act(A.takeLoan(s, Number(p), Number(t))); },
  repay: a => act(A.repayLoan(s, a)),
  payarrears: () => act(A.payArrears(s), 'Deudas pagadas'),
  info: a => { const i = INFO[a]; showModal(`<div class="intro">${ui('info', 'big')}<h2>${esc(i.title)}</h2><p>${i.text}</p></div><div class="row end"><button class="btn gold" data-act="modal_close">Entendido</button></div>`); },
  modal_close: () => closeModal(),
  intro_go: a => { closeModal(); goTo(a); },
  goto: a => goTo(a),
  tut_next: () => { tutStep++; renderTutor(); },
  tut_skip: () => { tutStep = -1; s.seenIntros.push('tutorial'); renderTutor(); },
  tutorial: () => { closeModal(); E.setSpeed(s, lastRunSpeed); startTutorial(); },
  tostart: () => { closeModal(); saveNow(); showStart(); },
  pause: () => openPause(),
  resume: () => { closeModal(); openSheet(null); E.setSpeed(s, lastRunSpeed); renderHud(); },
  pause_settings: () => { closeModal(); openSheet('ajustes'); },
  pause_open: a => { closeModal(); openSheet(a); },
  // pantalla de inicio
  pickcity: a => { audio.sfx('seleccion'); pickedCity = a; renderStart(); },
  play: () => { audio.sfx('seleccion'); const g = E.createGame(pickedCity); startGame(g, true); },
  cont: a => { audio.sfx('seleccion'); const g = saves.load(a); if (g) startGame(g, false); },
  ask_del: a => confirmBox('¿Borrar esta partida guardada? No se puede deshacer.', 'Borrar', 'del', a),
  del: a => { closeModal(); saves.remove(a); renderStart(); },
  install: async () => { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch { /* */ } installEvt = null; renderStart(); },
};
document.addEventListener('click', ev => {
  audio.unlock();
  const el = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
  if (!el || (el as HTMLButtonElement).disabled) return;
  handlers[el.dataset.act!]?.(el.dataset.a ?? '', el);
  if (tutStep >= 0) setTimeout(renderTutor, 30);
});
document.addEventListener('input', ev => {
  const el = ev.target as HTMLInputElement;
  if (el.dataset.vol) { (audio.vol as any)[el.dataset.vol] = Number(el.value); audio.save(); const sp = el.nextElementSibling; if (sp) sp.textContent = `${Math.round(Number(el.value) * 100)}%`; }
});
sheetEl.addEventListener('pointerdown', () => { sheetBusy = true; });
// Mapa: arrastrar para moverse y pellizcar para acercar
function clampMap() { const m = 0.5 / mapZoom.z; mapZoom.x = Math.max(m, Math.min(1 - m, mapZoom.x)); mapZoom.y = Math.max(m, Math.min(1 - m, mapZoom.y)); }
const mpts = new Map<number, { x: number; y: number }>();
let mpinch = 0;
function applyMap() {
  const el = sheetEl.querySelector<HTMLElement>('.mapin'); if (!el) return;
  el.style.setProperty('--z', String(mapZoom.z));
  el.style.transform = `translate(${(0.5 - mapZoom.x) * 100 * mapZoom.z}%, ${(0.5 - mapZoom.y) * 100 * mapZoom.z}%) scale(${mapZoom.z})`;
}
sheetEl.addEventListener('pointerdown', e => { const box = (e.target as HTMLElement).closest('[data-map]'); if (!box) return; (box as HTMLElement).setPointerCapture(e.pointerId); mpts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (mpts.size === 2) { const [a, b] = [...mpts.values()]; mpinch = Math.hypot(a.x - b.x, a.y - b.y); } });
sheetEl.addEventListener('pointermove', e => {
  const p0 = mpts.get(e.pointerId); if (!p0) return;
  const box = sheetEl.querySelector<HTMLElement>('[data-map]'); if (!box) return;
  if (mpts.size >= 2) {
    mpts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [a, b] = [...mpts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (mpinch > 0) { mapZoom.z = Math.max(1, Math.min(4, mapZoom.z * d / mpinch)); mpinch = d; clampMap(); applyMap(); }
    return;
  }
  const r = box.getBoundingClientRect();
  mapZoom.x -= (e.clientX - p0.x) / r.width / mapZoom.z; mapZoom.y -= (e.clientY - p0.y) / r.height / mapZoom.z;
  mpts.set(e.pointerId, { x: e.clientX, y: e.clientY }); clampMap(); applyMap();
});
const mapUp = (e: PointerEvent) => { mpts.delete(e.pointerId); if (mpts.size < 2) mpinch = 0; };
sheetEl.addEventListener('pointerup', mapUp); sheetEl.addEventListener('pointercancel', mapUp);
sheetEl.addEventListener('wheel', e => { if (!(e.target as HTMLElement).closest('[data-map]')) return; e.preventDefault(); mapZoom.z = Math.max(1, Math.min(4, mapZoom.z * (e.deltaY < 0 ? 1.2 : 1 / 1.2))); clampMap(); applyMap(); }, { passive: false });
addEventListener('pointerup', () => setTimeout(() => { sheetBusy = false; }, 50));
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

// ---------------------------------------------------------------------------- gestos: botones de tiempo en círculo (mejora 10)
function showRing() {
  const v = gesture.view;
  ring.hidden = !v.panel;
  if (!v.panel) return;
  ring.style.left = `${v.panel.x}px`; ring.style.top = `${v.panel.y}px`;
  const b = (cls: string, icon: string, on: boolean, label: string) => `<div class="rb ${cls} ${on ? 'on' : ''}">${img(on ? 'ui/ui_boton_circulo_activo' : 'ui/ui_boton_circulo', 'disc')}${ui(icon, 'sym')}<small>${label}</small></div>`;
  ring.innerHTML = b('up', 'x1', v.choice === 'normal', '×1') + b('right', 'x6', v.choice === 'rapido', '×6') + b('down', 'pausa', v.choice === 'pausa', 'Pausa') + '<span class="dot"></span>';
}
// Dos dedos: pellizcar para acercar o alejar. Rueda del ratón: lo mismo.
const pts = new Map<number, { x: number; y: number }>();
let pinch: { d: number } | null = null;
const pdist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
const pmid = () => { const [a, b] = [...pts.values()]; return [(a.x + b.x) / 2, (a.y + b.y) / 2] as [number, number]; };
cv.addEventListener('pointerdown', e => {
  audio.unlock(); cv.setPointerCapture(e.pointerId);
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pts.size === 2) { gesture.cancel(); showRing(); pinch = { d: pdist() }; return; }
  if (pts.size > 2) return;
  gesture.down(e.pointerId, e.clientX, e.clientY, performance.now());
});
cv.addEventListener('pointermove', e => {
  if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pts.size >= 2) {
    const d = pdist(), [mx, my] = pmid();
    if (d / pinch.d > 1.3) { setZoom(k + 1, mx, my); pinch.d = d; }
    else if (d / pinch.d < 0.77) { setZoom(k - 1, mx, my); pinch.d = d; }
    return;
  }
  const out = gesture.move(e.pointerId, e.clientX, e.clientY, performance.now());
  if (out.kind === 'pan') { cam.x -= out.dx / zoom; cam.y -= out.dy / zoom; clampCam(); }
  showRing();
});
cv.addEventListener('pointerup', e => {
  pts.delete(e.pointerId);
  if (pinch) { if (pts.size < 2) pinch = null; gesture.cancel(); showRing(); return; }
  const out = gesture.up(e.pointerId, e.clientX, e.clientY, performance.now());
  showRing();
  if (out.kind === 'speed') { E.setSpeed(s, out.speed); renderHud(); if (out.speed === 0) openPause(); }
  if (out.kind === 'tap') { const sp = hitTest(out.x, out.y); if (sp?.id) openSheet(tapTarget(sp.id)); else if (sheet) openSheet(null); }
});
cv.addEventListener('wheel', e => { e.preventDefault(); setZoom(k + (e.deltaY < 0 ? 1 : -1), e.clientX, e.clientY); }, { passive: false });
const tapTarget = (id: string) => id === 'lot:almacenes' ? 'almacenes' : id === 'puerta' ? 'caballerizas' : id === 'muelle' ? 'muelle' : id;
cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch = null; gesture.cancel(); showRing(); });
addEventListener('contextmenu', e => e.preventDefault());

// ---------------------------------------------------------------------------- app instalable
// Android/Chrome: el navegador avisa con «beforeinstallprompt» y el botón abre su ventana de instalación.
// iPhone/iPad (Safari): no hay ventana; se explica «Compartir → Añadir a pantalla de inicio».
let installEvt: any = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || (navigator as any).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (!running) renderStart(); });
addEventListener('appinstalled', () => { installEvt = null; if (!running) renderStart(); });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => { /* sin SW */ }));
function installCard(): string {
  if (standalone()) return '';
  if (installEvt) return `<section class="panel install">${img('icons/icon-192', 'appicon')}<div><h2>Instala FENICIA</h2><p>Juega a pantalla completa desde el icono, como una app, también sin conexión.</p><button class="btn gold" data-act="install">Instalar</button></div></section>`;
  if (isIOS()) return `<section class="panel install">${img('icons/icon-192', 'appicon')}<div><h2>Instala FENICIA</h2><p>En Safari toca <b>Compartir</b> <span class="ios-share">⬆︎</span> y luego <b>Añadir a pantalla de inicio</b>.</p></div></section>`;
  return '';
}

// ---------------------------------------------------------------------------- pantalla de inicio (mejora 11)
let pickedCity = 'tiro';
function renderStart() {
  const list = saves.list().filter(x => store.getItem('fenicia.save.' + x.id));
  const cities = E.PORTS.filter(p => p.playable);
  startEl.innerHTML = `<div class="start-in">
    <h1 class="logo">${img('ilustraciones/logo_fenicia', 'logoimg')}<span class="sr">FENICIA</span></h1><p class="tagline">Comercia, crece y domina el Mediterráneo</p>
    ${list.length ? `<section class="panel"><h2>Tus partidas</h2>${list.map(x => { const p = E.PORT_BY_ID[x.cityId]; return `<div class="save">${img(`escudos/escudo_${x.cityId}`, 'w40')}<span><b>${esc(p.name)}</b><small>${ui(`dif_${p.difficulty}`)}${DIFF[p.difficulty!]} · ${ui('moneda')}${fmt(x.cash ?? 0)} · ${ui('nivel')}Nivel ${x.level} · ciclo ${x.cycle + 1}</small></span><button class="btn gold" data-act="cont" data-a="${x.id}">Continuar</button><button class="chip" data-act="ask_del" data-a="${x.id}" aria-label="Borrar">✕</button></div>`; }).join('')}</section>` : ''}
    <section class="panel"><h2>${list.length ? 'Nueva partida' : 'Elige tu ciudad'}</h2><div class="cities">${cities.map(c => `<button class="city ${pickedCity === c.id ? 'on' : ''}" data-act="pickcity" data-a="${c.id}">${img(`ilustraciones/ciudad_${c.id}`, 'pic')}<span class="cn">${img(`escudos/escudo_${c.id}`, 'w30')}<b>${esc(c.name)}</b></span><span class="cd">${ui(`dif_${c.difficulty}`)}${DIFF[c.difficulty!]}</span><small>${esc(c.specialties)}</small></button>`).join('')}</div>
      <button class="btn ${list.length ? '' : 'gold'} play" data-act="play">Empezar en ${esc(E.PORT_BY_ID[pickedCity].name)}</button>${list.length ? '<small class="hint">Cada partida es independiente: empezar otra no borra las que tienes.</small>' : ''}</section>
    ${installCard()}
    <section class="panel"><h2>Sonido</h2>${sheetSettings()}</section>
  </div>`;
}
function showStart() {
  running = false; sheet = null; tutStep = -1;
  for (const e of [hud, goal, toasts, ring, sheetEl, nav, tutor]) e.remove();
  labels.innerHTML = ''; tagEls.clear();
  root.appendChild(startEl); root.appendChild(modal);
  renderStart();
  audio.setMode('menu');
}
// El arte se carga una vez; cada ciudad hornea su propio mapa (y se guarda por si vuelves a ella)
let artReady: Promise<void> | null = null;
const worlds = new Map<string, World>();
async function prepareWorld(city: string) {
  artReady ??= loadArt();
  await artReady;
  let w = worlds.get(city);
  if (!w) { w = new World(); w.bake(city); worlds.set(city, w); }
  world = w;
  walkers = spawnWalkers(world, 80, 5 + city.length);
  resize();
}
async function startGame(g: GameState, fresh: boolean) {
  startEl.innerHTML = `<div class="loading">Preparando ${esc(E.PORT_BY_ID[g.cityId]?.name ?? 'la ciudad')}…</div>`;
  await prepareWorld(g.cityId);
  s = g; store.setItem(SLOT, s.id); cache.clear(); freshMap.clear(); prevOwned = ''; shipAnims.length = 0; prevAtSea = new Set(s.ships.filter(x => x.voyageId).map(x => x.id));
  tagEls.forEach(e => e.remove()); tagEls.clear();
  lastRevenue = s.stats.lifetimeRevenue; lastNote = s.notifications.at(-1) ?? null; seenNotes = s.notifications.length;
  // Partidas guardadas antes de esta versión: no repetir anuncios de lo ya conocido
  if (!fresh && !s.seenIntros.length) s.seenIntros = [...s.milestones.map(m => `h${m}`), 'tutorial'];
  startEl.remove();
  root.append(hud, goal, toasts, ring, sheetEl, nav, tutor, modal);
  focus(19, 22); renderHud();
  audio.setMode('game');
  running = true;
  saveNow();                                  // la partida nueva aparece ya en «Tus partidas»
  if (fresh && !s.seenIntros.includes('tutorial')) { s.seenIntros.push('tutorial'); startTutorial(); }
}
function saveNow() { if (running) saves.save(s, E.netWorth(s)); }
addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

// ---------------------------------------------------------------------------- bucle
let last = performance.now(), lastUi = 0, lastSave = 0;
function loop(t: number) {
  const dt = Math.min(0.25, (t - last) / 1000); last = t;
  if (running) {
    gesture.tick(t); showRing();
    E.advance(s, dt);
    const paused = s.time.speed === 0;
    audio.setGamePaused(paused);
    if (!paused) lastRunSpeed = s.time.speed as 1 | 6;
    // A ×6 todo se mueve más deprisa (la gente camina ~1,8 veces más rápido), sin ser seis veces
    const mult = s.time.speed === 6 ? 1.8 : 1;
    if (!paused) { animClock += dt * 1000 * mult; for (const w of walkers) stepWalker(world, w, dt, wr, mult); }
    trackShips(); trackFresh();
    draw();
    coinPops(t);
    const [cx, cy] = world.iso.inv(cam.x + viewW() / 2, cam.y + viewH() / 2, HQ);
    audio.setDockMix(cx > QX - 6 && cy > 4 && cy < 48 ? 1 : 0, dt);
    if (t - lastUi > 250) { lastUi = t; renderHud(); renderSheet(); pushToasts(); checkIntros(); if (tutStep >= 0) renderTutor(); }
    if (t - lastSave > 5000) { lastSave = t; saveNow(); }
  }
  requestAnimationFrame(loop);
}
addEventListener('resize', resize);
resetOldSaves();
resize();
prepareWorld('tiro');
showStart();
requestAnimationFrame(loop);
// Acceso para pruebas automáticas (no visible en el juego)
(window as any).__fenicia = { focus: (x: number, y: number) => focus(x, y), overview: () => world.terrain.toDataURL(), audio, state: () => s, world: () => world, walkers: () => walkers, A, E, zoom: (n: number) => setZoom(n), pause: () => openPause() };
