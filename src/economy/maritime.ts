// ============================================================================
// Transporte marítimo (GDD §14), expediciones, rutas automáticas y astillero (§15).
// ============================================================================
import { BALANCE } from './balance';
import { NAMES, SHIP_NAMES, SHIPS } from './data/catalog';
import { GOOD_BY_ID } from './data/goods';
import { PORT_BY_ID, seaDistanceKm } from './data/ports';
import { completeContract, recordSale } from './commerce';
import { automationReserve } from './costs';
import { addStock, freeStorage, removeStock, stockOf } from './inventory';
import { notify, post } from './ledger';
import {
  availableDemand, availableSupply, buyPrice, consumeDemand, consumeSupply, eventScalar, isPortBlocked,
  portSalePrice, wholesalePrice,
} from './market';
import { addPrestige, goodUnlocked, hasMilestone } from './progression';
import { nextId, pick, rand, randRange } from './rng';
import type {
  ActionResult, AutoRoute, CargoOrder, GameState, Protection, ReturnOrder, Ship, ShipClass, Voyage, VoyageCosts,
} from './types';

const fail = (error: string): ActionResult<any> => ({ ok: false, error });
const city = (s: GameState) => PORT_BY_ID[s.cityId];

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
export function shipCapacity(sh: Ship): number {
  return Math.floor(SHIPS[sh.cls].capacity * (1 + sh.capacityBonus));
}
export function shipSpeed(sh: Ship): number {
  return SHIPS[sh.cls].speed * BALANCE.voyageSpeedFactor * (1 + sh.speedBonus);
}
export function shipDefense(sh: Ship): number {
  return Math.min(0.9, SHIPS[sh.cls].defense + sh.defenseBonus);
}
export function legCycles(s: GameState, sh: Ship, to: string, skill: number): number {
  const km = seaDistanceKm(s.cityId, to);
  return Math.max(1, Math.ceil((km / shipSpeed(sh)) * (1 - 0.1 * skill)));
}
function captainSkill(s: GameState, captainId: string | null): number {
  return captainId ? s.captains.find(c => c.id === captainId)?.skill ?? 0 : BALANCE.captainPerVoyageSkill;
}
export function piracyChance(s: GameState, sh: Ship, to: string, protection: Protection, captainId: string | null): number {
  const base = (PORT_BY_ID[to].piracy + PORT_BY_ID[s.cityId].piracy) / 2;
  const km = seaDistanceKm(s.cityId, to);
  const distanceFactor = 0.5 + Math.min(2, km / 1500);
  const cond = sh.owned && sh.condition < 0.4 ? 1.5 : 1;
  return Math.min(0.9, base * distanceFactor * eventScalar(s, 'piracyMult') * cond
    * (1 - BALANCE.protection[protection].reduction) * (1 - shipDefense(sh)) * (1 - 0.5 * captainSkill(s, captainId)));
}

/** Costos variables de un viaje (GDD §14.4). */
export function estimateVoyageCosts(s: GameState, shipId: string, to: string, protection: Protection, captainId: string | null, units: number): VoyageCosts {
  const sh = s.ships.find(x => x.id === shipId)!;
  const d = SHIPS[sh.cls];
  const legs = legCycles(s, sh, to, captainSkill(s, captainId)) * 2;
  const mar = city(s).costs.maritime;
  const rent = !sh.owned && sh.rental === 'por_viaje' ? d.rentPerCycle * legs * mar : 0;
  const captain = captainId ? 0 : BALANCE.captainPerVoyageFeePerCycle * legs * mar;
  const crew = d.crewPerCycle * legs * mar;
  const coord = 1;
  const loading = Math.max(20, units * BALANCE.loadingPerUnit * 2 * coord);
  const size = Math.sqrt(d.capacity / SHIPS.galera_alquiler.capacity);
  const portFees = (city(s).costs.portFee + PORT_BY_ID[to].costs.portFee) / 2 * size * eventScalar(s, 'portFeeMult');
  const prot = BALANCE.protection[protection].perCycle * legs * mar;
  const r = (x: number) => Math.round(x);
  const c = { rent: r(rent), captain: r(captain), crew: r(crew), loading: r(loading), portFees: r(portFees), protection: r(prot), total: 0 };
  c.total = c.rent + c.captain + c.crew + c.loading + c.portFees + c.protection;
  return c;
}

