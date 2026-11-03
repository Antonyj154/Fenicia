import type { LevelDef, MilestoneDef, RoleDef, ShipDef, VenueDef, WarehouseDef } from '../types';

// ---------------------------------------------------------------------------
// Establecimientos (GDD §10). Cada ubicación es única en la ciudad.
// traffic multiplica la capacidad de venta de cada trabajador asignado.
// ---------------------------------------------------------------------------
export const VENUES: VenueDef[] = [
  { id: 'puesto_plaza',   name: 'Puesto en la plaza',         kind: 'puesto', traffic: 2.0, slots: 2, storage: 100,  rent: 50,   price: 0,      upkeep: 0,   minMilestone: 5 },
  { id: 'puesto_puerto',  name: 'Puesto del puerto',          kind: 'puesto', traffic: 2.3, slots: 2, storage: 100,  rent: 70,   price: 0,      upkeep: 0,   minMilestone: 5 },
  { id: 'puesto_templo',  name: 'Puesto junto al templo',     kind: 'puesto', traffic: 2.6, slots: 3, storage: 120,  rent: 95,   price: 0,      upkeep: 0,   minMilestone: 5 },
  { id: 'local_alfareros',name: 'Local en la calle de los alfareros', kind: 'local', traffic: 2.5, slots: 3, storage: 300, rent: 110, price: 5000, upkeep: 45, minMilestone: 10 },
  { id: 'local_mercado',  name: 'Local del mercado central',  kind: 'local',  traffic: 3.0, slots: 4, storage: 400,  rent: 220,  price: 12000,  upkeep: 90,  minMilestone: 10 },
  { id: 'casa_comercio',  name: 'Casa de comercio del puerto',kind: 'local',  traffic: 3.5, slots: 6, storage: 800,  rent: 450,  price: 30000,  upkeep: 180, minMilestone: 13 },
  { id: 'gran_bazar',     name: 'Gran bazar',                 kind: 'local',  traffic: 4.0, slots: 8, storage: 1500, rent: 1000, price: 80000,  upkeep: 400, minMilestone: 13 },
];

// ---------------------------------------------------------------------------
// Almacenes (GDD §11 capacidad y alquiler; §8.3 precios de compra)
// ---------------------------------------------------------------------------
export const WAREHOUSES: WarehouseDef[] = [
  { id: 'pequeno',   name: 'Almacén pequeño',   capacity: 100,   rent: 15,   price: 8000,    upkeep: 6,   minMilestone: 8 },
  { id: 'mediano',   name: 'Almacén mediano',   capacity: 500,   rent: 60,   price: 25000,   upkeep: 25,  minMilestone: 8 },
  { id: 'grande',    name: 'Almacén grande',    capacity: 2000,  rent: 180,  price: 80000,   upkeep: 75,  minMilestone: 8 },
  { id: 'portuario', name: 'Almacén portuario', capacity: 10000, rent: 600,  price: 250000,  upkeep: 250, minMilestone: 18 },
  { id: 'comercial', name: 'Almacén comercial', capacity: 50000, rent: 2000, price: 900000,  upkeep: 800, minMilestone: 18 },
];

// ---------------------------------------------------------------------------
// Embarcaciones (GDD §14, §8.3)
// ---------------------------------------------------------------------------
export const SHIPS: Record<string, ShipDef> = {
  galera_alquiler: { id: 'galera_alquiler', name: 'Galera de alquiler', capacity: 600,  speed: 240, defense: 0,    price: 0,      rentPerCycle: 250, upkeep: 0,    mooring: 0,   crewPerCycle: 100, buildCycles: 0 },
  mercante:        { id: 'mercante',        name: 'Barco mercante',     capacity: 1500, speed: 300, defense: 0.1,  price: 150000, rentPerCycle: 0,   upkeep: 1600, mooring: 250,  crewPerCycle: 180, buildCycles: 10 },
  avanzado:        { id: 'avanzado',        name: 'Barco avanzado',     capacity: 4000, speed: 380, defense: 0.35, price: 450000, rentPerCycle: 0,   upkeep: 4000, mooring: 500, crewPerCycle: 420, buildCycles: 20 },
};

