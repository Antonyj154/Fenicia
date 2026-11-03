// ============================================================================
// Bucle de simulación (GDD §3). Procesos continuos dentro del ciclo + cierre contable.
// ============================================================================
import { runAutomation } from './automation';
import { BALANCE } from './balance';
import { generateContracts, processExclusives, processSellQueue, refreshSupplierOffers } from './commerce';
import { processLand } from './land';
import { processInvestments } from './invest';
import { fixedCostBreakdown } from './costs';
import { processEvents } from './eventsEngine';
import { arrearsConsequences, processLoans, settleArrears } from './finance';
import { emptyReport, finalizeReport, post } from './ledger';
import { fluctuate, regenerate } from './market';
import { processMaritime } from './maritime';
import { addPrestige, checkLevel, checkMilestones, netWorth } from './progression';
import type { CycleReport, GameState, Speed } from './types';

export function setSpeed(s: GameState, speed: Speed): void {
  s.time.speed = speed;
}

/**
 * Avanza la simulación `realSeconds` segundos reales a la velocidad actual.
 * Pausa (×0) detiene todos los procesos dependientes del tiempo (GDD §4.3).
 * Devuelve los informes de los ciclos cerrados durante el avance.
 */
export function advance(s: GameState, realSeconds: number): CycleReport[] {
  const closed: CycleReport[] = [];
  let sim = realSeconds * s.time.speed;
  while (sim > 1e-9) {
    const toClose = BALANCE.cycleSeconds - s.time.cycleElapsed;
    const dt = Math.min(sim, BALANCE.maxStepSeconds, toClose);
    step(s, dt);
    sim -= dt;
    if (s.time.cycleElapsed >= BALANCE.cycleSeconds - 1e-9) closed.push(closeCycle(s));
  }
  return closed;
}

/** Avanza n ciclos completos ignorando la velocidad (pruebas, simulador de balance). */
export function advanceCycles(s: GameState, n: number): CycleReport[] {
  const out: CycleReport[] = [];
  for (let i = 0; i < n; i++) {
    while (s.time.cycleElapsed < BALANCE.cycleSeconds - 1e-9) step(s, Math.min(BALANCE.maxStepSeconds, BALANCE.cycleSeconds - s.time.cycleElapsed));
    out.push(closeCycle(s));
  }
  return out;
}

function step(s: GameState, dt: number): void {
  const frac = dt / BALANCE.cycleSeconds;
  regenerate(s, frac);
  s.manualCapacityLeft = Math.min(BALANCE.manualCustomersPerCycle, s.manualCapacityLeft + BALANCE.manualCustomersPerCycle * frac);
  processSellQueue(s, dt);
  runAutomation(s, frac);
  s.time.simSeconds += dt;
  s.time.cycleElapsed += dt;
}

/** Cierre contable del ciclo: consolida costos fijos, cuotas, viajes, mercado y progresión. */
export function closeCycle(s: GameState): CycleReport {
  settleArrears(s);
  for (const [key, amount] of Object.entries(fixedCostBreakdown(s))) post(s, key, amount, undefined, true);
  processLoans(s);
  arrearsConsequences(s);
  processMaritime(s);
  processLand(s);
  processExclusives(s);
  processInvestments(s);
  for (const g of Object.values(s.goodStats)) { g.prevCycleUnits = g.cycleUnits; g.cycleUnits = 0; }
  generateContracts(s);
  refreshSupplierOffers(s);
  processEvents(s);
  fluctuate(s);

  // Prestigio recurrente
  const owned = s.venues.filter(v => v.owned).length + s.warehouses.filter(w => w.owned).length + s.ships.filter(x => x.owned).length + (s.hasShipyard ? 1 : 0);
  const routes = s.autoRoutes.filter(r => r.active).length;
  if (s.arrears <= 0) addPrestige(s, owned * BALANCE.prestige.perOwnedPropertyCycle + routes * BALANCE.prestige.perActiveRouteCycle);

  const r = s.current;
  finalizeReport(r);
  r.cashEnd = s.cash;
  r.netWorth = netWorth(s);
  s.stats.lifetimeProfit += r.netProfit;
  s.stats.peakNetWorth = Math.max(s.stats.peakNetWorth, r.netWorth);
  s.history.push(r);
  if (s.history.length > BALANCE.historyLength) s.history.shift();

  s.time.cycle++;
  s.time.cycleElapsed = 0;
  s.current = emptyReport(s.time.cycle, s.cash);
  checkMilestones(s);
  checkLevel(s);
  return r;
}

/** Llamar tras cualquier acción del jugador para actualizar hitos y niveles al instante. */
export function afterAction(s: GameState): void {
  checkMilestones(s);
  checkLevel(s);
}
