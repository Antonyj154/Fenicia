// ============================================================================
// Bot "jugador razonable" para validar el balance económico.
// No es óptimo: imita decisiones sensatas de un jugador atento.
// ============================================================================
import {
  actions, advance, availableDemand, availableSupply, BALANCE, buyPrice, demandPerCycle, fixedCostTotal, freeStorage,
  GOODS, hasMilestone, inventoryUnits, netWorth, portSalePrice, recommendedReserve, salesCapacity, sellPrice,
  setSpeed, shipCapacity, slotsTotal, slotsUsed, stockOf, storageCapacity, unlockedGoods, VENUES, WAREHOUSES,
  expeditionRequired, PORTS, wholesalePrice, inventoryValue, cartSlots, CARTS, towns, townUnitPrice, estimateTrip, GOOD_BY_ID,
} from '../src/economy';
import { wholesalePerCycle as availableWholesaleCap } from '../src/economy/market';
import type { GameState } from '../src/economy/types';

const reserve = (s: GameState) => recommendedReserve(s) * 0.75;
const spendable = (s: GameState) => Math.max(0, s.cash - reserve(s));

function retailTargets(s: GameState): { id: string; margin: number; target: number }[] {
  return unlockedGoods(s)
    .map(g => ({ id: g.id, margin: sellPrice(s, g.id) - buyPrice(s, g.id), target: Math.ceil(demandPerCycle(s, g.id) * 1.1) }))
    .filter(x => x.margin > 0)
    .sort((a, b) => b.margin - a.margin);
}

function manualTrade(s: GameState): void {
  // Vender primero lo de mayor margen
  const goods = Object.keys(s.inventory).sort((a, b) => (sellPrice(s, b) - s.inventory[b].avgCost) - (sellPrice(s, a) - s.inventory[a].avgCost));
  for (const id of goods) {
    if (s.manualCapacityLeft < 1) break;
    if (sellPrice(s, id) <= s.inventory[id].avgCost) continue;
    actions.sell(s, id, stockOf(s, id));
  }
  // Comprar para reponer (stock objetivo ≈ demanda de un ciclo), mayor margen primero
  for (const t of retailTargets(s)) {
    const need = t.target - stockOf(s, t.id);
    if (need <= 0) continue;
    const q = Math.min(need, availableSupply(s, t.id), freeStorage(s), Math.floor(spendable(s) / buyPrice(s, t.id)));
    if (q > 0) actions.buy(s, t.id, q);
  }
}

function routeStock(s: GameState): number {
  return s.ships.length ? s.ships.reduce((a, sh) => a + shipCapacity(sh), 0) : 0;
}