// ---------------------------------------------------------------------------
// Roles de trabajadores (GDD §9)
// ---------------------------------------------------------------------------
export const ROLES: Record<string, RoleDef> = {
  vendedor:    { id: 'vendedor',    name: 'Vendedor',    salary: 50,  capacity: 100,  minMilestone: 3,  description: 'Atiende clientes y vende mercancía del inventario.' },
  almacenero:  { id: 'almacenero',  name: 'Almacenero',  salary: 70,  capacity: 400,  minMilestone: 9,  description: 'Repone inventario comprando en el mercado según tus objetivos.' },
};

// ---------------------------------------------------------------------------
// Niveles comerciales (GDD §5). Requisitos propuestos en el balance.
// ---------------------------------------------------------------------------
const CAT = ['Comerciante independiente', 'Pequeño empresario', 'Comerciante establecido', 'Armador comercial', 'Empresario marítimo', 'Magnate comercial'];
export const LEVELS: LevelDef[] = [
  { level: 1, xp: 0, netWorth: 0, prestigeRank: 1, category: CAT[0] },
  { level: 2, xp: 900, netWorth: 120, prestigeRank: 1, category: CAT[0] },
  { level: 3, xp: 3000, netWorth: 350, prestigeRank: 1, category: CAT[0] },
  { level: 4, xp: 8000, netWorth: 900, prestigeRank: 1, category: CAT[1] },
  { level: 5, xp: 18000, netWorth: 2200, prestigeRank: 1, category: CAT[1] },
  { level: 6, xp: 38000, netWorth: 6000, prestigeRank: 2, category: CAT[1] },
  { level: 7, xp: 65000, netWorth: 11000, prestigeRank: 2, category: CAT[2] },
  { level: 8, xp: 100000, netWorth: 18000, prestigeRank: 2, category: CAT[2] },
  { level: 9, xp: 150000, netWorth: 28000, prestigeRank: 3, category: CAT[2] },
  { level: 10, xp: 220000, netWorth: 45000, prestigeRank: 3, category: CAT[3] },
  { level: 11, xp: 320000, netWorth: 70000, prestigeRank: 4, category: CAT[3] },
  { level: 12, xp: 460000, netWorth: 110000, prestigeRank: 4, category: CAT[3] },
  { level: 13, xp: 680000, netWorth: 170000, prestigeRank: 5, category: CAT[4] },
  { level: 14, xp: 1800000, netWorth: 540000, prestigeRank: 6, category: CAT[4] },
  { level: 15, xp: 4500000, netWorth: 1600000, prestigeRank: 7, category: CAT[5] },
];

// ---------------------------------------------------------------------------
// Rangos de prestigio (GDD §19) – puntos acumulados necesarios
// ---------------------------------------------------------------------------
export const PRESTIGE_RANKS: { rank: number; name: string; points: number }[] = [
  { rank: 1,  name: 'Vendedor',            points: 0 },
  { rank: 2,  name: 'Comerciante',         points: 40 },
  { rank: 3,  name: 'Mercader reconocido', points: 150 },
  { rank: 4,  name: 'Empresario',          points: 400 },
  { rank: 5,  name: 'Gran comerciante',    points: 900 },
  { rank: 6,  name: 'Armador',             points: 1800 },
  { rank: 7,  name: 'Magnate',             points: 3500 },
  { rank: 8,  name: 'Patricio mercantil',  points: 7000 },
  { rank: 9,  name: 'Maestro del comercio',points: 14000 },
  { rank: 10, name: 'Leyenda comercial',   points: 30000 },
];

