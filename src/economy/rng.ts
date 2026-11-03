import type { GameState } from './types';

/** Generador determinista (mulberry32). El estado vive en GameState.rng → partidas reproducibles. */
export function rand(s: GameState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function randRange(s: GameState, a: number, b: number): number { return a + (b - a) * rand(s); }
export function randInt(s: GameState, a: number, b: number): number { return Math.floor(randRange(s, a, b + 1)); }
export function gauss(s: GameState): number {
  const u = Math.max(1e-9, rand(s)), v = rand(s);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function pick<T>(s: GameState, arr: T[]): T { return arr[Math.floor(rand(s) * arr.length)]; }
export function nextId(s: GameState, prefix: string): string { return `${prefix}${++s.idCounter}`; }