function expand(s: GameState): void {
  const nw = netWorth(s);
  const last = s.history[s.history.length - 1];
  const cap = salesCapacity(s);
  // --- Personal de ventas
  if (hasMilestone(s, 3) && s.workers.length === 0 && s.cash > 120) actions.hireWorker(s, 'vendedor');
  // --- Puestos y locales
  if (hasMilestone(s, 5) && !s.venues.length && s.cash > 250) {
    actions.rentVenue(s, 'puesto_plaza');
    const w = s.workers.find(x => x.role === 'vendedor' && !x.venueId);
    if (w) actions.assignWorker(s, w.id, 'puesto_plaza');
  }
  const util = last && cap > 0 ? (last.lines['revenue.auto'] ? last.unitsSold / (cap + BALANCE.manualCustomersPerCycle) : 0) : 0;
  if (hasMilestone(s, 7) && (util > 0.75 || s.workers.filter(w => w.role === 'vendedor').length < 2) && spendable(s) > 400) {
    // Plaza libre en algún establecimiento (el de más tráfico primero)
    const venues = s.venues.map(v => VENUES.find(d => d.id === v.defId)!).sort((a, b) => b.traffic - a.traffic);
    const spot = venues.find(v => slotsUsed(s, v.id) < slotsTotal(v.id));
    if (spot) actions.hireWorker(s, 'vendedor', spot.id);
    else if (slotsUsed(s, null) < slotsTotal(null)) actions.hireWorker(s, 'vendedor', null);
    else {
      const next = VENUES.find(v => !s.venues.some(x => x.defId === v.id) && hasMilestone(s, v.minMilestone)
        && (v.kind === 'puesto' || hasMilestone(s, 13) || !s.venues.some(x => VENUES.find(d => d.id === x.defId)!.kind === 'local')));
      if (next && (hasMilestone(s, 13) || next.kind === 'local')) {
        if (next.price > 0 && spendable(s) > next.price * 1.3) actions.buyVenue(s, next.id);
        else if (spendable(s) > next.rent * 10) actions.rentVenue(s, next.id);
      }
    }
  }
  // Comprar el local que ya se alquila
  for (const v of s.venues) {
    const d = VENUES.find(x => x.id === v.defId)!;
    if (!v.owned && d.price > 0 && spendable(s) > d.price * 1.5) actions.buyVenue(s, d.id);
  }
  // Primer local propio
  if (hasMilestone(s, 10) && !s.venues.some(v => v.owned) && spendable(s) > 5600) actions.buyVenue(s, 'local_alfareros');
  // --- Almacenes cuando falta espacio
  const storageNeed = (inventoryUnits(s) + 50) / storageCapacity(s);
  if (hasMilestone(s, 8) && (storageNeed > 0.8 || !s.warehouses.length)) {
    const wanted = Math.max(200, routeStock(s) * 1.2 + storageCapacity(s) * 0.5);
    const d = WAREHOUSES.find(w => w.capacity >= wanted * 0.4 && hasMilestone(s, w.minMilestone)) ?? WAREHOUSES[0];
    if (spendable(s) > d.rent * 8) actions.rentWarehouse(s, d.id);
  }
  // --- Almaceneros y reposición
  if (hasMilestone(s, 9) && s.workers.filter(w => w.role === 'almacenero').length < Math.min(2 * s.warehouses.length, 1 + Math.floor(nw / 60000)) && spendable(s) > 500) actions.hireWorker(s, 'almacenero');
  if (hasMilestone(s, 9)) {
    const shipNeed = s.ships.length ? 1 : 0;
    const heavy = inventoryValue(s) > (netWorth(s) - inventoryValue(s)) * 0.5;
    for (const t of retailTargets(s).slice(0, 14)) {
      actions.setGoodSettings(s, t.id, { restockTarget: heavy ? Math.ceil(t.target) : Math.ceil(t.target * 1.5 + shipNeed * Math.min(300, routeStock(s) / 6)) });
    }
  }
  // --- Proveedores
  if (hasMilestone(s, 11)) {
    for (const o of [...s.supplierOffers]) {
      if (o.agreedPrice === null && o.attemptsLeft > 0) {
        const r = actions.negotiate(s, o.id, Math.round(o.refPrice * 0.86));
        if (r.data?.outcome === 'contraoferta') actions.acceptCounter(s, o.id);
        else if (r.data?.outcome === 'rechazada') actions.negotiate(s, o.id, Math.round(o.refPrice * 0.93));
      }
      const price = o.agreedPrice ?? o.refPrice;
      // Sólo compra lo que puede vender en unos ciclos (minorista + mayorista + barcos)
      const sellable = demandPerCycle(s, o.goodId) * 3 + (hasMilestone(s, 14) ? availableWholesaleCap(s, o.goodId) * 2 : 0) + (s.ships.length ? 150 : 0);
      const room = Math.max(0, Math.floor(sellable - stockOf(s, o.goodId)));
      const invCap = Math.max(0, (netWorth(s) - inventoryValue(s)) * 0.5 - inventoryValue(s));
      const q = Math.min(o.maxQty, room, freeStorage(s), Math.floor(Math.min(spendable(s) * 0.4, invCap) / price));
      if (q >= o.minQty && price < buyPrice(s, o.goodId)) actions.purchaseFromSupplier(s, o.id, q);
    }
  }
  // --- Distribución
  if (hasMilestone(s, 14)) {
    for (const id of Object.keys(s.inventory)) {
      const keep = Math.ceil(demandPerCycle(s, id) * 2) + (s.ships.length ? 200 : 0);
      const extra = stockOf(s, id) - keep;
      if (extra > 0 && wholesalePrice(s, id) > s.inventory[id].avgCost * 1.04) actions.distribute(s, id, extra);
    }
  }
  // --- Contratos locales
  for (const k of s.contracts) {
    if (k.status === 'oferta' && k.kind === 'local' && stockOf(s, k.goodId) + availableSupply(s, k.goodId) >= k.qty) actions.acceptContract(s, k.id);
    if (k.status === 'oferta' && k.kind === 'internacional' && s.ships.length && stockOf(s, k.goodId) >= k.qty) actions.acceptContract(s, k.id);
    if (k.status === 'aceptado' && k.kind === 'local') {
      const need = k.qty - k.delivered - stockOf(s, k.goodId);
      if (need > 0) { const q = Math.min(need, availableSupply(s, k.goodId), freeStorage(s), Math.floor(spendable(s) / buyPrice(s, k.goodId))); if (q > 0) actions.buy(s, k.goodId, q); }
      actions.deliverContract(s, k.id);
    }
  }
  land(s);
  maritime(s, nw);
  // --- Préstamo puntual para acelerar compra de barcos
  if (hasMilestone(s, 22) && !s.loans.length && s.stats.loansRepaid === 0 && s.ships.filter(x => x.owned).length < 3 && s.cash < 150000 && nw > 400000) {
    actions.takeLoan(s, 150000, 20);
  }
  // --- Astillero
  if (hasMilestone(s, 24) && !s.hasShipyard && s.cash > BALANCE.shipyardPrice + reserve(s) + 100000) actions.buyShipyard(s);
  if (s.hasShipyard && s.cash > 400000 + reserve(s) && s.ships.length < Math.min(8, s.knownRoutes.length * 2)) {
    const recent = s.history.slice(-10);
    const avgNet = recent.reduce((a, r) => a + r.netProfit, 0) / Math.max(1, recent.length);
    const avgFixed = recent.reduce((a, r) => a + r.fixed, 0) / Math.max(1, recent.length);
    if (avgNet > 40000 && avgFixed < avgNet * 0.5) actions.buildShip(s, hasMilestone(s, 21) && avgNet > 80000 ? 'avanzado' : 'mercante');
  }
}