// ---------------------------------------------------------------------------
// Hitos (GDD §20). Las condiciones se evalúan en progression.ts.
// ---------------------------------------------------------------------------
export const MILESTONES: MilestoneDef[] = [
  { id: 1,  name: 'Compra y venta manual',            condition: 'Disponible desde el inicio',           unlocks: 'Comprar y vender en el mercado' },
  { id: 2,  name: 'Nuevos productos',                 condition: '100 monedas en ventas acumuladas',     unlocks: 'Contratos locales de entrega' },
  { id: 3,  name: 'Primer trabajador',                condition: '250 monedas de patrimonio',            unlocks: 'Contratar un vendedor ambulante' },
  { id: 4,  name: 'Automatización de ventas',         condition: 'Contratar al primer trabajador',       unlocks: 'Ventas automáticas por ciclo' },
  { id: 5,  name: 'Alquiler de puesto comercial',     condition: '500 monedas de patrimonio',            unlocks: 'Alquilar un puesto' },
  { id: 6,  name: 'Costos de alquiler y mantenimiento', condition: 'Primer puesto alquilado',            unlocks: 'Desglose de costos fijos' },
  { id: 7,  name: 'Contratación de más trabajadores', condition: '1.000 monedas de patrimonio',          unlocks: 'Plantilla sin límite (según plazas)' },
  { id: 8,  name: 'Alquiler de almacén',              condition: '2.000 monedas de patrimonio',          unlocks: 'Almacenes pequeño, mediano y grande' },
  { id: 9,  name: 'Gestión de inventario y especulación', condition: 'Primer almacén',                   unlocks: 'Almaceneros: reponen solos lo que se vende' },
  { id: 10, name: 'Compra de local propio',           condition: '5.000 monedas de patrimonio',          unlocks: 'Alquilar y comprar locales' },
  { id: 11, name: 'Negociación con proveedores',      condition: '8.000 monedas de patrimonio',          unlocks: 'Ofertas de proveedores y regateo' },
  { id: 12, name: 'Compra mayorista',                 condition: 'Primera negociación cerrada',          unlocks: 'Lotes mayoristas con mayor descuento' },
  { id: 13, name: 'Adquisición de más establecimientos', condition: '15.000 monedas de patrimonio',      unlocks: 'Varios puestos y locales, casas de comercio' },
  { id: 14, name: 'Distribución a otros comerciantes',condition: '25.000 monedas de patrimonio',         unlocks: 'Distribuir: vender en bloque a otros comerciantes' },
  { id: 15, name: 'Alquiler de barco',                condition: '50.000 de patrimonio, un local propio y 3 viajes por tierra', unlocks: 'Alquilar galeras y viajar a rutas conocidas' },
  { id: 16, name: 'Contratación de capitán y tripulación', condition: 'Primer barco',                    unlocks: 'Capitanes asalariados' },
  { id: 17, name: 'Financiación de expediciones',     condition: '75.000 monedas de patrimonio',         unlocks: 'Expediciones para descubrir rutas' },
  { id: 18, name: 'Logística marítima',               condition: 'Primera expedición',                   unlocks: 'Almacenes portuarios y comerciales' },
  { id: 19, name: 'Automatización de rutas',          condition: 'Primera ruta descubierta',             unlocks: 'Rutas comerciales automáticas' },
  { id: 20, name: 'Compra del primer barco',          condition: '150.000 monedas de patrimonio',        unlocks: 'Contratar el astillero de la ciudad y encargar barcos mercantes' },
  { id: 21, name: 'Contratación de varios capitanes', condition: 'Dos barcos',                           unlocks: 'Varios capitanes y barcos avanzados' },
  { id: 22, name: 'Préstamos',                        condition: '250.000 monedas de patrimonio neto',   unlocks: 'Solicitar préstamos' },
  { id: 23, name: 'Participación en otros negocios',  condition: '500.000 monedas de patrimonio',        unlocks: 'Comprar parte de los talleres de la ciudad: dividendos cada ciclo y su mercancía un 10% más barata' },
  { id: 24, name: 'Compra de astillero',              condition: '1.500.000 monedas de patrimonio',      unlocks: 'Comprar el astillero: barcos un 30% más baratos' },
  { id: 25, name: 'Construcción y reparación de barcos', condition: 'Astillero propio',                  unlocks: 'Construir, reparar y mejorar barcos' },
  { id: 26, name: 'Contratos internacionales',        condition: 'Tres rutas comerciales',               unlocks: 'Contratos de entrega en puertos extranjeros' },
  { id: 27, name: 'Compra de cargamentos a gran escala', condition: '3.000.000 monedas de patrimonio',   unlocks: 'Lotes de cargamentos de nivel 15' },
  { id: 28, name: 'Monopolios comerciales',           condition: 'Dos contratos exclusivos activos y vender en un ciclo la mitad de la demanda de una mercancía', unlocks: 'Monopolio: vendes esa mercancía un 20% más cara en la ciudad' },
  { id: 29, name: 'Inversiones avanzadas',            condition: '10.000.000 monedas de patrimonio',     unlocks: 'Tesoro del templo: depósitos que rinden un 0,6% por ciclo' },
  { id: 30, name: 'Rutas por tierra',                 condition: '20.000 de patrimonio y un local',      unlocks: 'Caballerizas y carretas hacia los pueblos' },
  { id: 31, name: 'Contrato exclusivo',               condition: 'Vender 3.000 unidades de un producto', unlocks: 'Compra automática y permanente de ese producto' },
];

