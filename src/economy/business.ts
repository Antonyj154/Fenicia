// ============================================================================
// Personal (GDD §9), establecimientos (§10) y almacenes (§11).
// ============================================================================
import { BALANCE } from './balance';
import { NAMES, ROLES } from './data/catalog';
import { salaryFor, VENUE_BY_ID, WAREHOUSE_BY_ID } from './costs';
import { inventoryUnits, storageCapacity } from './inventory';
import { notify, post } from './ledger';
import { hasMilestone } from './progression';
import { nextId, pick } from './rng';
import type { ActionResult, GameState, Worker, WorkerRole } from './types';

const fail = (error: string): ActionResult<any> => ({ ok: false, error });

// ---------------------------------------------------------------------------
// Trabajadores
// ---------------------------------------------------------------------------
export function workerLimit(s: GameState): number {
  return hasMilestone(s, 7) ? Infinity : hasMilestone(s, 3) ? BALANCE.maxWorkersBeforeMilestone7 : 0;
}

export function slotsUsed(s: GameState, venueId: string | null): number {
  return s.workers.filter(w => w.role === 'vendedor' && w.venueId === venueId).length;
}
export function slotsTotal(venueId: string | null): number {
  return venueId === null ? BALANCE.ambulantSlots : VENUE_BY_ID[venueId].slots;
}

function roleLimit(s: GameState, role: WorkerRole): number {
  if (role === 'almacenero') return s.warehouses.length * 2;
  return Infinity;
}

export function hireWorker(s: GameState, role: WorkerRole, venueId: string | null = null): ActionResult<Worker> {
  const def = ROLES[role];
  if (!def) return fail('Rol desconocido');
  if (!hasMilestone(s, def.minMilestone)) return fail(`Requiere el hito ${def.minMilestone}`);
  if (s.workers.length >= workerLimit(s)) return fail('Aún no puedes contratar más personal (hito 7)');
  if (s.workers.filter(w => w.role === role).length >= roleLimit(s, role)) {
    return fail('Cada almacén admite 2 almaceneros');
  }
  if (role === 'vendedor') {
    if (venueId !== null && !s.venues.some(v => v.defId === venueId)) return fail('No tienes ese establecimiento');
    if (slotsUsed(s, venueId) >= slotsTotal(venueId)) return fail('No quedan plazas en ese lugar');
  } else venueId = null;
  const used = new Set(s.workers.map(w => w.name));
  const free = NAMES.filter(n => !used.has(n));
  const w: Worker = {
    id: nextId(s, 'w'), name: free.length ? pick(s, free) : `${pick(s, NAMES)} ${s.idCounter}`,
    role, venueId, salary: salaryFor(s, role), hiredCycle: s.time.cycle,
  };
  s.workers.push(w);
  notify(s, 'info', `Contrataste a ${w.name} como ${def.name.toLowerCase()} (${w.salary}/ciclo).`);
  return { ok: true, data: w };
}

export function fireWorker(s: GameState, workerId: string): ActionResult {
  const i = s.workers.findIndex(w => w.id === workerId);
  if (i < 0) return fail('Trabajador no encontrado');
  s.workers.splice(i, 1);
  return { ok: true };
}

export function assignWorker(s: GameState, workerId: string, venueId: string | null): ActionResult {
  const w = s.workers.find(x => x.id === workerId);
  if (!w) return fail('Trabajador no encontrado');
  if (w.role !== 'vendedor') return fail('Sólo los vendedores se asignan a establecimientos');
  if (venueId !== null && !s.venues.some(v => v.defId === venueId)) return fail('No tienes ese establecimiento');
  if (w.venueId === venueId) return { ok: true };
  if (slotsUsed(s, venueId) >= slotsTotal(venueId)) return fail('No quedan plazas en ese lugar');
  w.venueId = venueId;
  return { ok: true };
}

/** Capacidad de venta automática (unidades/ciclo). */
export function salesCapacity(s: GameState): number {
  let c = 0;
  for (const w of s.workers) {
    if (w.role !== 'vendedor') continue;
    c += ROLES.vendedor.capacity * (w.venueId ? VENUE_BY_ID[w.venueId].traffic : 1);
  }
  return c;
}

// ---------------------------------------------------------------------------
// Establecimientos
// ---------------------------------------------------------------------------
function venueCountLimit(s: GameState, kind: 'puesto' | 'local'): number {
  if (hasMilestone(s, 13)) return Infinity;
  return kind === 'puesto' ? BALANCE.maxPuestosBeforeMilestone13 : BALANCE.maxLocalesBeforeMilestone13;
}

