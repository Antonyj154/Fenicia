// ============================================================================
// Rutas comerciales por tierra (mejora 1.3): Caballerizas → carretas hacia pueblos cercanos.
// Van antes del mar y son más baratas. Cada viaje vende TODA la carga en el pueblo
// (con precio a la baja si se satura) y vuelve vacío.
// ============================================================================
import { BALANCE } from './balance';
import { recordSale } from './commerce';
import { GOOD_BY_ID } from './data/goods';
import { PORT_BY_ID } from './data/ports';
import { removeStock, stockOf } from './inventory';
import { notify, post } from './ledger';
import { sellPrice } from './market';
import { addPrestige, hasMilestone } from './progression';
import { nextId, rand } from './rng';
import type { ActionResult, CargoOrder, CartClass, GameState, LandTrip, TownDef } from './types';

const fail = (error: string): ActionResult<any> => ({ ok: false, error });

// Pueblos por ciudad de origen (reales y cercanos). size = cuánto absorbe por viaje; buys = apetito por categoría.
export const TOWNS: Record<string, TownDef[]> = {
  tiro: [
    { id: 'ushu', name: 'Ushu', km: 8, size: 10, buys: { alimento: 0.95, artesania: 1.1, ceramica: 1.1 }, bandits: 0.01, specialties: 'Tiro en tierra firme: huertos y aguadas' },
    { id: 'sarepta', name: 'Sarepta', km: 22, size: 14, buys: { textil: 1.15, vidrio: 1.15, metal: 1.1 }, bandits: 0.02, specialties: 'Alfareros y viñedos' },
    { id: 'aczib', name: 'Aczib', km: 40, size: 16, buys: { vidrio: 1.2, joyeria: 1.2, textil: 1.1 }, bandits: 0.03, specialties: 'Puerto del sur' },
    { id: 'cades', name: 'Cades', km: 35, size: 18, buys: { metal: 1.25, textil: 1.2, alimento: 1.1 }, bandits: 0.04, specialties: 'Pueblo del interior, en los montes' },
    { id: 'damasco', name: 'Damasco', km: 190, size: 40, buys: { textil: 1.4, vidrio: 1.35, joyeria: 1.35, lujo: 1.4, especia: 1.3 }, bandits: 0.07, specialties: 'Gran mercado del interior: compra lujo' },
  ],
  sidon: [
    { id: 'sarepta', name: 'Sarepta', km: 15, size: 14, buys: { textil: 1.15, metal: 1.1 }, bandits: 0.02, specialties: 'Alfareros y viñedos' },
    { id: 'beirut', name: 'Berito', km: 40, size: 16, buys: { vidrio: 1.15, joyeria: 1.2 }, bandits: 0.02, specialties: 'Puerto vecino del norte' },
    { id: 'ushu', name: 'Ushu', km: 38, size: 10, buys: { artesania: 1.15, ceramica: 1.1 }, bandits: 0.02, specialties: 'Tiro en tierra firme' },
    { id: 'cades', name: 'Cades', km: 70, size: 18, buys: { metal: 1.25, textil: 1.2 }, bandits: 0.04, specialties: 'Pueblo del interior' },
    { id: 'damasco', name: 'Damasco', km: 110, size: 40, buys: { textil: 1.4, vidrio: 1.35, lujo: 1.4 }, bandits: 0.06, specialties: 'Gran mercado del interior' },
  ],
  biblos: [
    { id: 'batrun', name: 'Batrun', km: 15, size: 10, buys: { alimento: 1.05, artesania: 1.15 }, bandits: 0.01, specialties: 'Aldea de pescadores' },
    { id: 'beirut', name: 'Berito', km: 35, size: 16, buys: { vidrio: 1.15, textil: 1.15 }, bandits: 0.02, specialties: 'Puerto vecino del sur' },
    { id: 'afqa', name: 'Afqa', km: 30, size: 8, buys: { joyeria: 1.3, lujo: 1.25 }, bandits: 0.03, specialties: 'Santuario en los montes' },
    { id: 'arqa', name: 'Arqa', km: 70, size: 16, buys: { metal: 1.2, ceramica: 1.2 }, bandits: 0.04, specialties: 'Ciudad del norte' },
    { id: 'baalbek', name: 'Baalbek', km: 80, size: 30, buys: { textil: 1.35, vidrio: 1.3, especia: 1.3 }, bandits: 0.06, specialties: 'Templo del valle' },
  ],
  cartago: [
    { id: 'tunes', name: 'Tunes', km: 15, size: 14, buys: { alimento: 1.05, artesania: 1.15 }, bandits: 0.02, specialties: 'Aldea a orillas del lago' },
    { id: 'utica', name: 'Útica', km: 35, size: 18, buys: { textil: 1.2, vidrio: 1.15 }, bandits: 0.03, specialties: 'La colonia más antigua' },
    { id: 'kerkouane', name: 'Kerkouane', km: 110, size: 14, buys: { textil: 1.3, joyeria: 1.2 }, bandits: 0.04, specialties: 'Tintoreros del cabo' },
    { id: 'hadrumeto', name: 'Hadrumeto', km: 140, size: 22, buys: { metal: 1.25, ceramica: 1.2 }, bandits: 0.05, specialties: 'Puerto del sur' },
    { id: 'thugga', name: 'Thugga', km: 105, size: 30, buys: { lujo: 1.4, vidrio: 1.35, especia: 1.3 }, bandits: 0.07, specialties: 'Reino númida del interior' },
  ],
  gadir: [
    { id: 'asta', name: 'Asta', km: 25, size: 14, buys: { textil: 1.2, alimento: 1.05 }, bandits: 0.02, specialties: 'Ciudad tartesia' },
    { id: 'carmo', name: 'Carmo', km: 120, size: 18, buys: { textil: 1.3, vidrio: 1.3 }, bandits: 0.05, specialties: 'Fortaleza del interior' },
    { id: 'onuba', name: 'Onuba', km: 110, size: 18, buys: { especia: 1.3, textil: 1.25 }, bandits: 0.04, specialties: 'Puerto de las minas' },
    { id: 'malaka', name: 'Malaka', km: 160, size: 22, buys: { metal: 1.2, joyeria: 1.2 }, bandits: 0.05, specialties: 'Factoría fenicia del este' },
    { id: 'tartessos', name: 'Tartessos', km: 60, size: 35, buys: { lujo: 1.45, vidrio: 1.4, joyeria: 1.3 }, bandits: 0.06, specialties: 'Reino de la plata' },
  ],
};