/** Estimación de rentabilidad de un viaje con la carga indicada (para la interfaz). */
export function estimateVoyageProfit(s: GameState, shipId: string, to: string, cargo: CargoOrder[], protection: Protection, captainId: string | null) {
  const units = cargo.reduce((a, c) => a + c.qty, 0);
  const costs = estimateVoyageCosts(s, shipId, to, protection, captainId, units);
  let revenue = 0, cogs = 0;
  for (const c of cargo) {
    const q = Math.min(c.qty, availableDemand(s, c.goodId, to));
    revenue += q * portSalePrice(s, c.goodId, to);
    cogs += q * (s.inventory[c.goodId]?.avgCost ?? buyPrice(s, c.goodId));
  }
  const sh = s.ships.find(x => x.id === shipId)!;
  return { revenue, cogs, costs, profit: revenue - cogs - costs.total, cycles: legCycles(s, sh, to, captainSkill(s, captainId)) * 2, piracy: piracyChance(s, sh, to, protection, captainId) };
}

// ---------------------------------------------------------------------------
// Barcos y capitanes
// ---------------------------------------------------------------------------
function newShip(s: GameState, cls: ShipClass, owned: boolean, rental: Ship['rental']): Ship {
  const used = new Set(s.ships.map(x => x.name));
  const free = SHIP_NAMES.filter(n => !used.has(n));
  return {
    id: nextId(s, 'sh'), name: free.length ? free[0] : `Nave ${s.idCounter}`, cls, owned, rental,
    condition: 1, bookValue: owned ? SHIPS[cls].price : 0, capacityBonus: 0, speedBonus: 0, defenseBonus: 0,
    voyageId: null, underConstruction: 0,
  };
}

export function rentShip(s: GameState, contract: 'por_viaje' | 'por_ciclo' = 'por_viaje'): ActionResult<Ship> {
  if (!hasMilestone(s, 15)) return fail('Requiere el hito 15: Alquiler de barco');
  if (s.ships.filter(x => !x.owned).length >= BALANCE.maxRentedShips) return fail(`Máximo ${BALANCE.maxRentedShips} barcos alquilados`);
  const sh = newShip(s, 'galera_alquiler', false, contract);
  s.ships.push(sh);
  notify(s, 'info', `Alquilaste la galera ${sh.name} (contrato ${contract === 'por_viaje' ? 'por viaje' : 'por ciclo'}).`);
  return { ok: true, data: sh };
}

export function returnShip(s: GameState, shipId: string): ActionResult {
  const sh = s.ships.find(x => x.id === shipId);
  if (!sh || sh.owned) return fail('No es un barco alquilado');
  if (sh.voyageId) return fail('El barco está navegando');
  s.ships = s.ships.filter(x => x !== sh);
  for (const r of s.autoRoutes) if (r.shipId === shipId) r.active = false;
  return { ok: true };
}

/**
 * Encargar un barco: se construye en el astillero. Hace falta el astillero de la ciudad contratado
 * (hito 20) o uno propio (hito 24, un 30% más barato). Tarda los ciclos de construcción del barco.
 */
export function buyShip(s: GameState, cls: Exclude<ShipClass, 'galera_alquiler'>): ActionResult<Ship> {
  const need = cls === 'avanzado' ? 21 : 20;
  if (!hasMilestone(s, need)) return fail(`Requiere el hito ${need}`);
  if (!s.hasShipyard && !s.shipyardRented) return fail('Necesitas el astillero: contrata el de la ciudad o cómpralo');
  if (s.ships.some(x => x.underConstruction > 0)) return fail('El astillero ya está construyendo un barco');
  const price = Math.round(SHIPS[cls].price * (s.hasShipyard ? BALANCE.shipyardBuildDiscount : 1));
  if (s.cash < price) return fail(`Necesitas ${price.toLocaleString('es')} monedas`);
  post(s, 'investment.barco', price, `Construcción: ${SHIPS[cls].name}`);
  const sh = newShip(s, cls, true, null);
  sh.bookValue = price;
  sh.underConstruction = SHIPS[cls].buildCycles;
  s.ships.push(sh);
  notify(s, 'exito', `El astillero empezó a construir tu ${SHIPS[cls].name.toLowerCase()} ${sh.name}: estará listo en ${sh.underConstruction} ciclos.`);
  return { ok: true, data: sh };
}

