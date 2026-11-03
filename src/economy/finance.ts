// ============================================================================
// Préstamos (GDD §16) y obligaciones vencidas.
// Interés: TOTAL POR CONTRATO (decisión de balance), pagado en cuotas fijas por ciclo.
// Cada cuota separa capital e interés. El pasivo es el capital pendiente.
// ============================================================================
import { BALANCE } from './balance';
import { PORT_BY_ID } from './data/ports';
import { recordSale } from './commerce';
import { notify, post } from './ledger';
import { buyPrice } from './market';
import { addPrestige, hasMilestone, netWorth } from './progression';
import { nextId } from './rng';
import type { ActionResult, GameState, Loan } from './types';

const fail = (error: string): ActionResult<any> => ({ ok: false, error });

export function loanRate(s: GameState): number {
  return PORT_BY_ID[s.cityId].loanRate;
}

export function creditAvailable(s: GameState): number {
  const used = s.loans.reduce((a, l) => a + l.remainingPrincipal, 0);
  return Math.max(0, Math.floor(netWorth(s) * BALANCE.loanCreditFraction - used));
}

/** Simulación de un préstamo sin contratarlo (para la interfaz). */
export function quoteLoan(s: GameState, principal: number, term: number) {
  const rate = loanRate(s);
  const interest = Math.round(principal * rate);
  return {
    principal, rate, term, interest, total: principal + interest,
    installment: Math.round((principal + interest) / term * 100) / 100,
    principalPart: Math.round(principal / term * 100) / 100,
    interestPart: Math.round(interest / term * 100) / 100,
  };
}

export function takeLoan(s: GameState, principal: number, term: number): ActionResult<Loan> {
  if (!hasMilestone(s, 22)) return fail('Requiere el hito 22: 250.000 de patrimonio neto');
  if (!BALANCE.loanTerms.includes(term)) return fail('Plazo no disponible');
  if (s.loans.length >= BALANCE.maxLoans) return fail(`Máximo ${BALANCE.maxLoans} préstamos activos`);
  principal = Math.floor(principal);
  if (principal <= 0) return fail('Importe inválido');
  if (principal > creditAvailable(s)) return fail(`Tu crédito disponible es ${creditAvailable(s).toLocaleString('es')}`);
  const q = quoteLoan(s, principal, term);
  const loan: Loan = {
    id: nextId(s, 'ln'), principal, rate: q.rate, term,
    remainingPrincipal: principal, remainingInterest: q.interest, installmentsLeft: term,
    installment: q.installment, principalPart: q.principalPart, interestPart: q.interestPart,
    takenCycle: s.time.cycle, missed: 0,
  };
  s.loans.push(loan);
  post(s, 'loan_in.prestamo', principal, `Préstamo a ${term} ciclos`);
  notify(s, 'info', `Préstamo de ${principal.toLocaleString('es')}: ${term} cuotas de ${Math.round(q.installment).toLocaleString('es')}.`);
  return { ok: true, data: loan };
}

/** Amortización anticipada: se paga el capital pendiente; los intereses futuros se condonan. */
export function repayLoan(s: GameState, loanId: string): ActionResult {
  const l = s.loans.find(x => x.id === loanId);
  if (!l) return fail('Préstamo no encontrado');
  if (s.cash < l.remainingPrincipal) return fail(`Necesitas ${Math.ceil(l.remainingPrincipal)} monedas`);
  post(s, 'loan_principal.prestamo', l.remainingPrincipal, 'Amortización anticipada');
  closeLoan(s, l);
  return { ok: true };
}

function closeLoan(s: GameState, l: Loan): void {
  s.loans = s.loans.filter(x => x !== l);
  s.stats.loansRepaid++;
  if (l.missed === 0) addPrestige(s, BALANCE.prestige.perLoanRepaid, 'préstamo devuelto sin retrasos');
  notify(s, 'exito', `Préstamo saldado.`);
}

