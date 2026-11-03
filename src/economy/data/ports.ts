import type { PortDef } from '../types';

// GDD §18 – ciudades jugables + puertos comerciales del Mediterráneo (destinos de rutas).
// priceMods < 1 = la mercancía es abundante/barata allí (especialidad); > 1 = cara/demandada.
const base = { wages: 1, rent: 1, property: 1, maritime: 1, portFee: 50 };

export const PORTS: PortDef[] = [
  {
    id: 'tiro', name: 'Tiro', lat: 33.27, lon: 35.2, playable: true, difficulty: 'media',
    specialties: 'Textiles, tinte púrpura y vidrio',
    description: 'La reina de los mares. Comercio intenso, competencia media.',
    priceMods: { textil: 0.85, vidrio: 0.9, madera: 0.95 },
    supplyMods: { textil: 1.6, vidrio: 1.4 },
    demandMods: { joyeria: 1.1 },
    competition: 0.1, costs: { ...base }, loanRate: 0.15, piracy: 0.03,
  },
  {
    id: 'sidon', name: 'Sidón', lat: 33.56, lon: 35.37, playable: true, difficulty: 'facil',
    specialties: 'Vidrio, cerámica y artesanías',
    description: 'Ciudad de artesanos. Costos bajos y clientela generosa.',
    priceMods: { vidrio: 0.85, ceramica: 0.85, artesania: 0.9, metal: 1.1 },
    supplyMods: { vidrio: 1.6, ceramica: 1.6, artesania: 1.4 },
    demandMods: { metal: 1.2, textil: 1.1 },
    competition: 0.05, costs: { ...base, wages: 0.9, rent: 0.9, portFee: 40 }, loanRate: 0.12, piracy: 0.03,
  },
  {
    id: 'biblos', name: 'Biblos', lat: 34.12, lon: 35.65, playable: true, difficulty: 'facil',
    specialties: 'Madera, papiro y agricultura',
    description: 'Puerta de los cedros del Líbano. Alimentos y madera baratos.',
    priceMods: { madera: 0.75, alimento: 0.85, joyeria: 1.1, lujo: 1.1 },
    supplyMods: { madera: 2, alimento: 1.6 },
    demandMods: { vidrio: 1.2, joyeria: 1.2 },
    competition: 0.05, costs: { ...base, wages: 0.9, rent: 0.85, portFee: 40 }, loanRate: 0.12, piracy: 0.04,
  },
  {
    id: 'kition', name: 'Kition (Chipre)', lat: 34.92, lon: 33.63, playable: false,
    specialties: 'Cobre y bronce', description: 'Colonia fenicia en la isla del cobre.',
    priceMods: { metal: 0.75, textil: 1.15, vidrio: 1.15, alimento: 1.05 },
    supplyMods: { metal: 2 }, demandMods: { textil: 1.3, vidrio: 1.2 },
    competition: 0.1, costs: { ...base, portFee: 60 }, loanRate: 0.15, piracy: 0.05,
  },
  {
    id: 'menfis', name: 'Menfis (Egipto)', lat: 29.85, lon: 31.25, playable: false,
    specialties: 'Especias, incienso, oro y lino', description: 'El gran mercado del Nilo.',
    priceMods: { especia: 0.75, joyeria: 0.9, madera: 1.35, vidrio: 1.2, alimento: 0.9, textil: 1.05 },
    supplyMods: { especia: 2, alimento: 1.5 }, demandMods: { madera: 1.6, vidrio: 1.3, metal: 1.2 },
    competition: 0.15, costs: { ...base, portFee: 90 }, loanRate: 0.15, piracy: 0.06,
  },
  {
    id: 'rodas', name: 'Rodas', lat: 36.43, lon: 28.22, playable: false,
    specialties: 'Vino y cerámica', description: 'Escala obligada hacia el Egeo.',
    priceMods: { alimento: 0.85, ceramica: 0.9, textil: 1.2, joyeria: 1.1 },
    supplyMods: { alimento: 1.5 }, demandMods: { textil: 1.3, lujo: 1.2 },
    competition: 0.1, costs: { ...base, portFee: 70 }, loanRate: 0.15, piracy: 0.07,
  },
  {
    id: 'cnosos', name: 'Cnosos (Creta)', lat: 35.3, lon: 25.16, playable: false,
    specialties: 'Aceite y cerámica fina', description: 'Isla de palacios y artesanos.',
    priceMods: { alimento: 0.85, ceramica: 0.85, lujo: 1.2, especia: 1.25, textil: 1.2 },
    supplyMods: { ceramica: 1.6, alimento: 1.5 }, demandMods: { especia: 1.3, textil: 1.3 },
    competition: 0.1, costs: { ...base, portFee: 70 }, loanRate: 0.15, piracy: 0.08,
  },
  {
    id: 'cartago', name: 'Cartago', lat: 36.85, lon: 10.32, playable: true, difficulty: 'dificil',
    specialties: 'Comercio marítimo y distribución',
    description: 'La nueva ciudad. Enorme mercado mayorista y competencia feroz.',
    priceMods: { textil: 1.25, especia: 1.3, vidrio: 1.2, lujo: 1.2, joyeria: 1.15, alimento: 0.95 },
    supplyMods: { mayorista: 1.5 }, demandMods: { textil: 1.4, especia: 1.4, lujo: 1.3, mayorista: 1.5 },
    competition: 0.3, costs: { ...base, wages: 1.2, rent: 1.3, property: 1.2, portFee: 80 }, loanRate: 0.18, piracy: 0.1,
  },
  {
    id: 'tharros', name: 'Tharros (Cerdeña)', lat: 39.87, lon: 8.44, playable: false,
    specialties: 'Plata y plomo', description: 'Factoría en la ruta del oeste.',
    priceMods: { metal: 0.85, joyeria: 0.9, textil: 1.3, especia: 1.4, vidrio: 1.25 },
    supplyMods: { metal: 1.5 }, demandMods: { textil: 1.3, especia: 1.4, vidrio: 1.3 },
    competition: 0.05, costs: { ...base, portFee: 60 }, loanRate: 0.15, piracy: 0.12,
  },
  {
    id: 'gadir', name: 'Gadir', lat: 36.53, lon: -6.29, playable: true, difficulty: 'dificil',
    specialties: 'Metales, plata y estaño',
    description: 'El confín del mundo conocido. Metales baratos, todo lo demás caro.',
    priceMods: { metal: 0.7, joyeria: 0.85, textil: 1.35, especia: 1.5, vidrio: 1.35, lujo: 1.35, alimento: 1.1 },
    supplyMods: { metal: 2.2 }, demandMods: { textil: 1.5, especia: 1.5, vidrio: 1.4, lujo: 1.4 },
    competition: 0.2, costs: { ...base, wages: 1.25, rent: 1.15, property: 1.15, maritime: 1.2, portFee: 90 }, loanRate: 0.2, piracy: 0.14,
  },
];

export const PORT_BY_ID: Record<string, PortDef> = Object.fromEntries(PORTS.map(p => [p.id, p]));

/** Distancia marítima aproximada (km): gran círculo × 1,25 por costas y escalas. */
export function seaDistanceKm(a: string, b: string): number {
  const p = PORT_BY_ID[a], q = PORT_BY_ID[b];
  const R = 6371, rad = Math.PI / 180;
  const dLat = (q.lat - p.lat) * rad, dLon = (q.lon - p.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p.lat * rad) * Math.cos(q.lat * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.25);
}
