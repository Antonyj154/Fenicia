// ============================================================================
// FENICIA · Tipos del motor económico
// Todo el estado es JSON serializable (sin Map/Set/clases) para poder guardarlo.
// ============================================================================

export type Speed = 0 | 1 | 6;
export type GoodId = string;
export type PortId = string;
export type Difficulty = 'facil' | 'media' | 'dificil';

export type GoodCategory =
  | 'artesania' | 'ceramica' | 'vidrio' | 'alimento' | 'textil' | 'metal'
  | 'joyeria' | 'madera' | 'lujo' | 'especia' | 'mayorista';

// ---------------------------------------------------------------------------
// Definiciones estáticas (datos de diseño)
// ---------------------------------------------------------------------------

export interface GoodDef {
  id: GoodId;
  name: string;
  buy: number;              // precio de compra de referencia (GDD §6)
  sell: number;             // precio de venta de referencia (GDD §6)
  unlockLevel: number;      // nivel comercial de desbloqueo
  category: GoodCategory;
  retailDemand: number;     // unidades/ciclo que compran los clientes en la ciudad de referencia
  minPrestigeRank: number;  // rango de prestigio mínimo (mercancías restringidas)
}

export interface CostMods {
  wages: number;     // salarios
  rent: number;      // alquileres
  property: number;  // mantenimiento e impuestos de propiedades
  maritime: number;  // costos marítimos
  portFee: number;   // tasa portuaria base por escala
}

export interface PortDef {
  id: PortId;
  name: string;
  lat: number;
  lon: number;
  playable: boolean;
  difficulty?: Difficulty;
  specialties: string;
  description: string;
  priceMods: Partial<Record<GoodCategory, number>>;  // nivel de precios local
  supplyMods: Partial<Record<GoodCategory, number>>; // abundancia de oferta
  demandMods: Partial<Record<GoodCategory, number>>; // apetito de compra
  competition: number;   // 0..1 – reduce la demanda minorista disponible
  costs: CostMods;
  loanRate: number;      // interés total por contrato (GDD §16)
  piracy: number;        // riesgo base de piratería por tramo de viaje hacia/desde aquí
}

export type VenueKind = 'puesto' | 'local';

export interface VenueDef {
  id: string;
  name: string;
  kind: VenueKind;
  traffic: number;      // multiplicador de ventas por trabajador
  slots: number;        // trabajadores máximos
  storage: number;      // unidades de inventario
  rent: number;         // alquiler/ciclo (antes de modificador de ciudad)
  price: number;        // compra (0 = no se vende)
  upkeep: number;       // mantenimiento + impuestos/ciclo si es propio
  minMilestone: number; // hito necesario para alquilar
}

export interface WarehouseDef {
  id: string;
  name: string;
  capacity: number;
  rent: number;
  price: number;
  upkeep: number;
  minMilestone: number;
}

export type ShipClass = 'galera_alquiler' | 'mercante' | 'avanzado';

export interface ShipDef {
  id: ShipClass;
  name: string;
  capacity: number;
  speed: number;          // km por ciclo
  defense: number;        // 0..1 reducción de piratería
  price: number;          // 0 = sólo alquiler
  rentPerCycle: number;   // alquiler por ciclo de viaje (contrato por viaje)
  upkeep: number;         // mantenimiento/ciclo (barco propio)
  mooring: number;        // amarre/ciclo (barco propio)
  crewPerCycle: number;   // tripulación por ciclo de viaje
  buildCycles: number;    // ciclos de construcción en astillero
}

export type WorkerRole = 'vendedor' | 'almacenero';

export interface RoleDef {
  id: WorkerRole;
  name: string;
  salary: number;
  capacity: number;     // unidades/ciclo
  description: string;
  minMilestone: number;
}

export interface LevelDef {
  level: number;
  xp: number;           // experiencia acumulada necesaria
  netWorth: number;     // patrimonio mínimo
  prestigeRank: number; // rango de prestigio mínimo (1..10)
  category: string;
}

export interface MilestoneDef {
  id: number;
  name: string;
  condition: string;        // texto mostrado
  unlocks: string;          // qué habilita
  pending?: boolean;        // funcionalidad prevista pero sin reglas aún (GDD §20)
}

// ---------------------------------------------------------------------------
// Estado dinámico
// ---------------------------------------------------------------------------

export interface StockLot { qty: number; avgCost: number }

export interface MarketGood {
  factor: number;      // fluctuación de precio (≈1)
  demand: number;      // pool de demanda minorista (local) o de importación (puerto extranjero)
  wholesale: number;   // pool de demanda mayorista (sólo ciudad local)
  supply: number;      // pool de oferta disponible en el mercado
  pressure: number;    // presión acumulada por compras/ventas del jugador
}

