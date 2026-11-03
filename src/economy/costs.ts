// ============================================================================
// Costos fijos recurrentes (GDD §8.2). Una sola función calcula el desglose y se usa
// tanto para cobrar al cierre del ciclo como para mostrar proyecciones → sin duplicados.
// ============================================================================
import { MONOPOLY_FEE } from './data/invest';
import { BALANCE } from './balance';
import { ROLES, SHIPS, VENUES, WAREHOUSES } from './data/catalog';
import { PORT_BY_ID, seaDistanceKm } from './data/ports';
import { eventScalar } from './market';
import type { GameState, VenueDef, WarehouseDef, WorkerRole } from './types';

export const VENUE_BY_ID: Record<string, VenueDef> = Object.fromEntries(VENUES.map(v => [v.id, v]));
export const WAREHOUSE_BY_ID: Record<string, WarehouseDef> = Object.fromEntries(WAREHOUSES.map(w => [w.id, w]));

const city = (s: GameState) => PORT_BY_ID[s.cityId];

export function salaryFor(s: GameState, role: WorkerRole): number {
  return Math.round(ROLES[role].salary * city(s).costs.wages);
}
export function venueRent(s: GameState, d: VenueDef): number {
  return Math.round(d.rent * city(s).costs.rent * eventScalar(s, 'fixedCostMult'));
}
export function venueUpkeep(s: GameState, d: VenueDef): number {
  return Math.round(d.upkeep * city(s).costs.property * eventScalar(s, 'fixedCostMult'));
}
export function warehouseRent(s: GameState, d: WarehouseDef): number {
  return Math.round(d.rent * city(s).costs.rent * eventScalar(s, 'fixedCostMult'));
}
export function warehouseUpkeep(s: GameState, d: WarehouseDef): number {
  return Math.round(d.upkeep * city(s).costs.property * eventScalar(s, 'fixedCostMult'));
}
export function routeUpkeep(s: GameState, to: string): number {
  return Math.round((BALANCE.routeUpkeepBase + BALANCE.routeUpkeepPerKm * seaDistanceKm(s.cityId, to)) * city(s).costs.maritime);
}
export function rentalPerCycle(s: GameState): number {
  return Math.round(SHIPS.galera_alquiler.rentPerCycle * BALANCE.rentalPerCycleDiscount * city(s).costs.maritime);
}

/** Desglose de costos fijos del ciclo, por subcuenta del libro contable. */
export function fixedCostBreakdown(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (k: string, v: number) => { if (v > 0) out[k] = (out[k] ?? 0) + v; };

  for (const w of s.workers) add('fixed.salarios', w.salary);
  for (const v of s.venues) {
    const d = VENUE_BY_ID[v.defId];
    v.owned ? add('fixed.mantenimiento_propiedades', venueUpkeep(s, d)) : add('fixed.alquiler_locales', venueRent(s, d));
  }
  for (const w of s.warehouses) {
    const d = WAREHOUSE_BY_ID[w.defId];
    w.owned ? add('fixed.mantenimiento_propiedades', warehouseUpkeep(s, d)) : add('fixed.alquiler_almacenes', warehouseRent(s, d));
  }
  const fcm = eventScalar(s, 'fixedCostMult');
  for (const sh of s.ships) {
    const d = SHIPS[sh.cls];
    if (sh.owned) {
      if (sh.underConstruction > 0) continue;
      add('fixed.mantenimiento_barcos', Math.round(d.upkeep * city(s).costs.maritime));
      add('fixed.amarre', Math.round(d.mooring * city(s).costs.maritime * fcm));
    } else if (sh.rental === 'por_ciclo') {
      add('fixed.alquiler_barcos', rentalPerCycle(s));
    }
  }
  for (const c of s.captains) add('fixed.capitanes', c.salary);
  if (!s.hasShipyard && s.shipyardRented) add('fixed.astillero', Math.round(BALANCE.shipyardRent * city(s).costs.rent * fcm));
  for (const _ of s.monopolies ?? []) add('fixed.monopolios', MONOPOLY_FEE);
  if (s.hasShipyard) add('fixed.astillero', Math.round((BALANCE.shipyardStaff * city(s).costs.wages) + BALANCE.shipyardUpkeep * city(s).costs.property * fcm));
  for (const r of s.autoRoutes) if (r.active) add('fixed.rutas', routeUpkeep(s, r.to));
  if (s.stables) add(s.stables.owned ? 'fixed.mantenimiento_propiedades' : 'fixed.alquiler_locales', Math.round((s.stables.owned ? (s.stables.level === 2 ? 120 : 50) : 120) * city(s).costs.rent * eventScalar(s, 'fixedCostMult')));
  return out;
}

export function fixedCostTotal(s: GameState): number {
  return Object.values(fixedCostBreakdown(s)).reduce((a, b) => a + b, 0);
}

/** Cuota total de préstamos del próximo ciclo. */
export function loanInstallmentsTotal(s: GameState): number {
  return s.loans.reduce((a, l) => a + l.installment, 0);
}

/** Reserva de caja recomendada: costos fijos + cuotas de 2 ciclos (GDD §8.3). */
export function recommendedReserve(s: GameState): number {
  return 2 * (fixedCostTotal(s) + loanInstallmentsTotal(s));
}

/** Caja que las compras automáticas (reposición, carga de retorno) no tocan. */
export function automationReserve(s: GameState): number {
  return BALANCE.restockReserveCycles * (fixedCostTotal(s) + loanInstallmentsTotal(s));
}