/** Orden del camino de hitos: las rutas por tierra van antes del mar. */
export const MILESTONE_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 30, 31, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29];
/**
 * Número que ve el jugador: su posición en el camino (1, 2, 3… sin saltos). Los ids internos no
 * cambian para no romper partidas guardadas; la interfaz muestra siempre este número.
 */
export function milestoneNo(id: number): number { const i = MILESTONE_ORDER.indexOf(id); return i < 0 ? id : i + 1; }
/** Reescribe «hito N» (id interno) como el número visible en un texto. */
export function milestoneText(t: string): string { return t.replace(/\b([Hh]itos?\s+)(\d+)/g, (_, a: string, n: string) => a + milestoneNo(Number(n))); }

/** Familia de cada hito (icono hito_*.png). */
export const MILESTONE_FAMILY: Record<number, string> = {
  1: 'comercio', 2: 'comercio', 3: 'personal', 4: 'personal', 5: 'locales', 6: 'locales', 7: 'personal', 8: 'almacenes', 9: 'almacenes',
  10: 'locales', 11: 'proveedores', 12: 'proveedores', 13: 'locales', 14: 'distribucion', 30: 'tierra', 31: 'proveedores', 15: 'mar', 16: 'mar',
  17: 'mar', 18: 'mar', 19: 'mar', 20: 'mar', 21: 'mar', 22: 'finanzas', 23: 'finanzas', 24: 'astillero', 25: 'astillero', 26: 'mar', 27: 'comercio', 28: 'comercio', 29: 'finanzas',
};

export const NAMES = [
  'Abibaal', 'Hiram', 'Elissa', 'Magón', 'Bodashtart', 'Ithobaal', 'Hannón', 'Asdrúbal', 'Batbaal', 'Abdmelqart',
  'Eshmunazar', 'Tabnit', 'Arishat', 'Sakarbaal', 'Milkiyaton', 'Baalyaton', 'Gerashtart', 'Himilcón', 'Amat', 'Yatonbaal',
  'Azmilk', 'Bostar', 'Kanmi', 'Safot', 'Abdeshmun', 'Ahirom', 'Shipitbaal', 'Tanit', 'Urimilk', 'Zakarbaal',
];
export const SHIP_NAMES = ['Fénix', 'Melqart', 'Astarté', 'Estrella de Levante', 'Hija del Cedro', 'Ola Púrpura', 'Tanit', 'Baal Hammón', 'Viento de Levante', 'Gacela', 'Delfín', 'Hipocampo'];
export const SUPPLIER_NAMES = ['Casa de Abibaal', 'Talleres de Hiram', 'Hermanos Magónidas', 'Compañía de Sidón', 'Mercaderes del Cedro', 'Factoría de Kition', 'Gremio de tintoreros', 'Caravanas de Arabia'];
