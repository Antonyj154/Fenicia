// ============================================================================
// Automatización progresiva dentro del ciclo (GDD §3.2, §9):
// ventas de vendedores y reposición de almaceneros.
// Regla: sin inventario o sin demanda no hay ingresos (GDD §23.1).
// ============================================================================
import { ROLES } from './data/catalog';
import { GOODS } from './data/goods';
import { salesCapacity } from './business';
import { recordSale, settingsOf } from './commerce';
import { automationReserve } from './costs';
import { addStock, freeStorage, stockOf } from './inventory';
import { post } from './ledger';
import { availableDemand, availableSupply, buyPrice, consumeDemand, consumeSupply, demandPerCycle, sellPrice } from './market';
import { goodUnlocked, hasMilestone } from './progression';
import type { GameState, WorkerRole } from './types';

function capacityOf(s: GameState, role: WorkerRole): number {
  if (role === 'vendedor') return salesCapacity(s);
  return s.workers.filter(w => w.role === role).length * ROLES[role].capacity;
}

/** Acumula capacidad fraccionaria y devuelve las unidades enteras disponibles. */
function takeCapacity(s: GameState, role: WorkerRole, frac: number): number {
  const perCycle = capacityOf(s, role);
  if (perCycle <= 0) { s.workerAccum[role] = 0; return 0; }
  // Tope: la capacidad no utilizada no se acumula más allá de ~2 segundos de trabajo
  s.workerAccum[role] = Math.min(s.workerAccum[role] + perCycle * frac, Math.max(1, perCycle * frac * 2));
  return Math.floor(s.workerAccum[role] + 1e-9);
}

export function runAutomation(s: GameState, frac: number): void {
  autoSell(s, frac);
  if (hasMilestone(s, 9)) autoRestock(s, frac);
}

function autoSell(s: GameState, frac: number): void {
  let cap = takeCapacity(s, 'vendedor', frac);
  if (cap <= 0) return;
  // Prioriza el mayor margen unitario: cada atención de cliente rinde lo máximo posible
  const candidates = Object.keys(s.inventory)
    .filter(id => settingsOf(s, id).autoSell)
    .map(id => ({ id, price: sellPrice(s, id), margin: sellPrice(s, id) - s.inventory[id].avgCost }))
    .filter(c => c.price >= settingsOf(s, c.id).minSellPrice)
    .sort((a, b) => b.margin - a.margin);
  for (const c of candidates) {
    if (cap <= 0) break;
    const n = Math.min(cap, stockOf(s, c.id), availableDemand(s, c.id));
    if (n <= 0) continue;
    recordSale(s, c.id, n, c.price, 'auto');
    consumeDemand(s, s.cityId, c.id, n);
    cap -= n;
    s.workerAccum.vendedor -= n;
  }
}

/**
 * Objetivo de reposición de una mercancía. -1 = automático: lo que se vendió en el último ciclo ×1,5
 * (al menos media demanda de la ciudad), sólo si deja margen y ya la has vendido alguna vez.
 * 0 = no reponer; > 0 = cantidad fija elegida por el jugador.
 */
export function restockTargetOf(s: GameState, goodId: string): number {
  const set = settingsOf(s, goodId);
  if (set.restockTarget >= 0) return set.restockTarget;
  const st = s.goodStats[goodId];
  if (!st || st.units <= 0) return 0;
  if (sellPrice(s, goodId) <= buyPrice(s, goodId)) return 0;
  const sold = Math.max(st.prevCycleUnits, st.cycleUnits);
  return Math.ceil(Math.max(sold * 1.5, demandPerCycle(s, goodId) * 0.5, 10));
}

function autoRestock(s: GameState, frac: number): void {
  let cap = takeCapacity(s, 'almacenero', frac);
  if (cap <= 0) return;
  const reserve = automationReserve(s);
  // Primero lo que más se vende
  const goods = GOODS.filter(g => goodUnlocked(s, g.id)).sort((a, b) => (s.goodStats[b.id]?.prevCycleUnits ?? 0) - (s.goodStats[a.id]?.prevCycleUnits ?? 0));
  for (const g of goods) {
    if (cap <= 0) break;
    const target = restockTargetOf(s, g.id);
    if (target <= 0) continue;
    const set = settingsOf(s, g.id);
    const price = buyPrice(s, g.id);
    if (set.restockMaxPrice > 0 && price > set.restockMaxPrice) continue;
    const affordable = Math.floor(Math.max(0, s.cash - reserve) / price);
    const n = Math.min(cap, target - stockOf(s, g.id), availableSupply(s, g.id), freeStorage(s), affordable);
    if (n <= 0) continue;
    post(s, 'inventory.reposicion', n * price, `${n} × ${g.name}`);
    addStock(s, g.id, n, price);
    consumeSupply(s, s.cityId, g.id, n);
    cap -= n;
    s.workerAccum.almacenero -= n;
  }
}