export function sellShip(s: GameState, shipId: string): ActionResult<{ proceeds: number }> {
  const sh = s.ships.find(x => x.id === shipId);
  if (!sh?.owned) return fail('No es un barco propio');
  if (sh.voyageId) return fail('El barco está navegando');
  const proceeds = Math.round(sh.bookValue * 0.7 * (0.5 + 0.5 * sh.condition));
  post(s, 'asset_sale.activo', proceeds, sh.name);
  post(s, 'loss.venta_activos', sh.bookValue - proceeds);
  s.ships = s.ships.filter(x => x !== sh);
  for (const r of s.autoRoutes) if (r.shipId === shipId) r.active = false;
  return { ok: true, data: { proceeds } };
}

export function hireCaptain(s: GameState): ActionResult {
  if (!hasMilestone(s, 16)) return fail('Requiere el hito 16');
  if (s.captains.length >= (hasMilestone(s, 21) ? Infinity : 1)) return fail('Requiere el hito 21 para tener varios capitanes');
  const skill = Math.round(randRange(s, 0.3, 0.85) * 100) / 100;
  const used = new Set([...s.workers.map(w => w.name), ...s.captains.map(c => c.name)]);
  const free = NAMES.filter(n => !used.has(n));
  const c = { id: nextId(s, 'cap'), name: free.length ? pick(s, free) : `Capitán ${s.idCounter}`, skill, salary: Math.round(BALANCE.captainSalaryBase * (1 + skill) * city(s).costs.wages), assignedShipId: null };
  s.captains.push(c);
  notify(s, 'info', `Contrataste al capitán ${c.name} (pericia ${Math.round(skill * 100)}%, ${c.salary}/ciclo).`);
  return { ok: true };
}

