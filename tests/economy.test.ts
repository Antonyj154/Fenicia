import { describe, expect, it } from 'vitest';
import {
  actions, advance, advanceCycles, balanceSheet, BALANCE, buyPrice, createGame, estimateVoyageCosts, netWorth,
  quoteLoan, sellPrice, setSpeed, stockOf,
} from '../src/economy';
import { negotiate } from '../src/economy/commerce';
import type { CycleReport, GameState } from '../src/economy/types';

const CASH_SIGN: Record<string, number> = {
  revenue: 1, cogs: 0, variable: -1, fixed: -1, interest: -1, loss: 0, inventory: -1, investment: -1,
  loan_in: 1, loan_principal: -1, asset_sale: 1, arrears_paid: -1,
};

/** La variación de caja de un ciclo debe coincidir con los movimientos registrados (excepto lo que pasó a mora). */
function cashDelta(r: CycleReport): number {
  return Object.entries(r.lines).reduce((a, [k, v]) => a + CASH_SIGN[k.split('.')[0]] * v, 0);
}

function rich(s: GameState, cash: number, milestones: number[], level = 15, prestige = 1e6) {
  s.cash = cash; s.current.cashStart = cash;
  s.milestones = Array.from(new Set([...s.milestones, ...milestones]));
  s.level = level; s.prestige = prestige;
}

describe('Tiempo y ciclos (GDD §3–4)', () => {
  it('un ciclo dura 60 s a ×1 y 10 s a ×6', () => {
    const s = createGame('tiro', 1);
    expect(advance(s, 59.9)).toHaveLength(0);
    expect(advance(s, 0.2)).toHaveLength(1);
    setSpeed(s, 6);
    expect(advance(s, 9.9)).toHaveLength(0);
    expect(advance(s, 0.2)).toHaveLength(1);
  });
  it('la pausa detiene todos los procesos', () => {
    const s = createGame('tiro', 2);
    actions.buy(s, 'baratijas', 5);
    setSpeed(s, 0);
    const before = JSON.stringify(s);
    advance(s, 3600);
    expect(JSON.stringify(s)).toBe(before);
    expect(actions.sell(s, 'baratijas', 1).ok).toBe(false);
  });
});

describe('Compra y venta manual (etapa 1)', () => {
  it('reproduce la etapa 1: 5 baratijas, ingreso 25, costo 20, ganancia 5', () => {
    const s = createGame('tiro', 3);
    // Neutralizamos la fluctuación para validar los precios de referencia
    s.markets.tiro.baratijas.factor = 1;
    expect(buyPrice(s, 'baratijas')).toBe(4);
    expect(sellPrice(s, 'baratijas')).toBe(5);
    expect(actions.buy(s, 'baratijas', 5).ok).toBe(true);
    expect(s.cash).toBe(0);
    expect(actions.sell(s, 'baratijas', 5).ok).toBe(true);
    expect(s.cash).toBe(25);
    expect(s.current.revenue).toBe(25);
    expect(s.current.cogs).toBe(20);
  });
  it('no permite vender sin inventario ni genera ingresos automáticos sin stock (GDD §23.1)', () => {
    const s = createGame('tiro', 4);
    expect(actions.sell(s, 'baratijas', 1).ok).toBe(false);
    rich(s, 1000, [3, 4, 5, 7]);
    actions.hireWorker(s, 'vendedor');
    const [r] = advanceCycles(s, 1);
    expect(r.revenue).toBe(0);
    expect(r.fixed).toBe(BALANCE.roleSalaries.vendedor);
  });
  it('respeta la demanda y la capacidad de atención manual', () => {
    const s = createGame('tiro', 5);
    rich(s, 10000, [], 1, 0);
    actions.buy(s, 'baratijas', 60);
    const res = actions.sell(s, 'baratijas', 60);
    expect(res.ok).toBe(true);
    expect(stockOf(s, 'baratijas')).toBeGreaterThanOrEqual(0);
    expect(s.manualCapacityLeft).toBeGreaterThanOrEqual(0);
  });
});

