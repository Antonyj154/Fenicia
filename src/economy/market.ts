// ============================================================================
// Mercado dinámico (GDD §6, §13, §17): precios, demanda, oferta y fluctuaciones.
// ============================================================================
import { monopolySellMult, workshopBuyMult } from './data/invest';
import { BALANCE } from './balance';
import { GOODS, GOOD_BY_ID } from './data/goods';
import { PORT_BY_ID } from './data/ports';
import { gauss } from './rng';
import type { EventEffects, GameState, GoodDef, MarketGood, PortId } from './types';

type ModKey = 'priceMods' | 'demandMods' | 'supplyMods';

/** Producto de los modificadores de eventos activos (por mercancía, categoría o "all"). */
export function eventMod(s: GameState, key: ModKey, good: GoodDef): number {
  let m = 1;
  for (const e of s.events) {
    const mods = e.effects[key];
    if (!mods) continue;
    m *= mods[good.id] ?? mods[good.category] ?? mods.all ?? 1;
  }
  return m;
}

export function eventScalar(s: GameState, key: keyof Pick<EventEffects, 'wholesaleMult' | 'piracyMult' | 'fixedCostMult' | 'portFeeMult'>): number {
  let m = 1;
  for (const e of s.events) m *= e.effects[key] ?? 1;
  return m;
}

export function isPortBlocked(s: GameState, port: PortId): boolean {
  return s.events.some(e => e.effects.blockedPort === port);
}

function mg(s: GameState, port: PortId, goodId: string): MarketGood {
  return s.markets[port][goodId];
}

const isHome = (s: GameState, port: PortId) => port === s.cityId;

function priceBase(s: GameState, port: PortId, g: GoodDef): number {
  const p = PORT_BY_ID[port];
  const ev = isHome(s, port) ? eventMod(s, 'priceMods', g) : 1;
  return (p.priceMods[g.category] ?? 1) * mg(s, port, g.id).factor * ev;
}

/** Precio al que el jugador compra en el mercado de un puerto. */
export function buyPrice(s: GameState, goodId: string, port: PortId = s.cityId): number {
  const g = GOOD_BY_ID[goodId];
  const own = port === s.cityId ? workshopBuyMult(s, g.category) : 1;
  return Math.max(1, Math.round(g.buy * priceBase(s, port, g) * own));
}

/** Precio al que los clientes minoristas compran al jugador. */
export function sellPrice(s: GameState, goodId: string, port: PortId = s.cityId): number {
  const g = GOOD_BY_ID[goodId];
  const mono = port === s.cityId ? monopolySellMult(s, goodId) : 1;
  return Math.max(buyPrice(s, goodId, port) + 1, Math.round(g.sell * priceBase(s, port, g) * mono));
}

/** Precio de venta a otros comerciantes (distribución, GDD §13). */
export function wholesalePrice(s: GameState, goodId: string): number {
  const b = buyPrice(s, goodId);
  return Math.max(b, Math.round(b * BALANCE.wholesaleMarkup));
}

/** Precio que pagan los comerciantes de un puerto extranjero por una carga importada. */
export function portSalePrice(s: GameState, goodId: string, port: PortId): number {
  return Math.max(1, Math.round(sellPrice(s, goodId, port) * BALANCE.foreignSaleDiscount));
}

// ---------------------------------------------------------------------------
// Capacidades por ciclo
// ---------------------------------------------------------------------------
export function demandPerCycle(s: GameState, goodId: string, port: PortId = s.cityId): number {
  const g = GOOD_BY_ID[goodId], p = PORT_BY_ID[port];
  const base = g.retailDemand * (p.demandMods[g.category] ?? 1) * (1 - p.competition);
  return isHome(s, port) ? base * eventMod(s, 'demandMods', g) : base * BALANCE.foreignImportPerDemand;
}
export function demandPoolCap(s: GameState, goodId: string, port: PortId = s.cityId): number {
  return demandPerCycle(s, goodId, port) * (isHome(s, port) ? 1 : BALANCE.foreignPoolCycles);
}
export function supplyPerCycle(s: GameState, goodId: string, port: PortId = s.cityId): number {
  const g = GOOD_BY_ID[goodId], p = PORT_BY_ID[port];
  const base = g.retailDemand * (p.supplyMods[g.category] ?? 1);
  return isHome(s, port) ? base * BALANCE.supplyPerDemand * eventMod(s, 'supplyMods', g) : base * BALANCE.foreignExportPerDemand;
}
export function supplyPoolCap(s: GameState, goodId: string, port: PortId = s.cityId): number {
  return supplyPerCycle(s, goodId, port) * (isHome(s, port) ? 1 : BALANCE.foreignPoolCycles);
}
export function wholesalePerCycle(s: GameState, goodId: string): number {
  const g = GOOD_BY_ID[goodId], p = PORT_BY_ID[s.cityId];
  return g.retailDemand * BALANCE.wholesalePerDemand * (p.demandMods[g.category] ?? 1) * eventScalar(s, 'wholesaleMult');
}