/** Cobro de cuotas al cierre de ciclo. Lo que no se pueda pagar pasa a obligaciones vencidas. */
export function processLoans(s: GameState): void {
  for (const l of [...s.loans]) {
    const last = l.installmentsLeft === 1;
    const p = last ? l.remainingPrincipal : l.principalPart;
    const i = last ? l.remainingInterest : l.interestPart;
    const short = s.cash < p + i;
    post(s, 'loan_principal.prestamo', p, `Cuota ${l.term - l.installmentsLeft + 1}/${l.term}`, true);
    post(s, 'interest.prestamos', i, undefined, true);
    l.remainingPrincipal = Math.max(0, Math.round((l.remainingPrincipal - p) * 100) / 100);
    l.remainingInterest = Math.max(0, Math.round((l.remainingInterest - i) * 100) / 100);
    l.installmentsLeft--;
    if (short) {
      l.missed++;
      addPrestige(s, BALANCE.prestige.missedPayment, 'cuota de préstamo impagada');
    }
    if (l.installmentsLeft <= 0) closeLoan(s, l);
  }
}

/** Antes de los gastos del ciclo: se pagan las obligaciones vencidas y se aplica recargo. */
export function settleArrears(s: GameState): void {
  if (s.arrears <= 0) return;
  const bankrupt = s.stats.bankrupt;
  const pay = Math.min(s.cash, s.arrears);
  if (pay > 0) { post(s, 'arrears_paid.mora', pay); s.arrears = Math.round((s.arrears - pay) * 100) / 100; }
  if (s.arrears > 0 && !bankrupt) post(s, 'interest.mora', s.arrears * BALANCE.arrearsSurcharge, 'Recargo por mora', true);
}

/**
 * Bancarrota: con patrimonio negativo tras los remates se cierran todas las operaciones
 * (personal, capitanes, rutas, alquileres) y se congelan los recargos. El jugador puede
 * seguir comerciando a mano para salir, o empezar una partida nueva.
 */
export function declareBankruptcy(s: GameState): void {
  if (!s.stats.bankrupt) notify(s, 'alerta', 'BANCARROTA: tu patrimonio es negativo. Se cierran tus operaciones; comercia a mano para recuperarte o empieza una nueva partida.');
  s.stats.bankrupt = true;
  s.workers = [];
  s.captains = s.captains.filter(c => s.voyages.some(v => v.captainId === c.id));
  for (const r of s.autoRoutes) r.active = false;
  s.ships = s.ships.filter(x => x.owned || x.voyageId);
  s.venues = s.venues.filter(v => v.owned);
  s.warehouses = s.warehouses.filter(w => w.owned);
}

/**
 * Después de los gastos: si sigue habiendo deudas vencidas se aplican consecuencias escalonadas.
 *  1.er ciclo: aviso y pérdida de prestigio.
 *  2.º ciclo seguido: embargo de mercancía (remate al 60%).
 *  3.er ciclo seguido y aún con deuda: renuncias de personal, rescisión de alquileres y remate de activos.
 *  Patrimonio negativo tras todo ello: bancarrota.
 */
export function arrearsConsequences(s: GameState): void {
  if (s.arrears <= 0.005) {
    s.arrears = 0; s.stats.arrearsStreak = 0;
    if (s.stats.bankrupt && netWorth(s) >= 0) { s.stats.bankrupt = false; notify(s, 'exito', 'Saliste de la bancarrota.'); }
    return;
  }
  s.stats.arrearsStreak++;
  s.stats.cyclesInArrears++;
  addPrestige(s, BALANCE.prestige.arrearsCycle);
  notify(s, 'alerta', `Deuda pendiente: no alcanzó el dinero para pagar ${Math.round(s.arrears).toLocaleString('es')} de gastos. Págala en la Oficina del puerto; si sigue sin pagarse, los acreedores embargan mercancía.`);
  if (s.stats.arrearsStreak >= BALANCE.arrearsSeizeInventory) liquidateInventory(s);
  if (s.arrears > 0.005 && s.stats.arrearsStreak >= BALANCE.arrearsStreakPenalty) {
    const quit = Math.ceil(s.workers.length / 4);
    if (quit) { s.workers.splice(-quit, quit); notify(s, 'alerta', `${quit} trabajador(es) renunciaron por falta de pago.`); }
    const idle = s.captains.filter(c => !s.voyages.some(v => v.captainId === c.id));
    const capQuit = idle.slice(-Math.ceil(s.captains.length / 4));
    if (capQuit.length) {
      s.captains = s.captains.filter(c => !capQuit.includes(c));
      for (const r of s.autoRoutes) if (r.captainId && capQuit.some(c => c.id === r.captainId)) r.captainId = null;
    }
    const rented = s.venues.filter(v => !v.owned);
    const lost = rented[rented.length - 1];
    if (lost && !quit) { s.venues = s.venues.filter(v => v !== lost); notify(s, 'alerta', 'El dueño de un local rescindió tu alquiler por impago.'); }
    s.ships = s.ships.filter(x => x.owned || x.rental !== 'por_ciclo' || x.voyageId);
    liquidateAssets(s);
    if (netWorth(s) < 0) declareBankruptcy(s);
  }
}