describe('Contabilidad y patrimonio (GDD §21, §23)', () => {
  it('comprar mercancía o un activo no altera el patrimonio (sin doble conteo)', () => {
    const s = createGame('tiro', 6);
    rich(s, 20000, [3, 5, 7, 8, 10]);
    const nw0 = netWorth(s);
    actions.buy(s, 'aceite', 10);
    expect(netWorth(s)).toBe(nw0);
    actions.buyVenue(s, 'local_alfareros');
    expect(netWorth(s)).toBe(nw0);
    expect(balanceSheet(s).venues).toBe(5000);
  });
  it('la caja de cada ciclo cuadra con el libro contable', () => {
    const s = createGame('tiro', 7);
    rich(s, 50000, [3, 4, 5, 7, 8, 9, 10, 14]);
    actions.rentVenue(s, 'puesto_plaza');
    actions.rentWarehouse(s, 'mediano');
    actions.hireWorker(s, 'vendedor', 'puesto_plaza');
    actions.hireWorker(s, 'almacenero');
    actions.setGoodSettings(s, 'vino_comun', { restockTarget: 100 });
    actions.buy(s, 'aceite', 50);
    for (const r of advanceCycles(s, 10)) {
      expect(Math.abs(r.cashEnd - r.cashStart - cashDelta(r))).toBeLessThan(0.05);
      expect(r.netProfit).toBeCloseTo(r.revenue - r.cogs - r.variable - r.fixed - r.interest - r.losses, 1);
    }
  });
  it('los costos fijos no se cobran dos veces y separan alquiler y propiedad', () => {
    const s = createGame('tiro', 8);
    rich(s, 50000, [3, 5, 7, 8, 10]);
    actions.rentVenue(s, 'puesto_plaza');
    actions.buyVenue(s, 'local_alfareros');
    actions.hireWorker(s, 'vendedor', 'puesto_plaza');
    const [r] = advanceCycles(s, 1);
    expect(r.lines['fixed.salarios']).toBe(50);
    expect(r.lines['fixed.alquiler_locales']).toBe(50);
    expect(r.lines['fixed.mantenimiento_propiedades']).toBe(45);
    expect(r.fixed).toBe(145);
  });
  it('sin caja, los costos fijos pasan a obligaciones vencidas y cuentan como pasivo', () => {
    const s = createGame('tiro', 9);
    rich(s, 0, [3, 5, 7]);
    actions.hireWorker(s, 'vendedor');
    advanceCycles(s, 1);
    expect(s.cash).toBe(0);
    expect(s.arrears).toBe(50);
    expect(balanceSheet(s).liabilities).toBe(50);
  });
});

describe('Negociación con proveedores (GDD §12.2)', () => {
  it('ref 100, mínimo 90: oferta 85 ⇒ contraoferta 90', () => {
    const s = createGame('tiro', 10);
    s.supplierOffers.push({ id: 'x', supplierName: 'Prueba', goodId: 'bronce', refPrice: 100, minQty: 100, maxQty: 400, floor: 90, minRank: 1, wholesale: false, attemptsLeft: 3, agreedPrice: null, counter: null, expires: 99 });
    const r = negotiate(s, 'x', 85);
    expect(r.data).toEqual({ outcome: 'contraoferta', price: 90 });
    expect(negotiate(s, 'x', 60).data?.outcome).toBe('rechazada');
    expect(actions.acceptCounter(s, 'x').ok).toBe(true);
    rich(s, 20000, [11], 15);
    expect(actions.purchaseFromSupplier(s, 'x', 50).ok).toBe(false); // compra mínima
    s.warehouses.push({ uid: 'w', defId: 'mediano', owned: false, bookValue: 0, acquiredCycle: 0 });
    expect(actions.purchaseFromSupplier(s, 'x', 100).ok).toBe(true);
    expect(s.inventory.bronce.avgCost).toBe(90);
    expect(s.stats.negotiationsWon).toBe(1);
  });
});

describe('Préstamos (GDD §16.2)', () => {
  it('10.000 al 15% en 10 ciclos ⇒ 10 cuotas de 1.150 separando capital e interés', () => {
    const s = createGame('tiro', 11);
    expect(quoteLoan(s, 10000, 10)).toMatchObject({ interest: 1500, total: 11500, installment: 1150, principalPart: 1000, interestPart: 150 });
    rich(s, 300000, [22]);
    const nw0 = netWorth(s);
    expect(actions.takeLoan(s, 10000, 10).ok).toBe(true);
    expect(netWorth(s)).toBe(nw0); // el capital recibido se compensa con el pasivo
    const reports = advanceCycles(s, 10);
    expect(reports[0].lines['loan_principal.prestamo']).toBe(1000);
    expect(reports[0].lines['interest.prestamos']).toBe(150);
    const totalInterest = reports.reduce((a, r) => a + (r.lines['interest.prestamos'] ?? 0), 0);
    expect(totalInterest).toBe(1500);
    expect(s.loans).toHaveLength(0);
  });
});