// ---------------------------------------------------------------------------
// Estado inicial y evolución
// ---------------------------------------------------------------------------
export function initMarkets(s: GameState, portIds: PortId[]): void {
  for (const port of portIds) {
    s.markets[port] = {};
    for (const g of GOODS) {
      s.markets[port][g.id] = { factor: 1, demand: 0, wholesale: 0, supply: 0, pressure: 0 };
    }
    for (const g of GOODS) {
      const m = s.markets[port][g.id];
      m.demand = demandPoolCap(s, g.id, port);
      m.supply = supplyPoolCap(s, g.id, port);
      m.wholesale = port === s.cityId ? wholesalePerCycle(s, g.id) : 0;
    }
  }
}

/** Regeneración progresiva de pools durante el ciclo. frac = fracción de ciclo transcurrida. */
export function regenerate(s: GameState, frac: number): void {
  for (const port in s.markets) {
    const home = port === s.cityId;
    for (const g of GOODS) {
      const m = s.markets[port][g.id];
      m.demand = Math.min(demandPoolCap(s, g.id, port), m.demand + demandPerCycle(s, g.id, port) * frac);
      m.supply = Math.min(supplyPoolCap(s, g.id, port), m.supply + supplyPerCycle(s, g.id, port) * frac);
      if (home) m.wholesale = Math.min(wholesalePerCycle(s, g.id), m.wholesale + wholesalePerCycle(s, g.id) * frac);
    }
  }
}

/** Fluctuación de precios al cerrar el ciclo: reversión a la media + ruido + presión del jugador. */
export function fluctuate(s: GameState): void {
  const { priceMeanReversion: k, priceVolatility: vol, priceFactorMin, priceFactorMax, pressureImpact } = BALANCE;
  for (const port in s.markets) {
    for (const g of GOODS) {
      const m = s.markets[port][g.id];
      let f = 1 + (m.factor - 1) * k + gauss(s) * vol + m.pressure * pressureImpact;
      m.factor = Math.min(priceFactorMax, Math.max(priceFactorMin, f));
      m.pressure *= 0.3;
    }
  }
}

/** Consume demanda (venta del jugador) y registra presión bajista. */
export function consumeDemand(s: GameState, port: PortId, goodId: string, qty: number, pool: 'demand' | 'wholesale' = 'demand'): void {
  const m = mg(s, port, goodId);
  m[pool] = Math.max(0, m[pool] - qty);
  const cap = pool === 'demand' ? demandPerCycle(s, goodId, port) : wholesalePerCycle(s, goodId);
  if (cap > 0) m.pressure -= (qty / cap) * (pool === 'wholesale' ? 0.5 : 1);
}

/** Consume oferta (compra del jugador) y registra presión alcista. */
export function consumeSupply(s: GameState, port: PortId, goodId: string, qty: number): void {
  const m = mg(s, port, goodId);
  m.supply = Math.max(0, m.supply - qty);
  const cap = supplyPerCycle(s, goodId, port);
  if (cap > 0) m.pressure += qty / cap;
}

export function availableDemand(s: GameState, goodId: string, port: PortId = s.cityId): number {
  return Math.floor(mg(s, port, goodId).demand + 1e-6);
}
export function availableSupply(s: GameState, goodId: string, port: PortId = s.cityId): number {
  return Math.floor(mg(s, port, goodId).supply + 1e-6);
}
export function availableWholesale(s: GameState, goodId: string): number {
  return Math.floor(mg(s, s.cityId, goodId).wholesale + 1e-6);
}
