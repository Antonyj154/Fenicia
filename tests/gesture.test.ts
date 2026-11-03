import { describe, expect, it } from 'vitest';
import { GESTURE, TimeGesture } from '../src/ui/timeGesture';

const hold = (g: TimeGesture, x = 100, y = 200) => { g.down(1, x, y, 0); g.tick(GESTURE.holdMs + 1); };

describe('Control del tiempo por gestos (GDD §4)', () => {
  it('un toque breve no cambia la velocidad: es un toque', () => {
    const g = new TimeGesture();
    g.down(1, 50, 60, 0);
    expect(g.up(1, 51, 60, 120)).toEqual({ kind: 'tap', x: 50, y: 60 });
  });
  it('mantener pulsado muestra el panel exactamente en el punto inicial', () => {
    const g = new TimeGesture(); hold(g, 123, 456);
    expect(g.view.panel).toEqual({ x: 123, y: 456 });
    g.move(1, 180, 470, GESTURE.holdMs + 50);
    expect(g.view.panel).toEqual({ x: 123, y: 456 }); // no sigue al dedo
  });
  it('deslizar abajo pausa, adelante ×6 y arriba ×1', () => {
    for (const [dx, dy, speed] of [[0, 60, 0], [70, 5, 6], [0, -60, 1]] as const) {
      const g = new TimeGesture(); hold(g);
      g.move(1, 100 + dx, 200 + dy, GESTURE.holdMs + 40);
      expect(g.up(1, 100 + dx, 200 + dy, GESTURE.holdMs + 60)).toEqual({ kind: 'speed', speed });
      expect(g.view.panel).toBeNull();               // al soltar desaparece
    }
  });
  it('soltar sin deslizar no cambia nada', () => {
    const g = new TimeGesture(); hold(g);
    expect(g.up(1, 104, 203, 900)).toEqual({ kind: 'none' });
  });
  it('arrastrar antes del umbral desplaza el mapa y nunca activa el panel', () => {
    const g = new TimeGesture();
    g.down(1, 100, 200, 0);
    expect(g.move(1, 130, 200, 100)).toEqual({ kind: 'pan', dx: 30, dy: 0 });
    g.tick(2000);
    expect(g.view.panel).toBeNull();
    expect(g.up(1, 130, 260, 2100).kind).toBe('none');
  });
  it('un segundo dedo se ignora', () => {
    const g = new TimeGesture(); hold(g);
    g.down(2, 10, 10, 500);
    g.move(1, 100, 270, 600);
    expect(g.up(1, 100, 270, 650)).toEqual({ kind: 'speed', speed: 0 });
  });
});
