// ============================================================================
// Etapa final: participación en talleres (hito 23), monopolios (hito 28) y el tesoro del templo
// (hito 29). Además, el contrato con el astillero de la ciudad para encargar barcos (hito 20).
// ============================================================================
import { BALANCE } from './balance';
import { MONOPOLY_FEE, MONOPOLY_MAX, TREASURY_RATE, WORKSHOPS } from './data/invest';
import { GOOD_BY_ID } from './data/goods';
import { notify, post } from './ledger';
import { hasMilestone } from './progression';
import type { ActionResult, GameState } from './types';

const fail = (error: string): ActionResult<any> => ({ ok: false, error });

// ---- Talleres
export function buyWorkshop(s: GameState, id: string): ActionResult {
  if (!hasMilestone(s, 23)) return fail('Requiere el hito 23: Participación en otros negocios');
  const w = WORKSHOPS.find(x => x.id === id); if (!w) return fail('Taller desconocido');
  if (s.workshops.includes(id)) return fail('Ya tienes parte en este taller');
  if (s.cash < w.price) return fail(`Necesitas ${w.price.toLocaleString('es')} monedas`);
  post(s, 'investment.taller', w.price, w.name);
  s.workshops.push(id);
  notify(s, 'exito', `Compraste una participación en el ${w.name.toLowerCase()}: cobrarás ${w.dividend} por ciclo y comprarás su mercancía un 10% más barata.`);
  return { ok: true };
}
export function sellWorkshop(s: GameState, id: string): ActionResult {
  const w = WORKSHOPS.find(x => x.id === id); if (!w || !s.workshops.includes(id)) return fail('No tienes parte en ese taller');
  const proceeds = Math.round(w.price * 0.8);
  post(s, 'asset_sale.activo', proceeds, w.name);
  post(s, 'loss.venta_activos', w.price - proceeds);
  s.workshops = s.workshops.filter(x => x !== id);
  return { ok: true };
}
export const workshopsValue = (s: GameState) => WORKSHOPS.filter(w => s.workshops?.includes(w.id)).reduce((a, w) => a + w.price, 0);

// ---- Monopolios
export function monopolyBlock(s: GameState, goodId: string): string | null {
  if (!hasMilestone(s, 28)) return 'Requiere el hito 28: Monopolios comerciales';
  if (!s.exclusives.some(e => e.goodId === goodId && e.active)) return 'Necesitas un contrato exclusivo activo de esta mercancía';
  if (s.monopolies.length >= MONOPOLY_MAX) return `Máximo ${MONOPOLY_MAX} monopolios`;
  return null;
}
export function setMonopoly(s: GameState, goodId: string, on: boolean): ActionResult {
  if (!on) { s.monopolies = s.monopolies.filter(x => x !== goodId); return { ok: true }; }
  if (s.monopolies.includes(goodId)) return { ok: true };
  const b = monopolyBlock(s, goodId); if (b) return fail(b);
  s.monopolies.push(goodId);
  notify(s, 'exito', `Monopolio de ${GOOD_BY_ID[goodId].name}: en la ciudad la vendes un 20% más cara (tasa ${MONOPOLY_FEE}/ciclo).`);
  return { ok: true };
}

// ---- Tesoro del templo
export function deposit(s: GameState, amount: number): ActionResult {
  if (!hasMilestone(s, 29)) return fail('Requiere el hito 29: Inversiones avanzadas');
  amount = Math.floor(Math.min(amount, s.cash));
  if (amount <= 0) return fail('No tienes dinero para depositar');
  post(s, 'investment.tesoro', amount, 'Depósito en el tesoro del templo');
  s.treasury += amount;
  return { ok: true };
}
export function withdraw(s: GameState, amount: number): ActionResult {
  amount = Math.floor(Math.min(amount, s.treasury));
  if (amount <= 0) return fail('No tienes depósitos');
  s.treasury -= amount;
  post(s, 'asset_sale.tesoro', amount, 'Retiro del tesoro del templo');
  return { ok: true };
}

// ---- Astillero de la ciudad (alquiler para encargar barcos)
export function rentShipyard(s: GameState): ActionResult {
  if (!hasMilestone(s, 20)) return fail('Requiere el hito 20: Compra del primer barco');
  if (s.hasShipyard || s.shipyardRented) return fail('Ya trabajas con el astillero');
  s.shipyardRented = true;
  notify(s, 'info', `Contrataste el astillero de la ciudad (${BALANCE.shipyardRent}/ciclo): ya puedes encargar barcos.`);
  return { ok: true };
}
export function releaseShipyard(s: GameState): ActionResult {
  if (!s.shipyardRented) return fail('No tienes contrato con el astillero');
  if (s.ships.some(x => x.underConstruction > 0)) return fail('Hay un barco en construcción');
  s.shipyardRented = false;
  return { ok: true };
}

/** Cierre de ciclo: dividendos e intereses del tesoro. */
export function processInvestments(s: GameState): void {
  for (const w of WORKSHOPS) if (s.workshops.includes(w.id)) post(s, 'revenue.dividendos', w.dividend, w.name);
  if (s.treasury > 0) {
    const i = Math.round(s.treasury * TREASURY_RATE);
    s.treasury += i;                                   // los intereses se suman al depósito
    s.current.lines['revenue.tesoro'] = (s.current.lines['revenue.tesoro'] ?? 0) + i;
    s.current.revenue += i;
  }
}