export interface GoodSettings {
  autoSell: boolean;         // los vendedores pueden venderla
  minSellPrice: number;      // 0 = sin mínimo
  restockTarget: number;     // los almaceneros reponen hasta esta cantidad (-1 = automático, 0 = no)
  restockMaxPrice: number;   // 0 = sin máximo (especulación: sólo comprar barato)
}

export interface Worker {
  id: string;
  name: string;
  role: WorkerRole;
  venueId: string | null;   // null = ambulante
  salary: number;
  hiredCycle: number;
}

export interface OwnedVenue {
  defId: string;
  owned: boolean;          // true = propio, false = alquilado
  bookValue: number;
  acquiredCycle: number;
}

export interface OwnedWarehouse {
  uid: string;
  defId: string;
  owned: boolean;
  bookValue: number;
  acquiredCycle: number;
}

export interface Captain {
  id: string;
  name: string;
  skill: number;            // 0..1
  salary: number;
  assignedShipId: string | null;
}

export type RentalContract = 'por_viaje' | 'por_ciclo';

export interface Ship {
  id: string;
  name: string;
  cls: ShipClass;
  owned: boolean;
  rental: RentalContract | null;
  condition: number;        // 0..1 (sólo relevante en barcos propios)
  bookValue: number;
  capacityBonus: number;    // mejoras de astillero (fracción)
  speedBonus: number;
  defenseBonus: number;
  voyageId: string | null;
  underConstruction: number; // ciclos restantes; 0 = operativo
}

export type Protection = 'ninguna' | 'escolta' | 'flotilla';

export interface CargoLot { goodId: GoodId; qty: number; avgCost: number }

export interface ReturnOrder { goodId: GoodId; qty: number; maxPrice: number }

export interface VoyageCosts {
  rent: number; captain: number; crew: number; loading: number;
  portFees: number; protection: number; total: number;
}

export type VoyagePhase = 'ida' | 'puerto' | 'vuelta' | 'terminado';

export interface Voyage {
  id: string;
  shipId: string;
  captainId: string | null;     // null = capitán contratado por viaje
  routeId: string;
  from: PortId;
  to: PortId;
  phase: VoyagePhase;
  cyclesLeft: number;
  legCycles: number;
  cargo: CargoLot[];
  returnOrders: ReturnOrder[];
  protection: Protection;
  costs: VoyageCosts;
  revenue: number;
  cogs: number;
  lost: number;               // valor de costo perdido por piratería
  log: string[];
  automatedRouteId: string | null;
  turnedBack?: boolean;       // volvió sin llegar (bloqueo portuario)
}

export interface CargoOrder { goodId: GoodId; qty: number }

export interface AutoRoute {
  id: string;
  name: string;
  to: PortId;
  shipId: string;
  captainId: string | null;
  cargo: CargoOrder[];
  returnOrders: ReturnOrder[];
  frequency: number;          // ciclos entre salidas (0 = en cuanto vuelve)
  protection: Protection;
  active: boolean;
  lastDeparture: number;
  trips: number;
  profitTotal: number;
}

export interface Expedition {
  id: string;
  target: PortId;
  budget: number;
  required: number;
  cyclesLeft: number;
  chance: number;
}

export interface Loan {
  id: string;
  principal: number;
  rate: number;              // interés total del contrato
  term: number;              // ciclos
  remainingPrincipal: number;
  remainingInterest: number;
  installmentsLeft: number;
  installment: number;
  principalPart: number;
  interestPart: number;
  takenCycle: number;
  missed: number;
}

export interface Contract {
  id: string;
  kind: 'local' | 'internacional';
  goodId: GoodId;
  qty: number;
  delivered: number;
  unitPrice: number;
  port: PortId | null;          // destino para internacionales
  deadline: number;             // ciclo límite
  prestige: number;
  minRank: number;
  status: 'oferta' | 'aceptado' | 'cumplido' | 'fallido' | 'expirado';
  offerExpires: number;
}

export interface SupplierOffer {
  id: string;
  supplierName: string;
  goodId: GoodId;
  refPrice: number;
  minQty: number;
  maxQty: number;
  floor: number;        // precio mínimo oculto
  minRank: number;
  wholesale: boolean;   // lote de compra mayorista (hito 12)
  attemptsLeft: number;
  agreedPrice: number | null;
  counter: number | null;
  expires: number;
}

export interface EventEffects {
  priceMods?: Record<string, number>;   // clave = categoría o id de mercancía
  demandMods?: Record<string, number>;
  supplyMods?: Record<string, number>;
  wholesaleMult?: number;
  piracyMult?: number;
  fixedCostMult?: number;               // alquileres, impuestos y mantenimiento
  portFeeMult?: number;
  blockedPort?: PortId;
  supplierDiscount?: number;
  supplierCategory?: GoodCategory;
  discoverPort?: PortId;
}

