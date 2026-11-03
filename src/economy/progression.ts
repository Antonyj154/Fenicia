// ============================================================================
// Patrimonio (GDD §21), niveles (§5), prestigio (§19) e hitos (§20).
// Nivel y prestigio son sistemas independientes.
// ============================================================================
import { WORKSHOPS } from './data/invest';
import { BALANCE } from './balance';
import { LEVELS, MILESTONE_ORDER, MILESTONES, PRESTIGE_RANKS } from './data/catalog';
import { GOOD_BY_ID, GOODS } from './data/goods';
import { inventoryValue } from './inventory';
import { notify } from './ledger';
import { demandPerCycle } from './market';
import type { GameState } from './types';

// ---------------------------------------------------------------------------
// Patrimonio
// ---------------------------------------------------------------------------
export interface BalanceSheet {
  cash: number;
  venues: number;
  warehouses: number;
  ships: number;
  shipyard: number;
  inventory: number;
  cargo: number;
  assets: number;
  loans: number;
  arrears: number;
  liabilities: number;
  netWorth: number;
}

const workshopsValue = (s: GameState) => WORKSHOPS.filter(w => s.workshops?.includes(w.id)).reduce((a, w) => a + w.price, 0);

export function balanceSheet(s: GameState): BalanceSheet {
  const venues = s.venues.reduce((a, v) => a + (v.owned ? v.bookValue : 0), 0);
  const warehouses = s.warehouses.reduce((a, w) => a + (w.owned ? w.bookValue : 0), 0);
  const ships = s.ships.reduce((a, sh) => a + (sh.owned ? sh.bookValue : 0), 0);
  const shipyard = (s.hasShipyard ? BALANCE.shipyardPrice : 0) + (s.stables?.owned ? s.stables.bookValue : 0) + workshopsValue(s) + (s.treasury ?? 0);
  const inventory = inventoryValue(s);
  const cargo = s.voyages.reduce((a, v) => a + v.cargo.reduce((b, c) => b + c.qty * c.avgCost, 0), 0);
  const assets = venues + warehouses + ships + shipyard + inventory + cargo;
  const loans = s.loans.reduce((a, l) => a + l.remainingPrincipal, 0);
  const liabilities = loans + s.arrears;
  return {
    cash: s.cash, venues, warehouses, ships, shipyard, inventory, cargo, assets,
    loans, arrears: s.arrears, liabilities,
    netWorth: Math.round(s.cash + assets - liabilities),
  };
}

export function netWorth(s: GameState): number {
  return balanceSheet(s).netWorth;
}

// ---------------------------------------------------------------------------
// Prestigio
// ---------------------------------------------------------------------------
export function prestigeRank(s: GameState): number {
  let r = 1;
  for (const pr of PRESTIGE_RANKS) if (s.prestige >= pr.points) r = pr.rank;
  return r;
}
export function prestigeRankName(rank: number): string {
  return PRESTIGE_RANKS[rank - 1]?.name ?? '';
}
export function addPrestige(s: GameState, pts: number, reason?: string): void {
  const before = prestigeRank(s);
  s.prestige = Math.max(0, s.prestige + pts);
  const after = prestigeRank(s);
  if (after > before) notify(s, 'nivel', `Prestigio: ahora eres ${prestigeRankName(after)}.`);
  if (reason && Math.abs(pts) >= 20) notify(s, pts > 0 ? 'exito' : 'alerta', `${pts > 0 ? '+' : ''}${Math.round(pts)} prestigio: ${reason}`);
}

// ---------------------------------------------------------------------------
// Experiencia y niveles
// ---------------------------------------------------------------------------
export function addXp(s: GameState, xp: number): void {
  if (xp > 0) s.xp += xp;
}

export function levelDef(level: number) { return LEVELS[Math.min(LEVELS.length, level) - 1]; }

/** Progreso hacia el siguiente nivel: { xp, netWorth, rank } cada uno de 0 a 1. */
export function levelProgress(s: GameState) {
  const next = LEVELS[s.level];
  if (!next) return null;
  const prev = levelDef(s.level);
  const nw = netWorth(s);
  return {
    next,
    xp: Math.min(1, (s.xp - prev.xp) / Math.max(1, next.xp - prev.xp)),
    netWorthOk: nw >= next.netWorth,
    rankOk: prestigeRank(s) >= next.prestigeRank,
  };
}

