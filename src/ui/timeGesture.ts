// ============================================================================
// Control del tiempo por gestos táctiles (GDD §4). Máquina de estados pura: recibe
// eventos de puntero con coordenadas y tiempo, devuelve qué mostrar y qué velocidad aplicar.
//  · Mantener pulsado (sin moverse) → aparece el panel EN el punto inicial de contacto.
//  · Con el panel visible, deslizar: abajo = pausa, adelante (derecha) = ×6, arriba = ×1.
//  · Soltar → el panel desaparece; la velocidad elegida se mantiene.
//  · Un toque breve es un toque (edificios, personajes); arrastrar antes del umbral es desplazar el mapa.
// ============================================================================
import type { Speed } from '../economy/types';

export const GESTURE = {
  holdMs: 380,        // tiempo de pulsación para mostrar el panel
  slop: 10,           // px que el dedo puede moverse sin cancelar la pulsación
  swipe: 36,          // px desde el punto inicial para elegir una opción
};

export type Choice = 'pausa' | 'rapido' | 'normal' | null;
export interface GestureView { panel: { x: number; y: number } | null; choice: Choice }
export type GestureOut =
  | { kind: 'none' }
  | { kind: 'tap'; x: number; y: number }
  | { kind: 'pan'; dx: number; dy: number }
  | { kind: 'speed'; speed: Speed };

type State = 'idle' | 'pressing' | 'holding' | 'panning';

export class TimeGesture {
  private st: State = 'idle';
  private x0 = 0; private y0 = 0; private t0 = 0; private lx = 0; private ly = 0;
  private id: number | null = null;
  choice: Choice = null;

  get view(): GestureView { return { panel: this.st === 'holding' ? { x: this.x0, y: this.y0 } : null, choice: this.st === 'holding' ? this.choice : null }; }

  down(id: number, x: number, y: number, t: number): GestureOut {
    if (this.id !== null) return { kind: 'none' };     // ignorar segundo dedo
    this.id = id; this.st = 'pressing'; this.x0 = this.lx = x; this.y0 = this.ly = y; this.t0 = t; this.choice = null;
    return { kind: 'none' };
  }

  /** Llamar en cada fotograma: convierte una pulsación quieta en "mantener". */
  tick(t: number): GestureOut {
    if (this.st === 'pressing' && t - this.t0 >= GESTURE.holdMs) this.st = 'holding';
    return { kind: 'none' };
  }

  move(id: number, x: number, y: number, t: number): GestureOut {
    if (id !== this.id) return { kind: 'none' };
    this.tick(t);
    const dx = x - this.x0, dy = y - this.y0;
    if (this.st === 'pressing' && Math.hypot(dx, dy) > GESTURE.slop) this.st = 'panning';
    if (this.st === 'panning') { const out: GestureOut = { kind: 'pan', dx: x - this.lx, dy: y - this.ly }; this.lx = x; this.ly = y; return out; }
    if (this.st === 'holding') {
      // La dirección se decide desde el punto inicial; el panel no se mueve
      if (Math.hypot(dx, dy) < GESTURE.swipe) this.choice = null;
      else if (dy > Math.abs(dx)) this.choice = 'pausa';
      else if (-dy > Math.abs(dx)) this.choice = 'normal';
      else if (dx > 0) this.choice = 'rapido';
      else this.choice = null;                          // hacia atrás: sin acción
    }
    this.lx = x; this.ly = y;
    return { kind: 'none' };
  }

  up(id: number, x: number, y: number, t: number): GestureOut {
    if (id !== this.id) return { kind: 'none' };
    this.move(id, x, y, t);
    const st = this.st, choice = this.choice;
    this.st = 'idle'; this.id = null; this.choice = null;
    if (st === 'pressing') return { kind: 'tap', x: this.x0, y: this.y0 };
    if (st === 'holding' && choice) return { kind: 'speed', speed: choice === 'pausa' ? 0 : choice === 'rapido' ? 6 : 1 };
    return { kind: 'none' };
  }

  cancel(): void { this.st = 'idle'; this.id = null; this.choice = null; }
}