export function rentVenue(s: GameState, defId: string): ActionResult {
  const d = VENUE_BY_ID[defId];
  if (!d) return fail('Establecimiento desconocido');
  if (!hasMilestone(s, d.minMilestone)) return fail(`Requiere el hito ${d.minMilestone}`);
  if (s.venues.some(v => v.defId === defId)) return fail('Ya ocupas esta ubicación');
  if (s.venues.filter(v => VENUE_BY_ID[v.defId].kind === d.kind).length >= venueCountLimit(s, d.kind)) return fail('Necesitas el hito 13 para tener más establecimientos');
  s.venues.push({ defId, owned: false, bookValue: 0, acquiredCycle: s.time.cycle });
  notify(s, 'info', `Alquilaste ${d.name}.`);
  return { ok: true };
}

/** Compra un local (si ya lo alquilabas, el alquiler se sustituye por mantenimiento). */
export function buyVenue(s: GameState, defId: string): ActionResult {
  const d = VENUE_BY_ID[defId];
  if (!d || d.price <= 0) return fail('Esta ubicación no está en venta');
  if (!hasMilestone(s, 10)) return fail('Requiere el hito 10: Compra de local propio');
  if (!hasMilestone(s, d.minMilestone)) return fail(`Requiere el hito ${d.minMilestone}`);
  const existing = s.venues.find(v => v.defId === defId);
  if (existing?.owned) return fail('Ya es tuyo');
  if (!existing && s.venues.filter(v => VENUE_BY_ID[v.defId].kind === d.kind).length >= venueCountLimit(s, d.kind)) return fail('Necesitas el hito 13 para tener más establecimientos');
  if (s.cash < d.price) return fail(`Necesitas ${d.price} monedas`);
  post(s, 'investment.local', d.price, d.name);
  if (existing) { existing.owned = true; existing.bookValue = d.price; }
  else s.venues.push({ defId, owned: true, bookValue: d.price, acquiredCycle: s.time.cycle });
  notify(s, 'exito', `¡${d.name} ahora es tuyo!`);
  return { ok: true };
}

function venueRemovable(s: GameState, defId: string): string | null {
  const d = VENUE_BY_ID[defId];
  if (storageCapacity(s) - d.storage < inventoryUnits(s)) return 'Libera inventario antes: no cabría en el resto de tu espacio';
  return null;
}

function relocateWorkers(s: GameState, defId: string): void {
  for (const w of s.workers.filter(x => x.venueId === defId)) {
    if (slotsUsed(s, null) < BALANCE.ambulantSlots) w.venueId = null;
    else { s.workers = s.workers.filter(x => x.id !== w.id); notify(s, 'alerta', `${w.name} se quedó sin puesto de trabajo y se marchó.`); }
  }
}

export function releaseVenue(s: GameState, defId: string): ActionResult {
  const v = s.venues.find(x => x.defId === defId);
  if (!v) return fail('No ocupas esta ubicación');
  if (v.owned) return fail('Es propio: véndelo en lugar de dejarlo');
  const why = venueRemovable(s, defId); if (why) return fail(why);
  s.venues = s.venues.filter(x => x !== v);
  relocateWorkers(s, defId);
  return { ok: true };
}

export const ASSET_RESALE = 0.8;

export function sellVenue(s: GameState, defId: string): ActionResult<{ proceeds: number }> {
  const v = s.venues.find(x => x.defId === defId);
  if (!v?.owned) return fail('No es tuyo');
  const why = venueRemovable(s, defId); if (why) return fail(why);
  const proceeds = Math.round(v.bookValue * ASSET_RESALE);
  post(s, 'asset_sale.activo', proceeds, VENUE_BY_ID[defId].name);
  post(s, 'loss.venta_activos', v.bookValue - proceeds);
  s.venues = s.venues.filter(x => x !== v);
  relocateWorkers(s, defId);
  return { ok: true, data: { proceeds } };
}

// ---------------------------------------------------------------------------
// Almacenes
// ---------------------------------------------------------------------------
export function rentWarehouse(s: GameState, defId: string): ActionResult {
  const d = WAREHOUSE_BY_ID[defId];
  if (!d) return fail('Almacén desconocido');
  if (!hasMilestone(s, d.minMilestone)) return fail(`Requiere el hito ${d.minMilestone}`);
  s.warehouses.push({ uid: nextId(s, 'wh'), defId, owned: false, bookValue: 0, acquiredCycle: s.time.cycle });
  notify(s, 'info', `Alquilaste un ${d.name.toLowerCase()} (+${d.capacity} unidades).`);
  return { ok: true };
}