export function checkLevel(s: GameState): void {
  let nw: number | null = null;
  while (s.level < LEVELS.length) {
    const next = LEVELS[s.level];
    nw ??= netWorth(s);
    if (s.xp >= next.xp && nw >= next.netWorth && prestigeRank(s) >= next.prestigeRank) {
      s.level = next.level;
      const newGoods = GOODS.filter(g => g.unlockLevel === next.level).map(g => g.name);
      notify(s, 'nivel', `¡Nivel ${next.level}! ${next.category}.${newGoods.length ? ' Nuevas mercancías: ' + newGoods.join(', ') + '.' : ''}`);
    } else break;
  }
}

// ---------------------------------------------------------------------------
// Mercancías disponibles
// ---------------------------------------------------------------------------
export function goodUnlocked(s: GameState, goodId: string): boolean {
  const g = GOOD_BY_ID[goodId];
  return s.level >= g.unlockLevel && prestigeRank(s) >= g.minPrestigeRank;
}
export function unlockedGoods(s: GameState) {
  return GOODS.filter(g => goodUnlocked(s, g.id));
}
/** Motivo por el que una mercancía no está disponible (o null). */
export function goodLockReason(s: GameState, goodId: string): string | null {
  const g = GOOD_BY_ID[goodId];
  if (s.level < g.unlockLevel) return `Requiere nivel ${g.unlockLevel}`;
  if (prestigeRank(s) < g.minPrestigeRank) return `Requiere prestigio: ${prestigeRankName(g.minPrestigeRank)}`;
  return null;
}

// ---------------------------------------------------------------------------
// Hitos
// ---------------------------------------------------------------------------
export function hasMilestone(s: GameState, id: number): boolean {
  return s.milestones.includes(id);
}

function milestoneMet(s: GameState, id: number, nw: number): boolean {
  switch (id) {
    case 1: return true;
    case 2: return s.stats.lifetimeRevenue >= 100;
    case 3: return nw >= 250;
    case 4: return s.workers.length > 0;
    case 5: return nw >= 500;
    case 6: return s.venues.length > 0;
    case 7: return nw >= 1000;
    case 8: return nw >= 2000;
    case 9: return s.warehouses.length > 0;
    case 10: return nw >= 5000;
    case 11: return nw >= 8000;
    case 12: return s.stats.negotiationsWon > 0;
    case 13: return nw >= 15000;
    case 14: return nw >= 25000;
    case 15: return nw >= 50000 && hasMilestone(s, 30) && s.stats.landTrips >= 3 && s.venues.some(v => v.defId.startsWith('local') || v.defId === 'casa_comercio' || v.defId === 'gran_bazar');
    case 16: return s.ships.length > 0;
    case 17: return nw >= 75000;
    case 18: return s.stats.expeditionsLaunched > 0;
    case 19: return s.stats.routesDiscovered > 0;
    case 20: return nw >= 150000;
    case 21: return s.ships.length >= 2;
    case 22: return nw >= 250000;
    case 23: return nw >= 500000;
    case 24: return nw >= 1500000;
    case 25: return s.hasShipyard;
    case 26: return s.autoRoutes.length >= 3;
    case 27: return nw >= 3000000;
    case 28: return s.exclusives.filter(e => e.active).length >= 2 && Object.entries(s.goodStats ?? {}).some(([id, g]) => g.prevCycleUnits >= demandPerCycle(s, id) * 0.5 && g.prevCycleUnits >= 20);
    case 29: return nw >= 10000000;
    case 30: return nw >= 20000 && s.venues.some(v => v.defId.startsWith('local') || v.defId === 'casa_comercio' || v.defId === 'gran_bazar');
    case 31: return Object.values(s.goodStats ?? {}).some(g => g.units >= BALANCE.exclusiveUnits);
    default: return false;
  }
}

export function checkMilestones(s: GameState): void {
  const nw = netWorth(s);
  for (const id of MILESTONE_ORDER) {
    const m = MILESTONES.find(x => x.id === id)!;
    if (hasMilestone(s, m.id)) continue;
    if (milestoneMet(s, m.id, nw)) {
      s.milestones.push(m.id);
      addXp(s, BALANCE.xpPerMilestone(Math.min(m.id, 29)));
      notify(s, 'hito', `Hito ${m.id}: ${m.name}. ${m.pending ? '(Funcionalidad en diseño)' : 'Desbloquea: ' + m.unlocks + '.'}`);
    }
  }
}