function land(s: GameState): void {
  if (!hasMilestone(s, 30)) return;
  if (!s.stables && spendable(s) > 1500) actions.rentStables(s);
  if (s.stables && !s.stables.owned && spendable(s) > 12000) actions.buyStables(s);
  if (!s.stables) return;
  for (let k = 0; k < 4 && s.landTrips.length < cartSlots(s); k++) {
    const cart = spendable(s) > 3000 ? 'bueyes' : 'burro';
    const cap = CARTS[cart].capacity;
    let best: { town: string; cargo: { goodId: string; qty: number }[]; profit: number } | null = null;
    for (const t of towns(s)) {
      const cargo = Object.keys(s.inventory).map(id => ({ id, m: townUnitPrice(s, t, id, 20) - s.inventory[id].avgCost })).filter(x => x.m > 0).sort((a, b) => b.m - a.m)
        .reduce<{ goodId: string; qty: number }[]>((acc, x) => { const used = acc.reduce((a, c) => a + c.qty, 0); const q = Math.min(stockOf(s, x.id), cap - used, Math.ceil(GOOD_BY_ID[x.id].retailDemand * t.size)); if (q > 0) acc.push({ goodId: x.id, qty: q }); return acc; }, []);
      if (!cargo.length) continue;
      const e = estimateTrip(s, cart, t.id, cargo); const per = e.profit / e.cycles;
      if (e.profit > 0 && (!best || per > best.profit)) best = { town: t.id, cargo, profit: per };
    }
    if (!best || !actions.sendCart(s, cart, best.town, best.cargo).ok) break;
  }
}

function bestCargo(s: GameState, port: string, capacity: number) {
  return Object.keys(s.inventory)
    .map(id => ({ id, profit: portSalePrice(s, id, port) - s.inventory[id].avgCost }))
    .filter(x => x.profit > s.inventory[x.id].avgCost * 0.12)
    .sort((a, b) => b.profit - a.profit)
    .reduce<{ goodId: string; qty: number }[]>((acc, x) => {
      const used = acc.reduce((a, c) => a + c.qty, 0);
      const q = Math.min(stockOf(s, x.id), availableDemand(s, x.id, port), capacity - used);
      if (q > 0) acc.push({ goodId: x.id, qty: q });
      return acc;
    }, []);
}

function returnOrders(s: GameState, port: string, capacity: number) {
  return unlockedGoods(s)
    .map(g => ({ g, gain: sellPrice(s, g.id) - buyPrice(s, g.id, port) }))
    .filter(x => buyPrice(s, x.g.id, port) < buyPrice(s, x.g.id) * 0.9)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 3)
    .map(x => ({ goodId: x.g.id, qty: Math.floor(capacity / 3), maxPrice: Math.round(buyPrice(s, x.g.id) * 0.92) }));
}

function bestPort(s: GameState, capacity: number): string {
  let best = s.knownRoutes[0], bestVal = -Infinity;
  for (const p of s.knownRoutes) {
    const sh = s.ships[0];
    const cycles = sh ? Math.max(2, Math.ceil(2 * 1.25 * 1) ) : 2;
    const val = bestCargo(s, p, capacity).reduce((a, c) => a + c.qty * (portSalePrice(s, c.goodId, p) - s.inventory[c.goodId].avgCost), 0) / cycles;
    if (val > bestVal) { bestVal = val; best = p; }
  }
  return best;
}