export interface ActiveEvent {
  id: string;
  defId: string;
  name: string;
  description: string;
  startCycle: number;
  endCycle: number;
  effects: EventEffects;
}

export interface Notification {
  cycle: number;
  kind: 'info' | 'exito' | 'alerta' | 'evento' | 'hito' | 'nivel';
  text: string;
}

export interface LedgerEntry {
  cycle: number;
  key: string;      // cuenta.subcuenta – ej. "fixed.salarios"
  amount: number;   // siempre positivo; el signo lo define la cuenta
  note?: string;
}

export interface CycleReport {
  cycle: number;
  lines: Record<string, number>;   // totales por clave de cuenta
  cashStart: number;
  cashEnd: number;
  netWorth: number;
  revenue: number;
  cogs: number;
  variable: number;
  fixed: number;
  interest: number;
  losses: number;
  netProfit: number;
  unitsSold: number;
}

export interface Stats {
  lifetimeRevenue: number;
  lifetimeUnitsSold: number;
  lifetimeProfit: number;
  manualSalesRevenue: number;
  voyagesCompleted: number;
  contractsFulfilled: number;
  contractsFailed: number;
  negotiationsWon: number;
  expeditionsLaunched: number;
  expeditionsSucceeded: number;
  routesDiscovered: number;
  unitsSoldRewardIndex: number;
  loansRepaid: number;
  peakNetWorth: number;
  cyclesInArrears: number;
  arrearsStreak: number;
  bankrupt: boolean;
  landTrips: number;
}

// ---------------------------------------------------------------------------
// Rutas por tierra (Caballerizas)
// ---------------------------------------------------------------------------
export type CartClass = 'burro' | 'bueyes' | 'caravana';
export interface TownDef { id: string; name: string; km: number; size: number; buys: Partial<Record<GoodCategory, number>>; bandits: number; specialties: string }
export interface Stables { owned: boolean; level: 1 | 2; bookValue: number }
export interface LandTrip {
  id: string; cart: CartClass; town: string; phase: 'ida' | 'vuelta'; cyclesLeft: number; legCycles: number;
  cargo: CargoLot[]; costs: number; revenue: number; cogs: number; lost: number;
}
export interface GoodStat { units: number; revenue: number; lastSale: number; cycleUnits: number; prevCycleUnits: number }
export interface ExclusiveContract { goodId: string; qty: number; price: number; active: boolean; failedCycles: number }

export interface GameState {
  version: number;
  id: string;
  seed: number;
  rng: number;
  cityId: PortId;
  playerName: string;
  createdAt: number;

  time: { speed: Speed; simSeconds: number; cycle: number; cycleElapsed: number };

  cash: number;
  arrears: number;                     // obligaciones vencidas sin pagar

  inventory: Record<GoodId, StockLot>;
  goodSettings: Record<GoodId, GoodSettings>;
  markets: Record<PortId, Record<GoodId, MarketGood>>;

  manualCapacityLeft: number;          // clientes que el jugador puede atender en este ciclo
  workers: Worker[];
  workerAccum: Record<WorkerRole, number>; // capacidad fraccionaria acumulada
  venues: OwnedVenue[];
  warehouses: OwnedWarehouse[];

  ships: Ship[];
  captains: Captain[];
  voyages: Voyage[];
  knownRoutes: PortId[];               // puertos con ruta descubierta desde la ciudad
  autoRoutes: AutoRoute[];
  expeditions: Expedition[];
  hasShipyard: boolean;

  loans: Loan[];
  contracts: Contract[];
  supplierOffers: SupplierOffer[];
  events: ActiveEvent[];

  xp: number;
  level: number;
  prestige: number;
  milestones: number[];                // ids alcanzados

  stats: Stats;
  current: CycleReport;                // ciclo en curso (acumulando)
  history: CycleReport[];              // últimos ciclos cerrados
  ledger: LedgerEntry[];               // últimos movimientos
  notifications: Notification[];
  idCounter: number;
  // v2
  stables: Stables | null;
  landTrips: LandTrip[];
  townPressure: Record<string, Record<string, number>>;
  goodStats: Record<GoodId, GoodStat>;
  exclusives: ExclusiveContract[];
  seenIntros: string[];
  // v3
  sellQueue: SellOrder[];              // ventas en persona en curso: el stock baja de uno en uno
  sellAcc: number;
  shipyardRented: boolean;             // contrato con el astillero de la ciudad (encargar barcos)
  workshops: string[];                 // participaciones en talleres (hito 23)
  monopolies: string[];                // mercancías en monopolio (hito 28)
  treasury: number;                    // depósito en el tesoro del templo (hito 29)
}

export interface SellOrder { goodId: GoodId; qty: number; waiting?: string }

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  warning?: string;
  data?: T;
}
