// ============================================================================
// Comercio: compra/venta manual, distribución, proveedores y negociación, contratos.
// ============================================================================
import { BALANCE } from './balance';
import { recommendedReserve } from './costs';
import { SUPPLIER_NAMES } from './data/catalog';
import { GOOD_BY_ID, GOODS } from './data/goods';
import { addStock, freeStorage, removeStock, stockOf } from './inventory';
import { notify, post } from './ledger';
import {
  availableDemand, availableSupply, availableWholesale, buyPrice, consumeDemand, consumeSupply,
  demandPerCycle, sellPrice, wholesalePrice,
} from './market';
import { addPrestige, addXp, goodLockReason, hasMilestone, netWorth, prestigeRank, unlockedGoods } from './progression';
import { nextId, pick, rand, randInt, randRange } from './rng';
import type { ActionResult, Contract, GameState, GoodSettings, SupplierOffer } from './types';

const fail = (error: string): ActionResult<any> => ({ ok: false, error });

export function defaultGoodSettings(): GoodSettings {
  return { autoSell: true, minSellPrice: 0, restockTarget: -1, restockMaxPrice: 0 };
}
export function settingsOf(s: GameState, goodId: string): GoodSettings {
  return s.goodSettings[goodId] ?? (s.goodSettings[goodId] = defaultGoodSettings());
}
export function setGoodSettings(s: GameState, goodId: string, patch: Partial<GoodSettings>): ActionResult {
  if (!GOOD_BY_ID[goodId]) return fail('Mercancía desconocida');
  Object.assign(settingsOf(s, goodId), patch);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Registro común de una venta (cualquier canal)
// ---------------------------------------------------------------------------
export function recordSale(s: GameState, goodId: string, qty: number, unitPrice: number, channel: string, fromStock = true, costBasis?: number): number {
  const cost = fromStock ? removeStock(s, goodId, qty) : (costBasis ?? 0);
  const revenue = qty * unitPrice;
  post(s, `revenue.${channel}`, revenue, `${qty} × ${GOOD_BY_ID[goodId].name} a ${unitPrice}`);
  post(s, 'cogs.goods', cost);
  addXp(s, (revenue - cost) * BALANCE.xpPerMarginCoin);
  s.stats.lifetimeRevenue += revenue;
  s.stats.lifetimeUnitsSold += qty;
  s.current.unitsSold += qty;
  const gs = (s.goodStats[goodId] ??= { units: 0, revenue: 0, lastSale: 0, cycleUnits: 0, prevCycleUnits: 0 });
  gs.units += qty; gs.revenue += revenue; gs.lastSale = s.time.simSeconds; gs.cycleUnits += qty;
  if (channel === 'manual') s.stats.manualSalesRevenue += revenue;
  // Prestigio por volumen de ventas acumulado
  const steps = BALANCE.prestige.unitsSoldSteps;
  while (s.stats.unitsSoldRewardIndex < steps.length && s.stats.lifetimeUnitsSold >= steps[s.stats.unitsSoldRewardIndex]) {
    addPrestige(s, BALANCE.prestige.unitsSoldReward[s.stats.unitsSoldRewardIndex], `${steps[s.stats.unitsSoldRewardIndex].toLocaleString('es')} unidades vendidas`);
    s.stats.unitsSoldRewardIndex++;
  }
  return revenue - cost;
}

// ---------------------------------------------------------------------------
// Compra y venta manual (GDD §6, etapa 1)
// ---------------------------------------------------------------------------
export function buy(s: GameState, goodId: string, qty: number): ActionResult<{ cost: number }> {
  qty = Math.floor(qty);
  if (qty <= 0) return fail('Cantidad inválida');
  const lock = goodLockReason(s, goodId);
  if (lock) return fail(lock);
  if (qty > availableSupply(s, goodId)) return fail(`El mercado sólo ofrece ${availableSupply(s, goodId)} unidades ahora`);
  if (qty > freeStorage(s)) { const tip = hasMilestone(s, 8) ? 'Alquila un almacén para guardar más.' : 'Vende parte de lo que tienes; los almacenes se desbloquean con el hito 8.';
    return { ok: false, error: freeStorage(s) ? `Solo te caben ${freeStorage(s)} unidades más. ${tip}` : `Tu almacenamiento está lleno. ${tip}`, data: { cost: 0, noSpace: true } as any }; }
  const price = buyPrice(s, goodId);
  const cost = price * qty;
  if (cost > s.cash) return fail(`Dinero insuficiente (necesitas ${cost})`);
  post(s, 'inventory.mercado', cost, `${qty} × ${GOOD_BY_ID[goodId].name} a ${price}`);
  addStock(s, goodId, qty, price);
  consumeSupply(s, s.cityId, goodId, qty);
  return { ok: true, data: { cost } };
}

/** Máximo que se puede comprar ahora (dinero, espacio y oferta). */
export function maxBuyable(s: GameState, goodId: string): number {
  if (goodLockReason(s, goodId)) return 0;
  return Math.max(0, Math.min(Math.floor(s.cash / buyPrice(s, goodId)), freeStorage(s), availableSupply(s, goodId)));
}

export function sell(s: GameState, goodId: string, qty: number): ActionResult<{ revenue: number; profit: number }> {
  qty = Math.floor(qty);
  if (qty <= 0) return fail('Cantidad inválida');
  if (s.time.speed === 0) return fail('El tiempo está en pausa: no hay clientes en la calle');
  if (qty > stockOf(s, goodId)) return fail('No tienes tanta mercancía');
  const cust = Math.floor(s.manualCapacityLeft + 1e-6);
  if (cust <= 0) return fail('Ya atendiste a todos los clientes que podías este ciclo');
  const dem = availableDemand(s, goodId);
  if (dem <= 0) return fail('No hay más clientes interesados en esta mercancía ahora');
  qty = Math.min(qty, cust, dem);
  const price = sellPrice(s, goodId);
  const profit = recordSale(s, goodId, qty, price, 'manual');
  consumeDemand(s, s.cityId, goodId, qty);
  s.manualCapacityLeft -= qty;
  return { ok: true, data: { revenue: qty * price, profit }, warning: undefined };
}

/**
 * Venta en persona gradual: pones mercancía a la venta y los clientes la compran de uno en uno
 * (unos 3 por segundo de juego), mientras te queden clientes por atender y haya demanda.
 */
export function queueSell(s: GameState, goodId: string, qty: number): ActionResult<{ queued: number }> {
  qty = Math.floor(qty);
  if (qty <= 0) return fail('Cantidad inválida');
  const already = s.sellQueue.filter(o => o.goodId === goodId).reduce((a, o) => a + o.qty, 0);
  const free = stockOf(s, goodId) - already;
  if (free <= 0) return fail(already ? 'Ya está todo a la venta' : 'No tienes tanta mercancía');
  const n = Math.min(qty, free);
  const o = s.sellQueue.find(x => x.goodId === goodId);
  if (o) o.qty += n; else s.sellQueue.push({ goodId, qty: n });
  return { ok: true, data: { queued: n }, warning: s.time.speed === 0 ? 'El tiempo está en pausa: venderás cuando lo reanudes' : undefined };
}
export function cancelSell(s: GameState, goodId: string): ActionResult {
  s.sellQueue = s.sellQueue.filter(o => o.goodId !== goodId);
  return { ok: true };
}
export function queuedFor(s: GameState, goodId: string): number {
  return s.sellQueue.filter(o => o.goodId === goodId).reduce((a, o) => a + o.qty, 0);
}
/** Atiende la cola de venta: se llama en cada paso de simulación (dt en segundos de juego). */
export function processSellQueue(s: GameState, dt: number): void {
  if (!s.sellQueue.length) { s.sellAcc = 0; return; }
  s.sellAcc = Math.min(s.sellAcc + dt * BALANCE.manualSalesPerSecond, 4);
  while (s.sellAcc >= 1 && s.sellQueue.length) {
    const o = s.sellQueue[0];
    const stock = stockOf(s, o.goodId);
    if (stock <= 0 || o.qty <= 0) { s.sellQueue.shift(); continue; }
    if (s.manualCapacityLeft < 1) { o.waiting = 'Ya atendiste a todos los clientes que podías este ciclo'; break; }
    if (availableDemand(s, o.goodId) < 1) {
      // Sin clientes para esta mercancía: pasa a la siguiente de la cola (si la hay)
      o.waiting = 'No hay más clientes interesados en esta mercancía ahora';
      const next = s.sellQueue.findIndex(x => availableDemand(s, x.goodId) >= 1 && stockOf(s, x.goodId) > 0);
      if (next <= 0) break;
      s.sellQueue.push(s.sellQueue.splice(0, 1)[0]); continue;
    }
    o.waiting = undefined;
    recordSale(s, o.goodId, 1, sellPrice(s, o.goodId), 'manual');
    consumeDemand(s, s.cityId, o.goodId, 1);
    s.manualCapacityLeft -= 1;
    o.qty -= 1; s.sellAcc -= 1;
    if (o.qty <= 0 || stockOf(s, o.goodId) <= 0) s.sellQueue.shift();
  }
}

// ---------------------------------------------------------------------------
// Distribución a otros comerciantes (GDD §13, hito 14)
// ---------------------------------------------------------------------------
export function distribute(s: GameState, goodId: string, qty: number): ActionResult<{ revenue: number; profit: number }> {
  if (!hasMilestone(s, 14)) return fail('Requiere el hito 14: Distribución a otros comerciantes');
  qty = Math.min(Math.floor(qty), stockOf(s, goodId), availableWholesale(s, goodId));
  if (qty <= 0) return fail('Los comerciantes no demandan más de esta mercancía ahora');
  return { ok: true, data: doDistribute(s, goodId, qty) };
}

export function doDistribute(s: GameState, goodId: string, qty: number) {
  const price = wholesalePrice(s, goodId);
  const gross = recordSale(s, goodId, qty, price, 'wholesale');
  const logistics = qty * price * BALANCE.distributionLogistics;
  post(s, 'variable.logistica', logistics);
  consumeDemand(s, s.cityId, goodId, qty, 'wholesale');
  return { revenue: qty * price, profit: gross - logistics };
}

// ---------------------------------------------------------------------------
// Proveedores y negociación (GDD §12, hitos 11 y 12)
// ---------------------------------------------------------------------------
export function refreshSupplierOffers(s: GameState): void {
  s.supplierOffers = s.supplierOffers.filter(o => o.expires > s.time.cycle);
  if (!hasMilestone(s, 11)) return;
  const want = BALANCE.supplierOffers;
  const goods = unlockedGoods(s).filter(g => g.buy >= 10);
  let guard = 0;
  while (s.supplierOffers.length < want && goods.length && guard++ < 20) {
    const evt = s.events.find(e => e.effects.supplierCategory);
    let g = pick(s, goods);
    if (evt && rand(s) < 0.5) {
      const inCat = goods.filter(x => x.category === evt.effects.supplierCategory);
      if (inCat.length) g = pick(s, inCat);
    }
    if (s.supplierOffers.some(o => o.goodId === g.id)) continue;
    s.supplierOffers.push(makeOffer(s, g.id));
  }
}

function makeOffer(s: GameState, goodId: string): SupplierOffer {
  const g = GOOD_BY_ID[goodId];
  const wholesale = hasMilestone(s, 12) && rand(s) < 0.5;
  const evt = s.events.find(e => e.effects.supplierCategory === g.category);
  const evDisc = evt?.effects.supplierDiscount ?? 0;
  const ref = Math.max(1, Math.round(buyPrice(s, goodId) * BALANCE.supplierRefDiscount * (1 - evDisc)));
  let d = randRange(s, BALANCE.negotiationDiscountMin, BALANCE.negotiationDiscountMax);
  if (wholesale) d += BALANCE.wholesaleExtraDiscount;
  const lotValue = Math.max(BALANCE.supplierLotValue, netWorth(s) * BALANCE.supplierLotNetWorthFrac);
  let minQty = Math.max(5, Math.ceil(lotValue / g.buy / 5) * 5);
  if (wholesale) minQty *= BALANCE.wholesaleLotMult;
  return {
    id: nextId(s, 'of'),
    supplierName: evt ? 'Mercader forastero' : pick(s, SUPPLIER_NAMES),
    goodId, refPrice: ref, minQty, maxQty: minQty * 4,
    floor: Math.max(1, Math.round(ref * (1 - d))),
    minRank: g.minPrestigeRank, wholesale,
    attemptsLeft: BALANCE.negotiationAttempts, agreedPrice: null, counter: null,
    expires: s.time.cycle + randInt(s, 2, 4),
  };
}

export type NegotiationOutcome = 'aceptada' | 'contraoferta' | 'rechazada';

/**
 * Regla (GDD §12.1 y ejemplo §12.2):
 *  oferta ≥ precio mínimo oculto              → aceptada al precio ofrecido
 *  mínimo − (ref − mínimo) ≤ oferta < mínimo  → contraoferta al precio mínimo
 *  por debajo                                 → rechazada (demasiado agresiva)
 * Ej.: ref 100, mínimo 90 → oferta 85 ⇒ contraoferta 90.
 */
export function negotiate(s: GameState, offerId: string, price: number): ActionResult<{ outcome: NegotiationOutcome; price: number }> {
  const o = s.supplierOffers.find(x => x.id === offerId);
  if (!o) return fail('La oferta ya no está disponible');
  if (o.agreedPrice !== null) return fail('Ya cerraste un precio con este proveedor');
  if (o.attemptsLeft <= 0) return fail('El proveedor no quiere seguir negociando hoy');
  price = Math.round(price);
  o.attemptsLeft--;
  if (price >= o.refPrice) { o.agreedPrice = o.refPrice; return { ok: true, data: { outcome: 'aceptada', price: o.refPrice } }; }
  if (price >= o.floor) { o.agreedPrice = price; return { ok: true, data: { outcome: 'aceptada', price } }; }
  if (price >= o.floor - (o.refPrice - o.floor)) { o.counter = o.floor; return { ok: true, data: { outcome: 'contraoferta', price: o.floor } }; }
  return { ok: true, data: { outcome: 'rechazada', price: o.refPrice } };
}

export function acceptCounter(s: GameState, offerId: string): ActionResult {
  const o = s.supplierOffers.find(x => x.id === offerId);
  if (!o || o.counter === null) return fail('No hay contraoferta');
  o.agreedPrice = o.counter;
  return { ok: true };
}

/** Compra al proveedor (al precio pactado, o al de referencia si no se negoció). */
export function purchaseFromSupplier(s: GameState, offerId: string, qty: number): ActionResult<{ cost: number }> {
  const o = s.supplierOffers.find(x => x.id === offerId);
  if (!o) return fail('La oferta ya no está disponible');
  if (prestigeRank(s) < o.minRank) return fail('Tu prestigio no es suficiente para este proveedor');
  qty = Math.floor(qty);
  if (qty < o.minQty) return fail(`Compra mínima: ${o.minQty} unidades`);
  if (qty > o.maxQty) return fail(`Máximo del lote: ${o.maxQty} unidades`);
  if (qty > freeStorage(s)) return fail(`Espacio insuficiente (libre: ${freeStorage(s)})`);
  const price = o.agreedPrice ?? o.refPrice;
  const cost = price * qty;
  if (cost > s.cash) return fail(`Necesitas ${cost} monedas para este lote`);
  post(s, 'inventory.proveedor', cost, `${o.supplierName}: ${qty} × ${GOOD_BY_ID[o.goodId].name} a ${price}`);
  addStock(s, o.goodId, qty, price);
  if (o.agreedPrice !== null && o.agreedPrice < o.refPrice) s.stats.negotiationsWon++;
  s.supplierOffers = s.supplierOffers.filter(x => x.id !== offerId);
  const warning = s.cash < recommendedReserve(s) ? `Te quedan ${Math.round(s.cash).toLocaleString('es')} monedas y los gastos fijos de los próximos 2 ciclos suman ${Math.round(recommendedReserve(s)).toLocaleString('es')}. Vende antes del cierre para no quedarte en deuda.` : undefined;
  return { ok: true, data: { cost }, warning };
}

// ---------------------------------------------------------------------------
// Contratos (prestigio, GDD §19.2; internacionales: hito 26)
// ---------------------------------------------------------------------------
export function generateContracts(s: GameState): void {
  const c = s.time.cycle;
  for (const k of s.contracts) {
    if (k.status === 'oferta' && k.offerExpires <= c) k.status = 'expirado';
    if (k.status === 'aceptado' && k.deadline <= c) {
      k.status = 'fallido';
      s.stats.contractsFailed++;
      addPrestige(s, -k.prestige * BALANCE.prestige.contractFailMult, `contrato incumplido (${GOOD_BY_ID[k.goodId].name})`);
      notify(s, 'alerta', `Incumpliste el contrato de ${k.qty} ${GOOD_BY_ID[k.goodId].name}.`);
    }
  }
  s.contracts = s.contracts.filter(k => k.status === 'oferta' || k.status === 'aceptado' || k.deadline > c - 10);
  if (!hasMilestone(s, 2)) return;
  const offers = s.contracts.filter(k => k.status === 'oferta').length;
  if (offers >= BALANCE.maxContractOffers || rand(s) > BALANCE.contractChancePerCycle) return;
  const intl = hasMilestone(s, 26) && s.knownRoutes.length > 0 && rand(s) < 0.4;
  s.contracts.push(intl ? makeIntlContract(s) : makeLocalContract(s));
}

function makeLocalContract(s: GameState): Contract {
  const goods = unlockedGoods(s);
  const top = goods.slice(-6);
  const g = pick(s, top);
  const rank = prestigeRank(s);
  const qty = Math.max(5, Math.round(demandPerCycle(s, g.id) * randRange(s, 2, 5)));
  const unitPrice = Math.round(sellPrice(s, g.id) * (BALANCE.contractPremium + 0.02 * rank));
  const value = qty * unitPrice;
  return {
    id: nextId(s, 'ct'), kind: 'local', goodId: g.id, qty, delivered: 0, unitPrice, port: null,
    deadline: s.time.cycle + randInt(s, 3, 7), prestige: Math.round(6 + Math.sqrt(value) / 3),
    minRank: Math.max(1, rank - (rand(s) < 0.3 ? 0 : 1)), status: 'oferta', offerExpires: s.time.cycle + 3,
  };
}

function makeIntlContract(s: GameState): Contract {
  const port = pick(s, s.knownRoutes);
  const goods = unlockedGoods(s).filter(g => g.buy >= 100);
  const g = pick(s, goods.length ? goods : unlockedGoods(s));
  const qty = Math.max(20, Math.round(randRange(s, 80, 300) / Math.max(1, Math.log10(g.buy))));
  const unitPrice = Math.round(sellPrice(s, g.id, port) * BALANCE.intlContractPremium);
  const value = qty * unitPrice;
  return {
    id: nextId(s, 'ct'), kind: 'internacional', goodId: g.id, qty, delivered: 0, unitPrice, port,
    deadline: s.time.cycle + randInt(s, 25, 45), prestige: Math.round(30 + Math.sqrt(value) / 2),
    minRank: prestigeRank(s), status: 'oferta', offerExpires: s.time.cycle + 4,
  };
}

export function acceptContract(s: GameState, id: string): ActionResult {
  const k = s.contracts.find(x => x.id === id);
  if (!k || k.status !== 'oferta') return fail('El contrato ya no está disponible');
  if (prestigeRank(s) < k.minRank) return fail('Prestigio insuficiente para este contrato');
  k.status = 'aceptado';
  return { ok: true };
}

/** Entrega de un contrato local desde el inventario (se cobra por unidad entregada). */
export function deliverContract(s: GameState, id: string, qty?: number): ActionResult<{ revenue: number }> {
  const k = s.contracts.find(x => x.id === id);
  if (!k || k.status !== 'aceptado') return fail('Contrato no activo');
  if (k.kind !== 'local') return fail('Los contratos internacionales se entregan por barco');
  const n = Math.min(qty ?? Infinity, k.qty - k.delivered, stockOf(s, k.goodId));
  if (n <= 0) return fail('No tienes mercancía para entregar');
  recordSale(s, k.goodId, n, k.unitPrice, 'contracts');
  k.delivered += n;
  if (k.delivered >= k.qty) completeContract(s, k);
  return { ok: true, data: { revenue: n * k.unitPrice } };
}

export function completeContract(s: GameState, k: Contract): void {
  k.status = 'cumplido';
  s.stats.contractsFulfilled++;
  addPrestige(s, k.prestige, `contrato cumplido (${GOOD_BY_ID[k.goodId].name})`);
  addXp(s, k.prestige * 10);
  notify(s, 'exito', `Contrato cumplido: ${k.qty} ${GOOD_BY_ID[k.goodId].name}. +${k.prestige} prestigio.`);
}

export const ALL_GOODS = GOODS;

// ---------------------------------------------------------------------------
// Contrato exclusivo (mejora 1.4): compra automática y permanente por ciclo,
// disponible tras vender 3.000 unidades de un producto. Precio fijo con descuento.
// ---------------------------------------------------------------------------
export function exclusiveAvailable(s: GameState, goodId: string): boolean {
  return (s.goodStats[goodId]?.units ?? 0) >= BALANCE.exclusiveUnits && !goodLockReason(s, goodId);
}
export function setExclusive(s: GameState, goodId: string, qty: number): ActionResult {
  if (!exclusiveAvailable(s, goodId)) return fail(`Necesitas haber vendido ${BALANCE.exclusiveUnits.toLocaleString('es')} unidades de ${GOOD_BY_ID[goodId].name}`);
  qty = Math.max(0, Math.floor(qty));
  let k = s.exclusives.find(x => x.goodId === goodId);
  if (!k) { k = { goodId, qty, price: Math.max(1, Math.round(buyPrice(s, goodId) * BALANCE.exclusiveDiscount)), active: qty > 0, failedCycles: 0 }; s.exclusives.push(k); }
  k.qty = qty; k.active = qty > 0;
  if (k.active) notify(s, 'info', `Contrato exclusivo: recibirás ${qty} ${GOOD_BY_ID[goodId].name} cada ciclo a ${k.price} la unidad.`);
  return { ok: true };
}
export function processExclusives(s: GameState): void {
  for (const k of s.exclusives) {
    if (!k.active) continue;
    const q = Math.min(k.qty, freeStorage(s), Math.floor(Math.max(0, s.cash) / k.price));
    if (q < k.qty) {
      if (k.failedCycles++ === 0) notify(s, 'alerta', `Contrato exclusivo de ${GOOD_BY_ID[k.goodId].name}: solo se pudieron recibir ${q} de ${k.qty} (falta ${q === 0 && freeStorage(s) === 0 ? 'espacio' : 'dinero o espacio'}).`);
    } else k.failedCycles = 0;
    if (q <= 0) continue;
    post(s, 'inventory.proveedor', q * k.price, `Contrato exclusivo: ${q} × ${GOOD_BY_ID[k.goodId].name}`);
    addStock(s, k.goodId, q, k.price);
  }
}