export const CARTS: Record<CartClass, { name: string; capacity: number; kmPerCycle: number; rentPerCycle: number; driverPerCycle: number; minLevel: 1 | 2 }> = {
  burro: { name: 'Carreta de burro', capacity: 120, kmPerCycle: 12, rentPerCycle: 25, driverPerCycle: 15, minLevel: 1 },
  bueyes: { name: 'Carreta de bueyes', capacity: 300, kmPerCycle: 9, rentPerCycle: 55, driverPerCycle: 20, minLevel: 1 },
  caravana: { name: 'Caravana de camellos', capacity: 700, kmPerCycle: 14, rentPerCycle: 140, driverPerCycle: 45, minLevel: 2 },
};

export const STABLES = {
  rent: 120, price: 6000, upkeep: 50,
  upgradePrice: 18000, upkeep2: 120,
  slots: { 1: 2, 2: 4 } as Record<1 | 2, number>,
  tollPerTrip: 20,
};

export function towns(s: GameState): TownDef[] { return TOWNS[s.cityId] ?? []; }
export function townById(s: GameState, id: string) { return towns(s).find(t => t.id === id); }
export function cartSlots(s: GameState) { return s.stables ? STABLES.slots[s.stables.level] : 0; }

export function legCyclesLand(cart: CartClass, town: TownDef) { return Math.max(1, Math.ceil(town.km / CARTS[cart].kmPerCycle)); }

/** Precio por unidad que paga el pueblo: el de la ciudad × apetito, a la baja si el pueblo ya está saturado. */
export function townUnitPrice(s: GameState, town: TownDef, goodId: string, qty: number): number {
  const g = GOOD_BY_ID[goodId];
  const absorb = Math.max(1, g.retailDemand * town.size);
  const pressure = s.townPressure[town.id]?.[goodId] ?? 0;
  const sat = Math.max(0.6, 1 - 0.2 * (pressure + qty / 2) / absorb);
  return Math.max(1, Math.round(sellPrice(s, goodId) * (town.buys[g.category] ?? 1) * sat));
}

export function tripCosts(cart: CartClass, town: TownDef, maritime = 1) {
  const legs = legCyclesLand(cart, town) * 2, c = CARTS[cart];
  return Math.round((c.rentPerCycle + c.driverPerCycle) * legs * maritime + STABLES.tollPerTrip);
}

/** Estimación para la interfaz: ingresos, costos y ganancia de mandar esta carga. */
export function estimateTrip(s: GameState, cart: CartClass, townId: string, cargo: CargoOrder[]) {
  const t = townById(s, townId)!;
  let revenue = 0, cogs = 0;
  for (const c of cargo) { revenue += c.qty * townUnitPrice(s, t, c.goodId, c.qty); cogs += c.qty * (s.inventory[c.goodId]?.avgCost ?? 0); }
  const costs = tripCosts(cart, t, PORT_BY_ID[s.cityId].costs.maritime);
  return { revenue, cogs, costs, profit: revenue - cogs - costs, cycles: legCyclesLand(cart, t) * 2 };
}