export function buyWarehouse(s: GameState, defId: string, convertUid?: string): ActionResult {
  const d = WAREHOUSE_BY_ID[defId];
  if (!d) return fail('Almacén desconocido');
  if (!hasMilestone(s, Math.max(10, d.minMilestone))) return fail(`Requiere el hito ${Math.max(10, d.minMilestone)}`);
  if (s.cash < d.price) return fail(`Necesitas ${d.price} monedas`);
  const existing = convertUid ? s.warehouses.find(w => w.uid === convertUid && w.defId === defId && !w.owned) : undefined;
  post(s, 'investment.almacen', d.price, d.name);
  if (existing) { existing.owned = true; existing.bookValue = d.price; }
  else s.warehouses.push({ uid: nextId(s, 'wh'), defId, owned: true, bookValue: d.price, acquiredCycle: s.time.cycle });
  return { ok: true };
}

export function releaseWarehouse(s: GameState, uid: string): ActionResult {
  const w = s.warehouses.find(x => x.uid === uid);
  if (!w) return fail('Almacén no encontrado');
  const d = WAREHOUSE_BY_ID[w.defId];
  if (storageCapacity(s) - d.capacity < inventoryUnits(s)) return fail('Libera inventario antes: no cabría en el resto de tu espacio');
  if (w.owned) {
    const proceeds = Math.round(w.bookValue * ASSET_RESALE);
    post(s, 'asset_sale.activo', proceeds, d.name);
    post(s, 'loss.venta_activos', w.bookValue - proceeds);
  }
  s.warehouses = s.warehouses.filter(x => x !== w);
  // Los almaceneros que sobran se marchan
  for (const role of ['almacenero'] as const) {
    const list = s.workers.filter(x => x.role === role);
    const excess = list.length - roleLimit(s, role);
    for (const x of list.slice(0, Math.max(0, excess))) s.workers = s.workers.filter(y => y !== x);
  }
  return { ok: true };
}

/** Por qué no se puede alquilar/comprar un establecimiento (null = se puede). La interfaz desactiva el botón. */
export function venueBlock(s: GameState, defId: string, mode: 'rent' | 'buy'): string | null {
  const d = VENUE_BY_ID[defId];
  if (!d) return 'Desconocido';
  if (!hasMilestone(s, d.minMilestone)) return `Requiere el hito ${d.minMilestone}`;
  if (mode === 'buy' && !d.price) return 'No está en venta';
  if (mode === 'buy' && !hasMilestone(s, 10)) return 'Requiere el hito 10: Compra de local propio';
  const existing = s.venues.find(v => v.defId === defId);
  if (mode === 'rent' && existing) return 'Ya lo ocupas';
  if (!existing && s.venues.filter(v => VENUE_BY_ID[v.defId].kind === d.kind).length >= venueCountLimit(s, d.kind)) return `Requiere el hito 13: solo puedes tener ${d.kind === 'puesto' ? 'un puesto' : 'un local'} hasta entonces`;
  return null;
}
export function warehouseBlock(s: GameState, defId: string, mode: 'rent' | 'buy'): string | null {
  const d = WAREHOUSE_BY_ID[defId];
  if (!hasMilestone(s, d.minMilestone)) return `Requiere el hito ${d.minMilestone}`;
  if (mode === 'buy' && !hasMilestone(s, 10)) return 'Comprar requiere el hito 10';
  return null;
}
/** Plazas libres para contratar un rol en un lugar (null = ilimitado por lugar). */
export function canHire(s: GameState, role: WorkerRole, venueId: string | null): string | null {
  const def = ROLES[role];
  if (!hasMilestone(s, def.minMilestone)) return `Requiere el hito ${def.minMilestone}`;
  if (s.workers.length >= workerLimit(s)) return 'Requiere el hito 7 para contratar más personal';
  if (s.workers.filter(w => w.role === role).length >= roleLimit(s, role)) return 'Cada almacén admite 2 almaceneros';
  if (role === 'vendedor' && slotsUsed(s, venueId) >= slotsTotal(venueId)) return 'No quedan plazas aquí';
  return null;
}
