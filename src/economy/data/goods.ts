import type { GoodDef } from '../types';

// GDD §6 – precios de referencia. retailDemand y minPrestigeRank son propuesta de balance.
// retailDemand: unidades/ciclo que absorbe la clientela minorista de una ciudad de referencia.
// Las mercancías baratas tienen mucho volumen; las de lujo se venden sobre todo
// por distribución, rutas marítimas y contratos.
export const GOODS: GoodDef[] = [
  // Niveles 1–5
  { id: 'baratijas',        name: 'Baratijas',            buy: 4,     sell: 5,     unlockLevel: 1,  category: 'artesania', retailDemand: 40, minPrestigeRank: 1 },
  { id: 'cuentas_vidrio',   name: 'Cuentas de vidrio',    buy: 6,     sell: 8,     unlockLevel: 1,  category: 'vidrio',    retailDemand: 16, minPrestigeRank: 1 },
  { id: 'ceramica_sencilla',name: 'Cerámica sencilla',    buy: 10,    sell: 13,    unlockLevel: 2,  category: 'ceramica',  retailDemand: 8, minPrestigeRank: 1 },
  { id: 'cestas',           name: 'Cestas artesanales',   buy: 12,    sell: 16,    unlockLevel: 2,  category: 'artesania', retailDemand: 7, minPrestigeRank: 1 },
  { id: 'aceite',           name: 'Aceite de oliva',      buy: 20,    sell: 26,    unlockLevel: 3,  category: 'alimento',  retailDemand: 5, minPrestigeRank: 1 },
  { id: 'vino_comun',       name: 'Vino común',           buy: 25,    sell: 33,    unlockLevel: 3,  category: 'alimento',  retailDemand: 4, minPrestigeRank: 1 },
  { id: 'lino',             name: 'Telas de lino',        buy: 40,    sell: 53,    unlockLevel: 4,  category: 'textil',    retailDemand: 5, minPrestigeRank: 1 },
  { id: 'bronce',           name: 'Utensilios de bronce', buy: 55,    sell: 72,    unlockLevel: 4,  category: 'metal',     retailDemand: 5,  minPrestigeRank: 1 },
  { id: 'vidrio_trabajado', name: 'Vidrio trabajado',     buy: 90,    sell: 120,   unlockLevel: 5,  category: 'vidrio',    retailDemand: 4,  minPrestigeRank: 1 },
  { id: 'joyeria_sencilla', name: 'Joyería sencilla',     buy: 120,   sell: 160,   unlockLevel: 5,  category: 'joyeria',   retailDemand: 4,  minPrestigeRank: 1 },
  // Niveles 6–10
  { id: 'cedro',            name: 'Madera de cedro',      buy: 150,   sell: 195,   unlockLevel: 6,  category: 'madera',    retailDemand: 4,  minPrestigeRank: 1 },
  { id: 'ceramica_fina',    name: 'Cerámica fina',        buy: 180,   sell: 240,   unlockLevel: 6,  category: 'ceramica',  retailDemand: 4,  minPrestigeRank: 1 },
  { id: 'cobre',            name: 'Lingotes de cobre',    buy: 250,   sell: 330,   unlockLevel: 7,  category: 'metal',     retailDemand: 4,  minPrestigeRank: 1 },
  { id: 'estano',           name: 'Estaño',               buy: 300,   sell: 400,   unlockLevel: 7,  category: 'metal',     retailDemand: 4,  minPrestigeRank: 1 },
  { id: 'tejidos_tenidos',  name: 'Tejidos teñidos',      buy: 450,   sell: 600,   unlockLevel: 8,  category: 'textil',    retailDemand: 3,  minPrestigeRank: 2 },
  { id: 'vino_selecto',     name: 'Vino selecto',         buy: 500,   sell: 670,   unlockLevel: 8,  category: 'alimento',  retailDemand: 3,  minPrestigeRank: 2 },
  { id: 'tinte_purpura',    name: 'Tinte púrpura',        buy: 750,   sell: 1000,  unlockLevel: 9,  category: 'textil',    retailDemand: 3,  minPrestigeRank: 2 },
  { id: 'joyas_plata',      name: 'Joyas de plata',       buy: 900,   sell: 1200,  unlockLevel: 9,  category: 'joyeria',   retailDemand: 3,  minPrestigeRank: 2 },
  { id: 'marfil',           name: 'Marfil trabajado',     buy: 1400,  sell: 1900,  unlockLevel: 10, category: 'lujo',      retailDemand: 2,  minPrestigeRank: 3 },
  { id: 'vidrio_lujo',      name: 'Vidrio de lujo',       buy: 1600,  sell: 2200,  unlockLevel: 10, category: 'vidrio',    retailDemand: 2,  minPrestigeRank: 3 },
  // Niveles 11–15 (mercancías restringidas por prestigio)
  { id: 'especias',         name: 'Especias exóticas',    buy: 2000,  sell: 2700,  unlockLevel: 11, category: 'especia',   retailDemand: 1.5, minPrestigeRank: 4 },
  { id: 'incienso',         name: 'Incienso',             buy: 2300,  sell: 3100,  unlockLevel: 11, category: 'especia',   retailDemand: 1.5, minPrestigeRank: 4 },
  { id: 'oro_trabajado',    name: 'Oro trabajado',        buy: 3500,  sell: 4700,  unlockLevel: 12, category: 'joyeria',   retailDemand: 1,   minPrestigeRank: 5 },
  { id: 'joyas_oro',        name: 'Joyas de oro',         buy: 4000,  sell: 5500,  unlockLevel: 12, category: 'joyeria',   retailDemand: 1,   minPrestigeRank: 5 },
  { id: 'seda',             name: 'Seda importada',       buy: 5500,  sell: 7500,  unlockLevel: 13, category: 'textil',    retailDemand: 0.8, minPrestigeRank: 6 },
  { id: 'piedras_preciosas',name: 'Piedras preciosas',    buy: 7000,  sell: 9500,  unlockLevel: 13, category: 'joyeria',   retailDemand: 0.8, minPrestigeRank: 6 },
  { id: 'cargamento_exclusivo', name: 'Cargamentos exclusivos', buy: 12000, sell: 16500, unlockLevel: 14, category: 'mayorista', retailDemand: 0.5, minPrestigeRank: 7 },
  { id: 'artefactos_lujo',  name: 'Artefactos de lujo',   buy: 15000, sell: 20500, unlockLevel: 14, category: 'lujo',      retailDemand: 0.5, minPrestigeRank: 7 },
  { id: 'contrato_gran_escala', name: 'Contratos de mercancía a gran escala', buy: 30000, sell: 42000, unlockLevel: 15, category: 'mayorista', retailDemand: 0.3, minPrestigeRank: 8 },
  { id: 'cargamento_especial', name: 'Cargamentos especiales', buy: 50000, sell: 70000, unlockLevel: 15, category: 'mayorista', retailDemand: 0.2, minPrestigeRank: 8 },
];

export const GOOD_BY_ID: Record<string, GoodDef> = Object.fromEntries(GOODS.map(g => [g.id, g]));
