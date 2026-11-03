// Guardado de partidas (GDD §18.1): una partida por ranura, sin compartir progreso.
import { migrate, SAVE_VERSION } from './state';
import type { GameState } from './types';

export interface KeyValueStore { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

const PREFIX = 'fenicia.save.';
const INDEX = 'fenicia.saves';

export function serialize(s: GameState): string { return JSON.stringify(s); }

export function deserialize(json: string): GameState {
  const s = JSON.parse(json) as GameState;
  if (typeof s.version !== 'number' || s.version > SAVE_VERSION) throw new Error('Versión de guardado no compatible');
  return migrate(s);
}

export interface SaveSummary { id: string; cityId: string; playerName: string; cycle: number; level: number; netWorth: number; cash: number; savedAt: number }

export class SaveManager {
  constructor(private store: KeyValueStore) {}
  list(): SaveSummary[] {
    try { return JSON.parse(this.store.getItem(INDEX) ?? '[]'); } catch { return []; }
  }
  save(s: GameState, netWorth: number): void {
    this.store.setItem(PREFIX + s.id, serialize(s));
    const list = this.list().filter(x => x.id !== s.id);
    list.unshift({ id: s.id, cityId: s.cityId, playerName: s.playerName, cycle: s.time.cycle, level: s.level, netWorth, cash: Math.round(s.cash), savedAt: Date.now() });
    this.store.setItem(INDEX, JSON.stringify(list));
  }
  load(id: string): GameState | null {
    const raw = this.store.getItem(PREFIX + id);
    return raw ? deserialize(raw) : null;
  }
  remove(id: string): void {
    this.store.removeItem(PREFIX + id);
    this.store.setItem(INDEX, JSON.stringify(this.list().filter(x => x.id !== id)));
  }
}