describe('Transporte marítimo (GDD §14.4)', () => {
  it('un viaje corto Tiro–Sidón en galera alquilada cuesta ≈ 1.100', () => {
    const s = createGame('tiro', 12);
    rich(s, 100000, [15, 16]);
    const sh = actions.rentShip(s, 'por_viaje').data!;
    const c = estimateVoyageCosts(s, sh.id, 'sidon', 'escolta', null, 400);
    expect(c.rent).toBe(500);
    expect(c.captain).toBe(150);
    expect(c.crew).toBe(200);
    expect(c.protection).toBe(100);
    expect(c.total).toBeGreaterThan(1000);
    expect(c.total).toBeLessThan(1200);
  });
  it('un viaje vende en destino, vuelve con carga y cuadra la contabilidad', () => {
    const s = createGame('tiro', 13);
    rich(s, 200000, [8, 15, 16]);
    actions.rentWarehouse(s, 'grande');
    actions.buy(s, 'tejidos_tenidos', 10);
    const sh = actions.rentShip(s).data!;
    const r = actions.launchVoyage(s, { shipId: sh.id, to: 'sidon', cargo: [{ goodId: 'tejidos_tenidos', qty: 10 }], returnOrders: [{ goodId: 'ceramica_fina', qty: 30, maxPrice: 0 }] });
    expect(r.ok).toBe(true);
    const reps = advanceCycles(s, 3);
    expect(s.voyages).toHaveLength(0);
    expect(s.stats.voyagesCompleted).toBe(1);
    expect(reps.some(x => (x.lines['revenue.maritime'] ?? 0) > 0)).toBe(true);
    for (const x of reps) expect(Math.abs(x.cashEnd - x.cashStart - cashDelta(x))).toBeLessThan(0.05);
  });
  it('las rutas automáticas despachan barcos por sí solas', () => {
    const s = createGame('tiro', 14);
    rich(s, 500000, [8, 15, 16, 19, 20]);
    actions.rentWarehouse(s, 'grande');
    actions.buy(s, 'tinte_purpura', 10);
    expect(actions.buyShip(s, 'mercante').ok).toBe(false);          // sin astillero no hay barco
    expect(actions.rentShipyard(s).ok).toBe(true);
    const sh = actions.buyShip(s, 'mercante').data!;
    expect(sh.underConstruction).toBeGreaterThan(0);
    advanceCycles(s, sh.underConstruction);
    expect(sh.underConstruction).toBe(0);
    const rt = actions.createAutoRoute(s, { to: 'sidon', shipId: sh.id, captainId: null, cargo: [{ goodId: 'tinte_purpura', qty: 10 }], returnOrders: [], frequency: 0, protection: 'ninguna' });
    expect(rt.ok).toBe(true);
    advanceCycles(s, 4);
    expect(s.autoRoutes[0].trips).toBeGreaterThanOrEqual(1);
    expect(s.ships[0].condition).toBeLessThan(1);
  });
});

