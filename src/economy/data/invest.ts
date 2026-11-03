// Inversiones de la etapa final (hitos 23, 28 y 29). Datos y modificadores de precio,
// sin dependencias del resto del motor para evitar ciclos de importación.
import type { GameState } from '../types';

/** Talleres de la ciudad en los que puedes comprar una participación (hito 23). */
export interface WorkshopDef { id: string; name: string; art: string; category: string; price: number; dividend: number }
export const WORKSHOPS: WorkshopDef[] = [
  { id: 'alfareria', name: 'Taller de alfarería', art: 'taller_alfareria', category: 'ceramica', price: 120000, dividend: 1500 },
  { id: 'vidrio',    name: 'Taller de vidrio',    art: 'taller_vidrio',    category: 'vidrio',   price: 180000, dividend: 2300 },
  { id: 'cedro',     name: 'Aserradero de cedro', art: 'taller_cedro',     category: 'madera',   price: 200000, dividend: 2500 },
  { id: 'tinte',     name: 'Tintorería de púrpura', art: 'taller_tinte',   category: 'textil',   price: 250000, dividend: 3200 },
  { id: 'fundicion', name: 'Fundición de bronce', art: 'taller_fundicion', category: 'metal',    price: 300000, dividend: 3900 },
];
export const WORKSHOP_DISCOUNT = 0.9;        // compras un 10% más barato lo que produce tu taller
export const MONOPOLY_PRICE = 1.2;           // vendes un 20% más caro la mercancía en monopolio
export const MONOPOLY_FEE = 1500;            // tasa por ciclo de cada monopolio
export const MONOPOLY_MAX = 3;
export const TREASURY_RATE = 0.006;          // interés por ciclo del tesoro del templo (0,6%)

export function workshopBuyMult(s: GameState, category: string): number {
  return WORKSHOPS.some(w => w.category === category && s.workshops?.includes(w.id)) ? WORKSHOP_DISCOUNT : 1;
}
export function monopolySellMult(s: GameState, goodId: string): number {
  return s.monopolies?.includes(goodId) ? MONOPOLY_PRICE : 1;
}
