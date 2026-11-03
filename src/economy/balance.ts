// ============================================================================
// FENICIA · Parámetros de balance (todos los valores ajustables en un solo lugar)
// Los valores marcados [GDD] vienen del documento; el resto es propuesta de balance.
// ============================================================================

export const BALANCE = {
  // Tiempo [GDD §3]
  cycleSeconds: 60,
  maxStepSeconds: 1,                // paso interno de simulación

  // Jugador
  startingCash: 20,                 // [GDD §2]
  baseStorage: 60,                  // cesta y carro del vendedor ambulante
  manualCustomersPerCycle: 50,
  manualSalesPerSecond: 3,          // ventas en persona: unidades por segundo de juego (el stock baja de uno en uno)      // clientes que el jugador atiende en persona por ciclo
  ambulantSlots: 2,                 // trabajadores ambulantes (sin establecimiento)
  maxWorkersBeforeMilestone7: 1,
  maxPuestosBeforeMilestone13: 1,
  maxLocalesBeforeMilestone13: 1,

  // Mercado [GDD §17]
  priceMeanReversion: 0.82,         // fracción de la desviación que se conserva por ciclo
  priceVolatility: 0.045,           // desviación típica del ruido por ciclo
  priceFactorMin: 0.7,
  priceFactorMax: 1.45,
  pressureImpact: 0.012,            // cambio de precio por agotar un pool completo (saturación sostenida ≈ −10%)
  supplyPerDemand: 8,               // oferta del mercado = demanda minorista × esto
  wholesalePerDemand: 12,           // demanda de comerciantes = demanda minorista × esto [GDD §13]
  wholesaleMarkup: 1.10,            // precio mayorista = compra × 1,10 [GDD §13 ejemplo]
  distributionLogistics: 0.03,      // costo logístico por unidad distribuida (fracción del valor)
  foreignImportPerDemand: 9,       // demanda de importación de un puerto extranjero
  foreignPoolCycles: 3,             // ciclos de demanda que se acumulan en un puerto extranjero
  foreignSaleDiscount: 0.85,        // los comerciantes del puerto compran al 85% del precio minorista local
  foreignExportPerDemand: 10,

  // Proveedores y negociación [GDD §12]
  supplierRefDiscount: 0.97,
  negotiationDiscountMin: 0.06,
  negotiationDiscountMax: 0.14,
  wholesaleExtraDiscount: 0.05,
  negotiationAttempts: 3,
  supplierLotValue: 2500,           // valor mínimo de la compra mínima
  supplierLotNetWorthFrac: 0.03,    // los lotes crecen con tu patrimonio (3%)
  supplierOffers: 6,
  wholesaleLotMult: 5,

  // Personal [GDD §9]
  roleSalaries: { vendedor: 50, almacenero: 70 },
  coordinatorLoadingDiscount: 0.5,

  // Marítimo [GDD §14]
  captainPerVoyageFeePerCycle: 75,
  captainPerVoyageSkill: 0.25,
  captainSalaryBase: 350,
  loadingPerUnit: 0.12,              // carga o descarga, por unidad
  protection: { ninguna: { perCycle: 0, reduction: 0 }, escolta: { perCycle: 50, reduction: 0.45 }, flotilla: { perCycle: 160, reduction: 0.8 } },
  piracyLossMin: 0.15,
  piracyLossMax: 0.4,
  piracyDamage: 0.15,
  wearPerLeg: 0.02,                  // desgaste base por tramo
  wearPerKm: 0.000006,
  repairCostFactor: 0.25,            // costo = precio × desgaste reparado × factor
  shipyardRepairDiscount: 0.5,
  shipyardBuildDiscount: 0.7,
  shipMinCondition: 0.15,
  routeUpkeepBase: 300,               // mantenimiento por ruta automática y ciclo
  routeUpkeepPerKm: 0.3,
  rentalPerCycleDiscount: 0.8,       // contrato por ciclo = 80% de la tarifa por viaje
  maxRentedShips: 2,
  expeditionBase: 15000,
  expeditionPerKm: 9,
  expeditionMaxChance: 0.95,

  voyageSpeedFactor: 0.6,            // mejora 9: los viajes duran más
  portBulkDiscount: 0.75,            // lo que no absorbe el mercado del puerto se vende al 75%

  // Astillero [GDD §15]
  shipyardPrice: 1500000,
  shipyardRent: 900,                 // contrato con el astillero de la ciudad (hito 20)
  shipyardStaff: 1200,
  shipyardUpkeep: 800,
  upgrades: {
    bodega:  { name: 'Ampliar bodega',  costFrac: 0.2,  capacity: 0.25 },
    velas:   { name: 'Velas mejoradas', costFrac: 0.15, speed: 0.15 },
    casco:   { name: 'Casco reforzado', costFrac: 0.15, defense: 0.15 },
  },

  // Préstamos [GDD §16] – interés total por contrato, cuotas fijas por ciclo
  loanTerms: [10, 20, 30],
  loanCreditFraction: 0.4,           // límite de crédito total = 40% del patrimonio neto
  maxLoans: 3,
  arrearsSurcharge: 0.05,            // recargo por ciclo sobre obligaciones vencidas
  arrearsSeizeInventory: 2,          // ciclos seguidos en mora antes del embargo de mercancía
  arrearsStreakPenalty: 3,           // ciclos seguidos en mora antes de perder personal/alquileres y remates
  restockReserveCycles: 1,           // compras automáticas conservan un ciclo de costos fijos y cuotas en caja
  liquidationInventory: 0.6,         // los acreedores rematan inventario al 60% del precio de compra
  liquidationAssets: 0.5,            // y activos al 50% de su valor contable

  // Prestigio [GDD §19]
  prestige: {
    perVoyage: 6,
    perVoyagePer1000Km: 4,
    perOwnedPropertyCycle: 0.4,
    perActiveRouteCycle: 0.8,
    perDiscovery: 120,
    perLoanRepaid: 60,
    missedPayment: -40,
    arrearsCycle: -6,
    unitsSoldSteps: [100, 500, 2000, 5000, 15000, 50000, 150000, 500000, 1500000],
    unitsSoldReward: [10, 15, 25, 40, 70, 120, 200, 350, 600],
    contractFailMult: 1.5,
  },

  // Contrato exclusivo (mejora 1.4)
  exclusiveUnits: 3000,
  exclusiveDiscount: 0.9,

  // Contratos
  contractChancePerCycle: 0.35,
  maxContractOffers: 3,
  contractPremium: 1.18,
  intlContractPremium: 1.25,

  // Eventos
  eventChancePerCycle: 0.12,
  maxActiveEvents: 2,

  // Experiencia
  xpPerMarginCoin: 1,
  xpPerMilestone: (id: number) => 15 * id * id,

  // Historial
  historyLength: 120,
  ledgerLength: 400,
  notificationsLength: 80,
};

export type Balance = typeof BALANCE;