// ---------------------------------------------------------------------------- acciones
export function rentStables(s: GameState): ActionResult {
  if (!hasMilestone(s, 30)) return fail('Requiere el hito 30: Rutas por tierra');
  if (s.stables) return fail('Ya tienes caballerizas');
  s.stables = { owned: false, level: 1, bookValue: 0 };
  notify(s, 'info', 'Alquilaste las caballerizas. Ya puedes mandar carretas a los pueblos.');
  return { ok: true };
}
export function buyStables(s: GameState): ActionResult {
  if (!hasMilestone(s, 30)) return fail('Requiere el hito 30: Rutas por tierra');
  if (s.stables?.owned) return fail('Ya son tuyas');
  if (s.cash < STABLES.price) return fail(`Necesitas ${STABLES.price.toLocaleString('es')} monedas`);
  post(s, 'investment.caballerizas', STABLES.price, 'Caballerizas');
  s.stables = { owned: true, level: s.stables?.level ?? 1, bookValue: STABLES.price };
  return { ok: true };
}
export function upgradeStables(s: GameState): ActionResult {
  if (!s.stables?.owned) return fail('Primero compra las caballerizas');
  if (s.stables.level === 2) return fail('Ya están ampliadas');
  if (s.cash < STABLES.upgradePrice) return fail(`Necesitas ${STABLES.upgradePrice.toLocaleString('es')} monedas`);
  post(s, 'investment.caballerizas', STABLES.upgradePrice, 'Ampliación de caballerizas');
  s.stables.level = 2; s.stables.bookValue += STABLES.upgradePrice;
  return { ok: true };
}

export function sendCart(s: GameState, cart: CartClass, townId: string, cargo: CargoOrder[]): ActionResult<LandTrip> {
  if (!s.stables) return fail('Necesitas unas caballerizas');
  const town = townById(s, townId); if (!town) return fail('Pueblo desconocido');
  const def = CARTS[cart];
  if (def.minLevel > s.stables.level) return fail('Las caravanas requieren caballerizas ampliadas');
  if (s.landTrips.length >= cartSlots(s)) return fail('Todas tus carretas están de viaje');
  cargo = cargo.filter(c => c.qty > 0);
  const units = cargo.reduce((a, c) => a + c.qty, 0);
  if (!units) return fail('La carreta va vacía: elige qué llevar');
  if (units > def.capacity) return fail(`La ${def.name.toLowerCase()} carga ${def.capacity} unidades`);
  for (const c of cargo) if (stockOf(s, c.goodId) < c.qty) return fail(`No tienes ${c.qty} de ${GOOD_BY_ID[c.goodId].name}`);
  const costs = tripCosts(cart, town, PORT_BY_ID[s.cityId].costs.maritime);
  if (s.cash < costs) return fail(`Necesitas ${costs} monedas para el viaje`);
  post(s, 'variable.transporte_tierra', costs, `${def.name} a ${town.name}`);
  const lots = cargo.map(c => ({ goodId: c.goodId, qty: c.qty, avgCost: removeStock(s, c.goodId, c.qty) / c.qty }));
  const leg = legCyclesLand(cart, town);
  const trip: LandTrip = { id: nextId(s, 'tr'), cart, town: town.id, phase: 'ida', cyclesLeft: leg, legCycles: leg, cargo: lots, costs, revenue: 0, cogs: 0, lost: 0 };
  s.landTrips.push(trip);
  return { ok: true, data: trip };
}

/** Avance de los viajes por tierra al cerrar el ciclo. */
export function processLand(s: GameState): void {
  for (const tp of Object.values(s.townPressure)) for (const k in tp) tp[k] *= 0.8;
  for (const t of [...s.landTrips]) {
    if (--t.cyclesLeft > 0) continue;
    const town = townById(s, t.town)!;
    if (t.phase === 'ida') {
      if (rand(s) < town.bandits) {
        const frac = 0.15 + rand(s) * 0.2; let lost = 0;
        for (const c of t.cargo) { const q = Math.floor(c.qty * frac); lost += q * c.avgCost; c.qty -= q; }
        if (lost > 0) { post(s, 'loss.bandidos', lost); t.lost += lost; notify(s, 'alerta', `Bandidos asaltaron tu carreta camino de ${town.name}.`); }
      }
      // Se vende TODO en el pueblo
      for (const c of t.cargo) {
        if (c.qty <= 0) continue;
        const price = townUnitPrice(s, town, c.goodId, c.qty);
        recordSale(s, c.goodId, c.qty, price, 'tierra', false, c.qty * c.avgCost);
        t.revenue += c.qty * price; t.cogs += c.qty * c.avgCost;
        const tp = (s.townPressure[town.id] ??= {}); tp[c.goodId] = (tp[c.goodId] ?? 0) + c.qty;
      }
      t.cargo = [];
      t.phase = 'vuelta'; t.cyclesLeft = t.legCycles;
    } else {
      s.landTrips = s.landTrips.filter(x => x !== t);
      s.stats.landTrips++;
      addPrestige(s, BALANCE.prestige.perVoyage * 0.5 + town.km / 60);
      const profit = t.revenue - t.cogs - t.costs - t.lost;
      notify(s, profit >= 0 ? 'exito' : 'alerta', `Volvió tu ${CARTS[t.cart].name.toLowerCase()} de ${town.name}: lo vendió todo. Resultado: ${profit >= 0 ? '+' : ''}${Math.round(profit).toLocaleString('es')}.`);
    }
  }
}