function maritime(s: GameState, nw: number): void {
  if (!hasMilestone(s, 15)) return;
  if (!s.ships.length && spendable(s) > 8000) actions.rentShip(s, 'por_viaje');
  if (hasMilestone(s, 16) && !s.captains.length && spendable(s) > 3000) actions.hireCaptain(s);
  if (hasMilestone(s, 21) && s.captains.length < s.ships.length && spendable(s) > 5000) actions.hireCaptain(s);
  const recent = s.history.slice(-10);
  const avgNet = recent.reduce((a, r) => a + r.netProfit, 0) / Math.max(1, recent.length);
  const fleetCap = Math.min(s.knownRoutes.length * 2, 2 + Math.floor(nw / 1_500_000));
  const wantYard = hasMilestone(s, 24) && !s.hasShipyard;
  const avgFixed = recent.reduce((a, r) => a + r.fixed, 0) / Math.max(1, recent.length);
  const avgRev = recent.reduce((a, r) => a + r.revenue, 0) / Math.max(1, recent.length);
  const lean = avgFixed < avgRev * 0.15;
  if (!wantYard && lean && hasMilestone(s, 20) && s.ships.filter(x => x.owned).length < fleetCap && avgNet > 15000 && spendable(s) > 150000 + 30000) {
    const big = hasMilestone(s, 21) && spendable(s) > 480000;
    if (!s.hasShipyard && !s.shipyardRented) actions.rentShipyard(s);
    const r = actions.buyShip(s, big ? 'avanzado' : 'mercante');
    if (r.ok) { const rented = s.ships.find(x => !x.owned && !x.voyageId); if (rented) actions.returnShip(s, rented.id); }
  }
  if (hasMilestone(s, 17)) {
    const unknown = PORTS.filter(p => p.id !== s.cityId && !s.knownRoutes.includes(p.id) && !s.expeditions.some(e => e.target === p.id))
      .sort((a, b) => expeditionRequired(s, a.id) - expeditionRequired(s, b.id));
    const t = unknown[0];
    if (t && !s.expeditions.length && spendable(s) > expeditionRequired(s, t.id) * 2) actions.fundExpedition(s, t.id, expeditionRequired(s, t.id));
  }
  for (const r of s.autoRoutes) if (r.active && !s.ships.some(x => x.id === r.shipId)) r.active = false;
  // Poda de flota: barcos cuya ruta pierde dinero de forma sostenida se venden
  for (const r of s.autoRoutes) {
    if (!r.active || r.trips < 3 || r.profitTotal / r.trips > 0) continue;
    const sh = s.ships.find(x => x.id === r.shipId);
    if (sh && !sh.voyageId) { r.active = false; if (sh.owned) actions.sellShip(s, sh.id); else actions.returnShip(s, sh.id); r.trips = 0; r.profitTotal = 0; }
  }
  for (const sh of s.ships) {
    if (sh.voyageId) continue;
    if (sh.owned && sh.condition < 0.55) actions.repairShip(s, sh.id);
    const capT = shipCapacity(sh);
    const port = bestPort(s, capT);
    const cargo = bestCargo(s, port, capT);
    const route = s.autoRoutes.find(r => r.shipId === sh.id && r.active);
    const captain = s.captains.find(c => !s.voyages.some(v => v.captainId === c.id) && !s.autoRoutes.some(r => r.active && r.captainId === c.id && r.shipId !== sh.id));
    const piracy = (PORTS.find(p => p.id === port)!.piracy);
    const protection = piracy > 0.06 ? 'escolta' : 'ninguna';
    if (hasMilestone(s, 19)) {
      // Rutas automáticas: se reconfiguran con la mejor carga disponible
      if (route) { route.to = port; route.cargo = cargo.map(c => ({ goodId: c.goodId, qty: capT })); route.returnOrders = returnOrders(s, port, capT); route.protection = protection; }
      else actions.createAutoRoute(s, { to: port, shipId: sh.id, captainId: captain?.id ?? null, cargo: cargo.map(c => ({ goodId: c.goodId, qty: capT })), returnOrders: returnOrders(s, port, capT), frequency: 0, protection });
    } else if (cargo.reduce((a, c) => a + c.qty, 0) >= capT * 0.3) {
      actions.launchVoyage(s, { shipId: sh.id, to: port, cargo, returnOrders: returnOrders(s, port, capT), protection, captainId: captain?.id ?? null });
    }
  }
  void fixedCostTotal;
}

/** Juega un ciclo completo: 6 rondas de comercio manual + decisiones de expansión. */
export function botCycle(s: GameState): void {
  setSpeed(s, 1);
  expand(s);
  for (let i = 0; i < 6; i++) {
    manualTrade(s);
    advance(s, BALANCE.cycleSeconds / 6);
  }
}

export { GOODS };