function payArrearsFromCash(s: GameState): void {
  const pay = Math.min(s.cash, s.arrears);
  if (pay > 0) { post(s, 'arrears_paid.mora', pay); s.arrears = Math.round((s.arrears - pay) * 100) / 100; }
}

/** Embargo: se remata inventario al 60% del precio de compra hasta cubrir la deuda vencida. */
export function liquidateInventory(s: GameState): void {
  const ids = Object.keys(s.inventory).sort((a, b) => s.inventory[b].qty * s.inventory[b].avgCost - s.inventory[a].qty * s.inventory[a].avgCost);
  let seized = 0;
  for (const id of ids) {
    if (s.arrears <= s.cash) break;
    const price = Math.max(1, Math.floor(buyPrice(s, id) * BALANCE.liquidationInventory));
    const q = Math.min(Math.ceil((s.arrears - s.cash) / price), s.inventory[id].qty);
    recordSale(s, id, q, price, 'liquidacion');
    seized += q * price;
  }
  if (seized > 0) notify(s, 'alerta', `Los acreedores embargaron mercancía por ${Math.round(seized).toLocaleString('es')}.`);
  payArrearsFromCash(s);
}

/** Remate de activos propios (al 50% de su valor contable), del menor al mayor. */
export function liquidateAssets(s: GameState): void {
  const assets: { label: string; value: number; remove: () => void }[] = [
    ...s.ships.filter(x => x.owned && !x.voyageId).map(x => ({ label: x.name, value: x.bookValue, remove: () => { s.ships = s.ships.filter(y => y !== x); for (const r of s.autoRoutes) if (r.shipId === x.id) r.active = false; } })),
    ...s.warehouses.filter(x => x.owned).map(x => ({ label: 'almacén', value: x.bookValue, remove: () => { s.warehouses = s.warehouses.filter(y => y !== x); } })),
    ...s.venues.filter(x => x.owned).map(x => ({ label: 'local', value: x.bookValue, remove: () => { s.venues = s.venues.filter(y => y !== x); } })),
  ].sort((a, b) => a.value - b.value);
  for (const a of assets) {
    if (s.arrears <= s.cash) break;
    const proceeds = Math.round(a.value * BALANCE.liquidationAssets);
    post(s, 'asset_sale.activo', proceeds, `Remate: ${a.label}`);
    post(s, 'loss.venta_activos', a.value - proceeds);
    a.remove();
    notify(s, 'alerta', `Los acreedores remataron tu ${a.label} por ${proceeds.toLocaleString('es')}.`);
  }
  payArrearsFromCash(s);
}

/** Pagar ahora las deudas pendientes (obligaciones vencidas) con el dinero disponible. */
export function payArrearsNow(s: GameState): ActionResult<{ paid: number }> {
  if (s.arrears <= 0) return fail('No tienes deudas pendientes');
  const pay = Math.min(s.cash, s.arrears);
  if (pay <= 0) return fail('No tienes dinero para pagar');
  post(s, 'arrears_paid.mora', pay, 'Pago de deudas');
  s.arrears = Math.round((s.arrears - pay) * 100) / 100;
  if (s.arrears <= 0.005) { s.arrears = 0; s.stats.arrearsStreak = 0; notify(s, 'exito', 'Saldaste todas tus deudas.'); }
  return { ok: true, data: { paid: pay } };
}
