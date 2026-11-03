// Creación de partidas (GDD §2, §18.1). Cada partida es independiente.
import { BALANCE } from './balance';
import { PORT_BY_ID, PORTS, seaDistanceKm } from './data/ports';
import { emptyReport } from './ledger';
import { initMarkets } from './market';
import type { GameState, PortId } from './types';

export const SAVE_VERSION = 3;

export function createGame(cityId: PortId = 'tiro', seed = Date.now() % 2147483647, playerName = 'Mercader'): GameState {
  const city = PORT_BY_ID[cityId];
  if (!city?.playable) throw new Error(`Ciudad no jugable: ${cityId}`);
  const s: GameState = {
    version: SAVE_VERSION, id: `${cityId}-${seed}`, seed, rng: seed | 0, cityId, playerName, createdAt: Date.now(),
    time: { speed: 1, simSeconds: 0, cycle: 0, cycleElapsed: 0 },
    cash: BALANCE.startingCash, arrears: 0,
    inventory: {}, goodSettings: {}, markets: {},
    manualCapacityLeft: BALANCE.manualCustomersPerCycle,
    workers: [], workerAccum: { vendedor: 0, almacenero: 0 },
    venues: [], warehouses: [],
    ships: [], captains: [], voyages: [], knownRoutes: [], autoRoutes: [], expeditions: [], hasShipyard: false,
    loans: [], contracts: [], supplierOffers: [], events: [],
    xp: 0, level: 1, prestige: 0, milestones: [1],
    stats: {
      lifetimeRevenue: 0, lifetimeUnitsSold: 0, lifetimeProfit: 0, manualSalesRevenue: 0, voyagesCompleted: 0,
      contractsFulfilled: 0, contractsFailed: 0, negotiationsWon: 0, expeditionsLaunched: 0, expeditionsSucceeded: 0,
      routesDiscovered: 0, unitsSoldRewardIndex: 0, loansRepaid: 0, peakNetWorth: BALANCE.startingCash, cyclesInArrears: 0, arrearsStreak: 0, bankrupt: false, landTrips: 0,
    },
    current: emptyReport(0, BALANCE.startingCash),
    history: [], ledger: [], notifications: [], idCounter: 0,
    stables: null, landTrips: [], townPressure: {}, goodStats: {}, exclusives: [], seenIntros: [],
    sellQueue: [], sellAcc: 0, shipyardRented: false, workshops: [], monopolies: [], treasury: 0,
  };
  initMarkets(s, PORTS.map(p => p.id));
  // La ruta costera más cercana se conoce desde el inicio
  const nearest = PORTS.filter(p => p.id !== cityId).sort((a, b) => seaDistanceKm(cityId, a.id) - seaDistanceKm(cityId, b.id))[0];
  s.knownRoutes.push(nearest.id);
  s.notifications.push({ cycle: 0, kind: 'info', text: `Llegas a ${city.name} con ${BALANCE.startingCash} monedas y una cesta vacía. Tú mismo compras y vendes: compra barato en el mercado y véndelo a los clientes.` });
  return s;
}

/** Completa partidas guardadas con versiones anteriores del motor. */
export function migrate(s: GameState): GameState {
  s.stables ??= null; s.landTrips ??= []; s.townPressure ??= {}; s.goodStats ??= {}; s.exclusives ??= []; s.seenIntros ??= [];
  s.stats.landTrips ??= 0;
  if ((s.version ?? 1) < 3) {
    // v3: los almaceneros reponen solos (objetivo automático) y desaparece el coordinador
    for (const g of Object.values(s.goodSettings ?? {})) if (!g.restockTarget) g.restockTarget = -1;
    s.workers = s.workers.filter(w => (w.role as string) !== 'coordinador');
    delete (s.workerAccum as any).coordinador;
  }
  s.sellQueue ??= []; s.sellAcc ??= 0; s.shipyardRented ??= false; s.workshops ??= []; s.monopolies ??= []; s.treasury ??= 0;
  s.version = SAVE_VERSION;
  return s;
}