export function fireCaptain(s: GameState, captainId: string): ActionResult {
  if (s.voyages.some(v => v.captainId === captainId)) return fail('El capitán está navegando');
  s.captains = s.captains.filter(c => c.id !== captainId);
  for (const r of s.autoRoutes) if (r.captainId === captainId) r.captainId = null;
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Viajes
// ---------------------------------------------------------------------------
export interface VoyagePlan {
  shipId: string;
  to: string;
  cargo: CargoOrder[];
  returnOrders?: ReturnOrder[];
  protection?: Protection;
  captainId?: string | null;
  automatedRouteId?: string | null;
}

export function launchVoyage(s: GameState, plan: VoyagePlan): ActionResult<Voyage> {
  if (!hasMilestone(s, 15)) return fail('Requiere el hito 15');
  const sh = s.ships.find(x => x.id === plan.shipId);
  if (!sh) return fail('Barco no encontrado');
  if (sh.voyageId) return fail('El barco ya está navegando');
  if (sh.underConstruction > 0) return fail('El barco sigue en construcción');
  if (sh.owned && sh.condition < BALANCE.shipMinCondition) return fail('El barco necesita reparaciones antes de zarpar');
  if (!s.knownRoutes.includes(plan.to)) return fail('Ruta no descubierta');
  if (isPortBlocked(s, plan.to)) return fail('Ese puerto está bloqueado');
  const captainId = plan.captainId ?? null;
  if (captainId) {
    const c = s.captains.find(x => x.id === captainId);
    if (!c) return fail('Capitán no encontrado');
    if (s.voyages.some(v => v.captainId === captainId)) return fail('Ese capitán ya está navegando');
  }
  const cargo = plan.cargo.filter(c => c.qty > 0);
  const units = cargo.reduce((a, c) => a + c.qty, 0);
  if (units > shipCapacity(sh)) return fail(`La bodega admite ${shipCapacity(sh)} unidades`);
  for (const c of cargo) if (stockOf(s, c.goodId) < c.qty) return fail(`No tienes ${c.qty} de ${GOOD_BY_ID[c.goodId].name}`);
  const protection = plan.protection ?? 'ninguna';
  const costs = estimateVoyageCosts(s, sh.id, plan.to, protection, captainId, units);
  if (s.cash < costs.total) return fail(`Necesitas ${costs.total} monedas para costear el viaje`);

  post(s, 'variable.alquiler_barco', costs.rent);
  post(s, 'variable.capitan', costs.captain);
  post(s, 'variable.tripulacion', costs.crew);
  post(s, 'variable.carga', costs.loading);
  post(s, 'variable.tasas_portuarias', costs.portFees);
  post(s, 'variable.proteccion', costs.protection);
  const lots = cargo.map(c => ({ goodId: c.goodId, qty: c.qty, avgCost: removeStock(s, c.goodId, c.qty) / c.qty }));
  const leg = legCycles(s, sh, plan.to, captainSkill(s, captainId));
  const v: Voyage = {
    id: nextId(s, 'vy'), shipId: sh.id, captainId, routeId: plan.to, from: s.cityId, to: plan.to,
    phase: 'ida', cyclesLeft: leg, legCycles: leg, cargo: lots, returnOrders: plan.returnOrders ?? [],
    protection, costs, revenue: 0, cogs: 0, lost: 0, log: [`Zarpa hacia ${PORT_BY_ID[plan.to].name} con ${units} unidades.`],
    automatedRouteId: plan.automatedRouteId ?? null,
  };
  s.voyages.push(v);
  sh.voyageId = v.id;
  return { ok: true, data: v };
}

function rollPiracy(s: GameState, v: Voyage, sh: Ship): void {
  if (rand(s) >= piracyChance(s, sh, v.to, v.protection, v.captainId)) return;
  const frac = randRange(s, BALANCE.piracyLossMin, BALANCE.piracyLossMax);
  let lostCost = 0;
  for (const c of v.cargo) {
    const q = Math.floor(c.qty * frac);
    lostCost += q * c.avgCost;
    c.qty -= q;
  }
  v.cargo = v.cargo.filter(c => c.qty > 0);
  if (lostCost > 0) post(s, 'loss.pirateria', lostCost, sh.name);
  v.lost += lostCost;
  if (sh.owned) sh.condition = Math.max(0, sh.condition - BALANCE.piracyDamage);
  v.log.push(`¡Piratas! Se perdió el ${Math.round(frac * 100)}% de la carga.`);
  notify(s, 'alerta', `Piratas asaltaron el ${sh.name}: se perdió el ${Math.round(frac * 100)}% de la carga.`);
}

function wear(s: GameState, v: Voyage, sh: Ship): void {
  if (!sh.owned) return;
  sh.condition = Math.max(0, sh.condition - (BALANCE.wearPerLeg + BALANCE.wearPerKm * seaDistanceKm(s.cityId, v.to)));
}

function arriveAtPort(s: GameState, v: Voyage, sh: Ship): void {
  rollPiracy(s, v, sh);
  wear(s, v, sh);
  const port = v.to;
  // 1) Contratos internacionales hacia este puerto
  for (const k of s.contracts) {
    if (k.status !== 'aceptado' || k.kind !== 'internacional' || k.port !== port) continue;
    const lot = v.cargo.find(c => c.goodId === k.goodId);
    if (!lot) continue;
    const q = Math.min(lot.qty, k.qty - k.delivered);
    if (q <= 0) continue;
    recordSale(s, k.goodId, q, k.unitPrice, 'contracts', false, q * lot.avgCost);
    v.revenue += q * k.unitPrice; v.cogs += q * lot.avgCost;
    lot.qty -= q; k.delivered += q;
    if (k.delivered >= k.qty) completeContract(s, k);
  }
  // 2) Venta a los comerciantes del puerto
  for (const lot of v.cargo) {
    const q = Math.min(lot.qty, availableDemand(s, lot.goodId, port));
    if (q <= 0) continue;
    const price = portSalePrice(s, lot.goodId, port);
    recordSale(s, lot.goodId, q, price, 'maritime', false, q * lot.avgCost);
    consumeDemand(s, port, lot.goodId, q);
    v.revenue += q * price; v.cogs += q * lot.avgCost;
    lot.qty -= q;
  }
  // 2b) Lo que no absorbió el mercado lo compran los mayoristas del puerto (a menor precio): vuelve todo vendido
  for (const lot of v.cargo) {
    if (lot.qty <= 0) continue;
    const price = Math.max(1, Math.round(portSalePrice(s, lot.goodId, port) * BALANCE.portBulkDiscount));
    recordSale(s, lot.goodId, lot.qty, price, 'maritime', false, lot.qty * lot.avgCost);
    v.revenue += lot.qty * price; v.cogs += lot.qty * lot.avgCost;
    lot.qty = 0;
  }
  v.cargo = v.cargo.filter(c => c.qty > 0);
  // 3) Carga de retorno
  let space = shipCapacity(sh) - v.cargo.reduce((a, c) => a + c.qty, 0);
  for (const o of v.returnOrders) {
    if (space <= 0) break;
    if (!goodUnlocked(s, o.goodId)) continue;
    const price = buyPrice(s, o.goodId, port);
    if (o.maxPrice > 0 && price > o.maxPrice) continue;
    const loadCost = BALANCE.loadingPerUnit * 2;
    const q = Math.min(o.qty, space, availableSupply(s, o.goodId, port), Math.floor(Math.max(0, s.cash - automationReserve(s)) / (price + loadCost)));
    if (q <= 0) continue;
    post(s, 'inventory.puerto', q * price, `${q} × ${GOOD_BY_ID[o.goodId].name} en ${PORT_BY_ID[port].name}`);
    post(s, 'variable.carga', q * loadCost);
    consumeSupply(s, port, o.goodId, q);
    const ex = v.cargo.find(c => c.goodId === o.goodId);
    if (ex) { ex.avgCost = (ex.avgCost * ex.qty + price * q) / (ex.qty + q); ex.qty += q; }
    else v.cargo.push({ goodId: o.goodId, qty: q, avgCost: price });
    space -= q;
  }
  v.log.push(`Llega a ${PORT_BY_ID[port].name}: ventas ${Math.round(v.revenue)}.`);
  v.phase = 'vuelta';
  v.cyclesLeft = v.legCycles;
}

function returnHome(s: GameState, v: Voyage, sh: Ship): void {
  rollPiracy(s, v, sh);
  wear(s, v, sh);
  for (const lot of v.cargo) {
    const fit = Math.min(lot.qty, freeStorage(s));
    if (fit > 0) addStock(s, lot.goodId, fit, lot.avgCost);
    const rest = lot.qty - fit;
    if (rest > 0) {
      // Sin espacio: el excedente se vende a comerciantes del puerto local
      const price = wholesalePrice(s, lot.goodId);
      recordSale(s, lot.goodId, rest, price, 'home_wholesale', false, rest * lot.avgCost);
      v.revenue += rest * price; v.cogs += rest * lot.avgCost;
      notify(s, 'alerta', `Sin espacio en almacén: ${rest} ${GOOD_BY_ID[lot.goodId].name} se vendieron al por mayor.`);
    }
  }
  v.cargo = [];
  v.phase = 'terminado';
  sh.voyageId = null;
  s.voyages = s.voyages.filter(x => x !== v);
  s.stats.voyagesCompleted++;
  const km = seaDistanceKm(s.cityId, v.to);
  addPrestige(s, BALANCE.prestige.perVoyage + BALANCE.prestige.perVoyagePer1000Km * km / 1000);
  const profit = v.revenue - v.cogs - v.costs.total - v.lost;
  const r = v.automatedRouteId ? s.autoRoutes.find(x => x.id === v.automatedRouteId) : null;
  if (r) { r.trips++; r.profitTotal += profit; }
  notify(s, profit >= 0 ? 'exito' : 'alerta', `El ${sh.name} volvió de ${PORT_BY_ID[v.to].name}. Resultado del viaje: ${profit >= 0 ? '+' : ''}${Math.round(profit).toLocaleString('es')}.`);
}

// ---------------------------------------------------------------------------
// Expediciones (GDD §14.2)
// ---------------------------------------------------------------------------
export function expeditionRequired(s: GameState, target: string): number {
  return Math.round((BALANCE.expeditionBase + BALANCE.expeditionPerKm * seaDistanceKm(s.cityId, target)) * city(s).costs.maritime);
}
export function expeditionChance(s: GameState, target: string, budget: number): number {
  const req = expeditionRequired(s, target);
  return Math.min(BALANCE.expeditionMaxChance, Math.max(0, 0.1 + 0.85 * budget / req) * (1 - PORT_BY_ID[target].piracy));
}

export function fundExpedition(s: GameState, target: string, budget: number): ActionResult {
  if (!hasMilestone(s, 17)) return fail('Requiere el hito 17: Financiación de expediciones');
  if (target === s.cityId || !PORT_BY_ID[target]) return fail('Destino inválido');
  if (s.knownRoutes.includes(target)) return fail('Esa ruta ya es conocida');
  if (s.expeditions.some(e => e.target === target)) return fail('Ya hay una expedición en camino');
  const required = expeditionRequired(s, target);
  budget = Math.round(budget);
  if (budget < required * 0.3) return fail(`Presupuesto mínimo: ${Math.ceil(required * 0.3)}`);
  if (budget > s.cash) return fail('Dinero insuficiente');
  post(s, 'variable.expedicion', budget, PORT_BY_ID[target].name);
  const km = seaDistanceKm(s.cityId, target);
  s.expeditions.push({ id: nextId(s, 'ex'), target, budget, required, chance: expeditionChance(s, target, budget), cyclesLeft: Math.max(2, Math.ceil(km / 240) * 2) });
  s.stats.expeditionsLaunched++;
  notify(s, 'info', `Financiaste una expedición a ${PORT_BY_ID[target].name}.`);
  return { ok: true };
}

export function discoverRoute(s: GameState, port: string, source: string): void {
  if (s.knownRoutes.includes(port)) return;
  s.knownRoutes.push(port);
  s.stats.routesDiscovered++;
  addPrestige(s, BALANCE.prestige.perDiscovery, `nueva ruta a ${PORT_BY_ID[port].name}`);
  notify(s, 'exito', `${source}: ¡ruta hacia ${PORT_BY_ID[port].name} descubierta! (${PORT_BY_ID[port].specialties})`);
}

// ---------------------------------------------------------------------------
// Rutas automáticas (GDD §14.5)
// ---------------------------------------------------------------------------
export function createAutoRoute(s: GameState, cfg: Omit<AutoRoute, 'id' | 'name' | 'active' | 'lastDeparture' | 'trips' | 'profitTotal'> & { name?: string }): ActionResult<AutoRoute> {
  if (!hasMilestone(s, 19)) return fail('Requiere el hito 19: Automatización de rutas');
  if (!s.knownRoutes.includes(cfg.to)) return fail('Ruta no descubierta');
  if (!s.ships.some(x => x.id === cfg.shipId)) return fail('Barco no encontrado');
  if (s.autoRoutes.some(r => r.active && r.shipId === cfg.shipId)) return fail('Ese barco ya cubre otra ruta');
  if (cfg.captainId && s.autoRoutes.some(r => r.active && r.captainId === cfg.captainId)) return fail('Ese capitán ya cubre otra ruta');
  const r: AutoRoute = { ...cfg, id: nextId(s, 'rt'), name: cfg.name ?? `${city(s).name} – ${PORT_BY_ID[cfg.to].name}`, active: true, lastDeparture: -Infinity, trips: 0, profitTotal: 0 };
  r.lastDeparture = -1e9;
  s.autoRoutes.push(r);
  return { ok: true, data: r };
}

export function setRouteActive(s: GameState, routeId: string, active: boolean): ActionResult {
  const r = s.autoRoutes.find(x => x.id === routeId);
  if (!r) return fail('Ruta no encontrada');
  r.active = active;
  return { ok: true };
}

export function deleteRoute(s: GameState, routeId: string): ActionResult {
  s.autoRoutes = s.autoRoutes.filter(x => x.id !== routeId);
  return { ok: true };
}

function dispatchRoutes(s: GameState): void {
  for (const r of s.autoRoutes) {
    if (!r.active) continue;
    const sh = s.ships.find(x => x.id === r.shipId);
    if (!sh || sh.voyageId || sh.underConstruction > 0) continue;
    if (s.time.cycle - r.lastDeparture < r.frequency) continue;
    if (isPortBlocked(s, r.to)) continue;
    let space = shipCapacity(sh);
    const cargo: CargoOrder[] = [];
    for (const o of r.cargo) {
      const q = Math.min(o.qty, stockOf(s, o.goodId), space);
      if (q > 0) { cargo.push({ goodId: o.goodId, qty: q }); space -= q; }
    }
    if (!cargo.length && !r.returnOrders.length) continue;
    const res = launchVoyage(s, { shipId: sh.id, to: r.to, cargo, returnOrders: r.returnOrders, protection: r.protection, captainId: r.captainId, automatedRouteId: r.id });
    if (res.ok) { r.lastDeparture = s.time.cycle; }
  }
}

// ---------------------------------------------------------------------------
// Astillero (GDD §15) y reparaciones
// ---------------------------------------------------------------------------
export function buyShipyard(s: GameState): ActionResult {
  if (!hasMilestone(s, 24)) return fail('Requiere el hito 24: 1.500.000 de patrimonio');
  if (s.hasShipyard) return fail('Ya tienes astillero');
  if (s.cash < BALANCE.shipyardPrice) return fail(`Necesitas ${BALANCE.shipyardPrice.toLocaleString('es')} monedas`);
  post(s, 'investment.astillero', BALANCE.shipyardPrice, 'Astillero');
  s.hasShipyard = true;
  notify(s, 'exito', '¡El astillero es tuyo! Ya puedes construir, reparar y mejorar barcos.');
  return { ok: true };
}

export const buildShip = buyShip;

export function repairCost(s: GameState, shipId: string): number {
  const sh = s.ships.find(x => x.id === shipId);
  if (!sh?.owned) return 0;
  const base = SHIPS[sh.cls].price * (1 - sh.condition) * BALANCE.repairCostFactor;
  return Math.round(base * (s.hasShipyard ? BALANCE.shipyardRepairDiscount : 1));
}

export function repairShip(s: GameState, shipId: string): ActionResult<{ cost: number }> {
  const sh = s.ships.find(x => x.id === shipId);
  if (!sh?.owned) return fail('Sólo se reparan barcos propios');
  if (sh.voyageId) return fail('El barco está navegando');
  const cost = repairCost(s, shipId);
  if (cost <= 0) return fail('El barco está en perfecto estado');
  if (s.cash < cost) return fail(`Necesitas ${cost} monedas`);
  post(s, 'fixed.reparaciones', cost, sh.name);
  sh.condition = 1;
  return { ok: true, data: { cost } };
}

export type UpgradeId = keyof typeof BALANCE.upgrades;

export function upgradeShip(s: GameState, shipId: string, up: UpgradeId): ActionResult {
  if (!hasMilestone(s, 25)) return fail('Requiere astillero propio (hito 25)');
  const sh = s.ships.find(x => x.id === shipId);
  if (!sh?.owned) return fail('Sólo se mejoran barcos propios');
  if (sh.voyageId) return fail('El barco está navegando');
  const u = BALANCE.upgrades[up];
  const cost = Math.round(SHIPS[sh.cls].price * u.costFrac);
  if (s.cash < cost) return fail(`Necesitas ${cost} monedas`);
  if ('capacity' in u) { if (sh.capacityBonus >= 0.5) return fail('Mejora al máximo'); sh.capacityBonus += u.capacity; }
  if ('speed' in u) { if (sh.speedBonus >= 0.3) return fail('Mejora al máximo'); sh.speedBonus += u.speed; }
  if ('defense' in u) { if (sh.defenseBonus >= 0.3) return fail('Mejora al máximo'); sh.defenseBonus += u.defense; }
  post(s, 'investment.mejora', cost, `${u.name} – ${sh.name}`);
  sh.bookValue += cost;
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Proceso de cierre de ciclo
// ---------------------------------------------------------------------------
export function processMaritime(s: GameState): void {
  // Bloqueo portuario: quien navegaba hacia ese puerto da media vuelta con la carga
  for (const v of s.voyages) if (v.phase === 'ida' && isPortBlocked(s, v.to)) {
    v.phase = 'vuelta'; v.cyclesLeft = Math.max(1, v.legCycles - v.cyclesLeft);
    v.turnedBack = true;
    notify(s, 'alerta', `Bloqueo en ${PORT_BY_ID[v.to].name}: el ${s.ships.find(x => x.id === v.shipId)?.name ?? 'barco'} da media vuelta con su carga.`);
  }
  // Construcción
  for (const sh of s.ships) if (sh.underConstruction > 0 && --sh.underConstruction === 0) notify(s, 'exito', `El ${sh.name} salió del astillero.`);
  // Viajes
  for (const v of [...s.voyages]) {
    const sh = s.ships.find(x => x.id === v.shipId)!;
    v.cyclesLeft--;
    if (v.cyclesLeft > 0) continue;
    if (v.phase === 'ida') arriveAtPort(s, v, sh);
    else if (v.phase === 'vuelta') returnHome(s, v, sh);
  }
  // Expediciones
  for (const e of [...s.expeditions]) {
    if (--e.cyclesLeft > 0) continue;
    s.expeditions = s.expeditions.filter(x => x !== e);
    if (rand(s) < e.chance) { s.stats.expeditionsSucceeded++; discoverRoute(s, e.target, 'Expedición exitosa'); }
    else notify(s, 'alerta', `La expedición a ${PORT_BY_ID[e.target].name} regresó sin encontrar una ruta segura.`);
  }
  dispatchRoutes(s);
}
