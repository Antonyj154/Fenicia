// Inventario agrupado: el stock de puestos, locales y almacenes se gestiona como un único
// fondo cuya capacidad es la suma de todos ellos (simplificación de diseño de la Fase 1).
import { BALANCE } from './balance';
import { VENUES, WAREHOUSES } from './data/catalog';
import { buyPrice } from './market';
import type { GameState } from './types';

const VENUE = Object.fromEntries(VENUES.map(v => [v.id, v]));
const WH = Object.fromEntries(WAREHOUSES.map(w => [w.id, w]));

export function storageCapacity(s: GameState): number {
  let c = BALANCE.baseStorage;
  for (const v of s.venues) c += VENUE[v.defId].storage;
  for (const w of s.warehouses) c += WH[w.defId].capacity;
  return c;
}

export function inventoryUnits(s: GameState): number {
  let n = 0;
  for (const id in s.inventory) n += s.inventory[id].qty;
  return n;
}

export function freeStorage(s: GameState): number {
  return Math.max(0, storageCapacity(s) - inventoryUnits(s));
}

export function stockOf(s: GameState, goodId: string): number {
  return s.inventory[goodId]?.qty ?? 0;
}

/** Añade stock recalculando el costo medio ponderado. */
export function addStock(s: GameState, goodId: string, qty: number, unitCost: number): void {
  if (qty <= 0) return;
  const lot = s.inventory[goodId] ?? (s.inventory[goodId] = { qty: 0, avgCost: 0 });
  lot.avgCost = (lot.avgCost * lot.qty + unitCost * qty) / (lot.qty + qty);
  lot.qty += qty;
}

/** Retira stock y devuelve su costo (para COGS o para cargar en un barco). */
export function removeStock(s: GameState, goodId: string, qty: number): number {
  const lot = s.inventory[goodId];
  if (!lot || lot.qty < qty) throw new Error(`Stock insuficiente de ${goodId}`);
  const cost = lot.avgCost * qty;
  lot.qty -= qty;
  if (lot.qty === 0) delete s.inventory[goodId];
  return cost;
}

/** Valor del inventario a precio de reposición en el mercado local (GDD §21). */
export function inventoryValue(s: GameState): number {
  let v = 0;
  for (const id in s.inventory) v += s.inventory[id].qty * buyPrice(s, id);
  return v;
}

/** Costo histórico del inventario (para análisis). */
export function inventoryCost(s: GameState): number {
  let v = 0;
  for (const id in s.inventory) v += s.inventory[id].qty * s.inventory[id].avgCost;
  return v;
}