describe('Progresión', () => {
  it('los hitos se alcanzan por patrimonio y desbloquean funciones', () => {
    const s = createGame('tiro', 15);
    expect(actions.hireWorker(s, 'vendedor').ok).toBe(false);
    s.cash = 300; advanceCycles(s, 1);
    expect(s.milestones).toContain(3);
    expect(actions.hireWorker(s, 'vendedor').ok).toBe(true);
    expect(actions.hireWorker(s, 'vendedor').ok).toBe(false); // hasta el hito 7
  });
  it('el nivel y el prestigio son independientes', () => {
    const s = createGame('tiro', 16);
    s.cash = 5_000_000; s.xp = 1e9;
    advanceCycles(s, 1);
    expect(s.level).toBeLessThan(15); // falta prestigio
  });
  it('partidas en distintas ciudades tienen economías distintas', () => {
    const a = createGame('tiro', 17), b = createGame('gadir', 17);
    a.markets.tiro.estano.factor = 1; b.markets.gadir.estano.factor = 1;
    expect(buyPrice(b, 'estano')).toBeLessThan(buyPrice(a, 'estano'));
    expect(a.knownRoutes).toEqual(['sidon']);
  });
  it('la simulación es determinista con la misma semilla', () => {
    const a = createGame('tiro', 99), b = createGame('tiro', 99);
    a.createdAt = b.createdAt = 0;
    advanceCycles(a, 30); advanceCycles(b, 30);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('Mora y bancarrota', () => {
  it('2.º ciclo en mora: embargo de mercancía que salda la deuda', () => {
    const s = createGame('tiro', 21);
    rich(s, 1000, [3, 5, 7]);
    actions.buy(s, 'aceite', 30);
    s.cash = 0;
    for (let i = 0; i < 3; i++) actions.hireWorker(s, 'vendedor');
    actions.setGoodSettings(s, 'aceite', { autoSell: false });
    advanceCycles(s, 1);
    expect(s.arrears).toBeGreaterThan(0);
    advanceCycles(s, 1);
    expect(s.ledger.some(e => e.key === 'revenue.liquidacion')).toBe(true);
  });
  it('la deuda vencida no crece sin límite: termina en bancarrota con operaciones cerradas', () => {
    const s = createGame('tiro', 22);
    rich(s, 0, [3, 5, 7]);
    for (let i = 0; i < 5; i++) actions.hireWorker(s, 'vendedor');
    advanceCycles(s, 40);
    expect(s.stats.bankrupt).toBe(true);
    expect(s.workers).toHaveLength(0);
    const a = s.arrears;
    advanceCycles(s, 20);
    expect(s.arrears).toBe(a); // congelada
  });
});

describe('Mejoras v2', () => {
  it('las carretas venden TODA la carga en el pueblo y vuelven', () => {
    const s = createGame('tiro', 31);
    rich(s, 20000, [30], 6, 50);
    expect(actions.rentStables(s).ok).toBe(true);
    s.inventory.lino = { qty: 100, avgCost: 30 };
    const r = actions.sendCart(s, 'burro', 'sarepta', [{ goodId: 'lino', qty: 100 }]);
    expect(r.ok).toBe(true);
    const reps = advanceCycles(s, 6);
    expect(s.landTrips).toHaveLength(0);
    expect(s.stats.landTrips).toBe(1);
    expect(reps.reduce((a, x) => a + (x.lines['revenue.tierra'] ?? 0), 0)).toBeGreaterThan(100 * 30);
  });
  it('el barco no llega antes del primer local y de las rutas por tierra', () => {
    const s = createGame('tiro', 32);
    s.cash = 60000; advanceCycles(s, 1);
    expect(s.milestones).not.toContain(15);
    s.venues.push({ defId: 'local_alfareros', owned: true, bookValue: 5000, acquiredCycle: 0 });
    advanceCycles(s, 1);
    expect(s.milestones).toContain(30);
    expect(s.milestones).not.toContain(15);
    s.stats.landTrips = 3; advanceCycles(s, 1);
    expect(s.milestones).toContain(15);
  });
  it('contrato exclusivo: tras 3.000 unidades compra sola cada ciclo', () => {
    const s = createGame('tiro', 33);
    rich(s, 5000, [8], 5, 50);
    s.warehouses.push({ uid: 'w', defId: 'grande', owned: false, bookValue: 0, acquiredCycle: 0 });
    expect(actions.setExclusive(s, 'aceite', 20).ok).toBe(false);
    s.goodStats.aceite = { units: 3000, revenue: 0, lastSale: 0, cycleUnits: 0, prevCycleUnits: 0 };
    expect(actions.setExclusive(s, 'aceite', 20).ok).toBe(true);
    s.workers = [];
    advanceCycles(s, 2);
    expect(stockOf(s, 'aceite')).toBe(40);
  });
  it('se pueden pagar las deudas pendientes en cualquier momento', () => {
    const s = createGame('tiro', 34);
    s.arrears = 300; s.cash = 500;
    expect(actions.payArrears(s).ok).toBe(true);
    expect(s.arrears).toBe(0); expect(s.cash).toBe(200);
  });
  it('los vendedores bajan el stock de forma gradual, no de golpe', () => {
    const s = createGame('tiro', 35);
    rich(s, 1000, [3, 5, 7], 3, 0);
    s.inventory.baratijas = { qty: 200, avgCost: 4 };
    actions.hireWorker(s, 'vendedor'); actions.hireWorker(s, 'vendedor');
    let prev = 200, maxDrop = 0;
    for (let i = 0; i < 120; i++) { advance(s, 0.25); const q = stockOf(s, 'baratijas'); maxDrop = Math.max(maxDrop, prev - q); prev = q; }
    expect(maxDrop).toBeLessThanOrEqual(3);
  });
  it('el puesto junto al templo no se puede alquilar sin el hito 13 si ya hay un puesto', async () => {
    const { venueBlock } = await import('../src/economy');
    const s = createGame('tiro', 36);
    rich(s, 5000, [5], 5, 50);
    actions.rentVenue(s, 'puesto_plaza');
    expect(venueBlock(s, 'puesto_templo', 'rent')).toMatch(/hito 13/);
  });
  it('vender en persona baja el stock de uno en uno', () => {
    const s = createGame('tiro', 40);
    actions.buy(s, 'baratijas', 4);
    expect(actions.queueSell(s, 'baratijas', 4).ok).toBe(true);
    expect(stockOf(s, 'baratijas')).toBe(4);                     // aún no se ha vendido nada
    let prev = 4, maxDrop = 0;
    for (let i = 0; i < 40; i++) { advance(s, 0.1); const q = stockOf(s, 'baratijas'); maxDrop = Math.max(maxDrop, prev - q); prev = q; }
    expect(stockOf(s, 'baratijas')).toBe(0);
    expect(maxDrop).toBeLessThanOrEqual(1);
    expect(s.stats.lifetimeRevenue).toBeGreaterThan(0);
  });
  it('los almaceneros reponen solos lo que se vende', () => {
    const s = createGame('tiro', 41);
    rich(s, 20000, [3, 5, 7, 8, 9], 5, 50);
    actions.rentWarehouse(s, 'mediano');
    expect(actions.hireWorker(s, 'almacenero').ok).toBe(true);
    s.goodStats.baratijas = { units: 200, revenue: 0, lastSale: 0, cycleUnits: 0, prevCycleUnits: 40 };
    advanceCycles(s, 1);
    expect(stockOf(s, 'baratijas')).toBeGreaterThan(0);
  });
  it('ya no existe el coordinador', () => {
    const s = createGame('tiro', 42);
    rich(s, 50000, [3, 7, 8, 9, 14], 8, 500);
    expect(actions.hireWorker(s, 'coordinador' as any).ok).toBe(false);
  });
  it('se puede dejar un almacén alquilado y devolver una galera', () => {
    const s = createGame('tiro', 43);
    rich(s, 60000, [8, 15]);
    actions.rentWarehouse(s, 'pequeno');
    expect(actions.releaseWarehouse(s, s.warehouses[0].uid).ok).toBe(true);
    expect(s.warehouses).toHaveLength(0);
    const g = actions.rentShip(s).data!;
    expect(actions.returnShip(s, g.id).ok).toBe(true);
    expect(s.ships).toHaveLength(0);
  });
  it('con un bloqueo portuario no se puede zarpar y los barcos en camino vuelven', () => {
    const s = createGame('tiro', 44);
    rich(s, 60000, [8, 15]);
    actions.rentWarehouse(s, 'grande');
    actions.buy(s, 'baratijas', 20);
    const to = s.knownRoutes[0];
    const g = actions.rentShip(s).data!;
    expect(actions.launchVoyage(s, { shipId: g.id, to, cargo: [{ goodId: 'baratijas', qty: 20 }] }).ok).toBe(true);
    s.events.push({ id: 'b', defId: 'bloqueo_portuario', name: 'Bloqueo portuario', description: '', startCycle: 0, endCycle: 99, effects: { blockedPort: to } });
    advanceCycles(s, 1);
    expect(s.voyages[0]?.phase ?? 'terminado').not.toBe('ida');
    const g2 = actions.rentShip(s).data!;
    expect(actions.launchVoyage(s, { shipId: g2.id, to, cargo: [] }).ok).toBe(false);
  });
  it('talleres, monopolios y tesoro del templo funcionan', () => {
    const s = createGame('tiro', 45);
    rich(s, 12000000, [23, 28, 29, 31]);
    const before = buyPrice(s, 'ceramica_sencilla');
    expect(actions.buyWorkshop(s, 'alfareria').ok).toBe(true);
    expect(buyPrice(s, 'ceramica_sencilla')).toBeLessThan(before);
    s.goodStats.aceite = { units: 3000, revenue: 0, lastSale: 0, cycleUnits: 0, prevCycleUnits: 0 };
    expect(actions.setMonopoly(s, 'aceite', true).ok).toBe(false);   // necesita exclusivo activo
    actions.setExclusive(s, 'aceite', 10);
    const p0 = sellPrice(s, 'aceite');
    expect(actions.setMonopoly(s, 'aceite', true).ok).toBe(true);
    expect(sellPrice(s, 'aceite')).toBeGreaterThan(p0);
    expect(actions.deposit(s, 1000000).ok).toBe(true);
    const nw = netWorth(s);
    advanceCycles(s, 1);
    expect(s.treasury).toBeGreaterThan(1000000);
    expect(actions.withdraw(s, s.treasury).ok).toBe(true);
    expect(s.treasury).toBe(0);
    expect(nw).toBeGreaterThan(0);
  });
});
