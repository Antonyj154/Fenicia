import type { EventEffects, GameState } from '../types';

export interface EventDef {
  id: string;
  name: string;
  description: string;
  weight: number;
  duration: [number, number];          // ciclos (min, max)
  minLevel: number;
  requiresMilestone?: number;
  /** Puede personalizar efectos y textos al dispararse (p.ej. elegir puerto). */
  build?: (s: GameState, rnd: () => number) => { effects: EventEffects; description?: string } | null;
  effects?: EventEffects;
}

// GDD §17.1
export const EVENTS: EventDef[] = [
  {
    id: 'escasez_cedro', name: 'Escasez de madera de cedro', weight: 8, duration: [5, 8], minLevel: 5,
    description: 'Los bosques del Líbano no dan abasto. El cedro escasea y su precio se dispara.',
    effects: { priceMods: { cedro: 1.6 }, supplyMods: { cedro: 0.3 } },
  },
  {
    id: 'malas_cosechas', name: 'Malas cosechas', weight: 9, duration: [5, 8], minLevel: 2,
    description: 'La sequía arruina olivares y viñedos. Los alimentos suben y escasean.',
    effects: { priceMods: { alimento: 1.4 }, supplyMods: { alimento: 0.5 } },
  },
  {
    id: 'nuevo_proveedor', name: 'Nuevo proveedor en la ciudad', weight: 7, duration: [4, 6], minLevel: 1, requiresMilestone: 11,
    description: 'Un mercader recién llegado ofrece lotes con descuento.',
    build: (_s, rnd) => {
      const cats = ['textil', 'vidrio', 'ceramica', 'metal', 'alimento', 'joyeria'] as const;
      const c = cats[Math.floor(rnd() * cats.length)];
      return { effects: { supplierDiscount: 0.12, supplierCategory: c }, description: `Un mercader recién llegado ofrece lotes de ${c} con un 12% de descuento adicional.` };
    },
  },
  {
    id: 'bloqueo_portuario', name: 'Bloqueo portuario', weight: 6, duration: [3, 5], minLevel: 1, requiresMilestone: 15,
    description: 'Un puerto ha cerrado sus aguas al comercio.',
    build: (s, rnd) => {
      if (!s.knownRoutes.length) return null;
      const p = s.knownRoutes[Math.floor(rnd() * s.knownRoutes.length)];
      return { effects: { blockedPort: p }, description: `El puerto de ${p} cierra sus aguas. Ningún barco puede zarpar hacia allí.` };
    },
  },
  {
    id: 'pirateria', name: 'Aumento de la piratería', weight: 7, duration: [6, 10], minLevel: 1, requiresMilestone: 15,
    description: 'Naves piratas acechan las rutas. El riesgo de perder carga se duplica.',
    effects: { piracyMult: 2 },
  },
  {
    id: 'demanda_lujo', name: 'Fiebre por el lujo', weight: 7, duration: [5, 8], minLevel: 5,
    description: 'Las familias nobles compran sin medida. Suben la demanda y el precio de los artículos de lujo.',
    effects: { demandMods: { joyeria: 1.8, lujo: 1.8, vidrio: 1.3 }, priceMods: { joyeria: 1.15, lujo: 1.15 } },
  },
  {
    id: 'cambio_gobierno', name: 'Cambio de gobierno', weight: 5, duration: [8, 12], minLevel: 4,
    description: 'Un nuevo consejo de ancianos revisa los tributos.',
    build: (_s, rnd) => rnd() < 0.5
      ? { effects: { fixedCostMult: 1.2 }, description: 'El nuevo consejo sube un 20% los alquileres, tributos y mantenimiento.' }
      : { effects: { fixedCostMult: 0.85 }, description: 'El nuevo consejo rebaja un 15% los alquileres, tributos y mantenimiento.' },
  },
  {
    id: 'nuevos_impuestos', name: 'Nuevos impuestos comerciales', weight: 5, duration: [8, 12], minLevel: 6,
    description: 'Se gravan las propiedades y las escalas portuarias.',
    effects: { fixedCostMult: 1.15, portFeeMult: 1.5 },
  },
  {
    id: 'feria', name: 'Feria comercial', weight: 8, duration: [2, 4], minLevel: 1,
    description: 'Llegan forasteros de todo el Mediterráneo. La demanda minorista crece un 60%.',
    effects: { demandMods: { all: 1.6 } },
  },
  {
    id: 'crisis_competidores', name: 'Crisis de competidores', weight: 6, duration: [4, 7], minLevel: 3,
    description: 'Varias casas rivales quiebran. Sus clientes y comerciantes buscan nuevo proveedor.',
    effects: { demandMods: { all: 1.3 }, wholesaleMult: 1.5 },
  },
  {
    id: 'descubrimiento_ruta', name: 'Descubrimiento de nueva ruta', weight: 3, duration: [1, 1], minLevel: 10, requiresMilestone: 15,
    description: 'Un marino de confianza comparte sus cartas de navegación.',
    build: (s, rnd) => {
      const unknown = Object.keys(s.markets).filter(p => p !== s.cityId && !s.knownRoutes.includes(p));
      if (!unknown.length) return null;
      const p = unknown[Math.floor(rnd() * unknown.length)];
      return { effects: { discoverPort: p }, description: `Un marino te entrega las cartas hacia ${p}. Nueva ruta disponible.` };
    },
  },
];
