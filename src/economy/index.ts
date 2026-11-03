// ============================================================================
// FENICIA · API pública del motor económico.
// La interfaz sólo debe usar estas funciones: cada acción devuelve ActionResult
// y actualiza hitos y niveles automáticamente.
// ============================================================================
import * as business from './business';
import * as commerce from './commerce';
import * as finance from './finance';
import * as maritime from './maritime';
import * as land from './land';
import * as invest from './invest';
import { afterAction } from './simulation';
import type { ActionResult, GameState } from './types';

type Fn = (s: GameState, ...args: any[]) => ActionResult<any>;
function wrap<T extends Fn>(fn: T): T {
  return ((s: GameState, ...args: any[]) => { const r = fn(s, ...args); if (r.ok) afterAction(s); return r; }) as T;
}

export const actions = {
  // Comercio
  buy: wrap(commerce.buy),
  sell: wrap(commerce.sell),
  queueSell: wrap(commerce.queueSell),
  cancelSell: wrap(commerce.cancelSell),
  distribute: wrap(commerce.distribute),
  setGoodSettings: wrap(commerce.setGoodSettings),
  negotiate: wrap(commerce.negotiate),
  acceptCounter: wrap(commerce.acceptCounter),
  purchaseFromSupplier: wrap(commerce.purchaseFromSupplier),
  acceptContract: wrap(commerce.acceptContract),
  deliverContract: wrap(commerce.deliverContract),
  // Negocio
  hireWorker: wrap(business.hireWorker),
  fireWorker: wrap(business.fireWorker),
  assignWorker: wrap(business.assignWorker),
  rentVenue: wrap(business.rentVenue),
  buyVenue: wrap(business.buyVenue),
  releaseVenue: wrap(business.releaseVenue),
  sellVenue: wrap(business.sellVenue),
  rentWarehouse: wrap(business.rentWarehouse),
  buyWarehouse: wrap(business.buyWarehouse),
  releaseWarehouse: wrap(business.releaseWarehouse),
  // Marítimo
  rentShip: wrap(maritime.rentShip),
  returnShip: wrap(maritime.returnShip),
  buyShip: wrap(maritime.buyShip),
  sellShip: wrap(maritime.sellShip),
  hireCaptain: wrap(maritime.hireCaptain),
  fireCaptain: wrap(maritime.fireCaptain),
  launchVoyage: wrap(maritime.launchVoyage),
  fundExpedition: wrap(maritime.fundExpedition),
  createAutoRoute: wrap(maritime.createAutoRoute),
  setRouteActive: wrap(maritime.setRouteActive),
  deleteRoute: wrap(maritime.deleteRoute),
  buyShipyard: wrap(maritime.buyShipyard),
  buildShip: wrap(maritime.buildShip),
  repairShip: wrap(maritime.repairShip),
  upgradeShip: wrap(maritime.upgradeShip),
  // Rutas por tierra
  rentStables: wrap(land.rentStables),
  buyStables: wrap(land.buyStables),
  upgradeStables: wrap(land.upgradeStables),
  sendCart: wrap(land.sendCart),
  // Contrato exclusivo
  setExclusive: wrap(commerce.setExclusive),
  // Inversiones y astillero de la ciudad
  rentShipyard: wrap(invest.rentShipyard),
  releaseShipyard: wrap(invest.releaseShipyard),
  buyWorkshop: wrap(invest.buyWorkshop),
  sellWorkshop: wrap(invest.sellWorkshop),
  setMonopoly: wrap(invest.setMonopoly),
  deposit: wrap(invest.deposit),
  withdraw: wrap(invest.withdraw),
  // Finanzas
  payArrears: wrap(finance.payArrearsNow),
  takeLoan: wrap(finance.takeLoan),
  repayLoan: wrap(finance.repayLoan),
};

export { createGame } from './state';
export { advance, advanceCycles, setSpeed, closeCycle } from './simulation';
export { balanceSheet, netWorth, prestigeRank, prestigeRankName, levelProgress, hasMilestone, goodUnlocked, goodLockReason, unlockedGoods } from './progression';
export { buyPrice, sellPrice, wholesalePrice, portSalePrice, availableDemand, availableSupply, availableWholesale, demandPerCycle } from './market';
export { fixedCostBreakdown, fixedCostTotal, recommendedReserve, salaryFor, venueRent, venueUpkeep, warehouseRent, warehouseUpkeep } from './costs';
export { storageCapacity, inventoryUnits, freeStorage, stockOf, inventoryValue } from './inventory';
export { salesCapacity, workerLimit, slotsUsed, slotsTotal, venueBlock, warehouseBlock, canHire } from './business';
export { TOWNS, CARTS, STABLES, towns, townById, cartSlots, legCyclesLand, townUnitPrice, tripCosts, estimateTrip } from './land';
export { exclusiveAvailable, queuedFor } from './commerce';
export { restockTargetOf } from './automation';
export { monopolyBlock } from './invest';
export { WORKSHOPS, MONOPOLY_FEE, MONOPOLY_MAX, TREASURY_RATE } from './data/invest';
export { isPortBlocked } from './market';
export { migrate } from './state';
export { maxBuyable, settingsOf } from './commerce';
export { estimateVoyageCosts, estimateVoyageProfit, legCycles, piracyChance, shipCapacity, expeditionRequired, expeditionChance, repairCost } from './maritime';
export { creditAvailable, quoteLoan, loanRate } from './finance';
export { LEDGER_LABELS } from './ledger';
export { SaveManager, serialize, deserialize } from './save';
export type { KeyValueStore, SaveSummary } from './save';
export { BALANCE } from './balance';
export { GOODS, GOOD_BY_ID } from './data/goods';
export { PORTS, PORT_BY_ID, seaDistanceKm } from './data/ports';
export { VENUES, WAREHOUSES, SHIPS, ROLES, LEVELS, MILESTONES, MILESTONE_ORDER, MILESTONE_FAMILY, milestoneNo, milestoneText, PRESTIGE_RANKS } from './data/catalog';
export { EVENTS } from './data/events';
export type * from './types';
