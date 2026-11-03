// ============================================================================
// FENICIA · Escena del puerto de Tiro (pantalla Muelle), en pixel art.
// LUZ: sol de media tarde arriba a la izquierda. Caras izquierdas en luz, caras derechas en
// sombra, sombras proyectadas hacia la derecha sobre el empedrado.
// ORDEN (como un pixel artist): bloques planos de color medio → limpieza de contornos →
// sombras con dither → luces y brillos al final.
// La escena se dibuja a ancho W variable (para llenar cualquier móvil sin bandas) sobre un
// diseño de 180 x 320 celdas anclado al centro.
// ============================================================================
import { C, Grid, T, gridSprite, rng } from './kit';
import { AMPHORA, BARREL, CRATE, PEOPLE, PORTER, SACK } from './sprites';

export interface Hotspot { id: string; label: string; x: number; y: number; w: number; h: number }

// --------------------------------------------------------------------------- barco mercante (gaulos)
// Vista lateral, proa a la izquierda. Casco ancho y redondeado, popa alta enroscada hacia dentro,
// proa con cabeza de caballo, una vela cuadrada de franjas en una verga, remo de gobierno a popa.
export function shipGrid(sailUp = true, scale = 1): Grid {
  const g = new Grid(66, 62);
  const ox = 3, oy = 44; // línea de cubierta
  const P = (x: number, y: number): [number, number] => [ox + x * scale, oy + y * scale];
  // 1. Bloques: casco
  const hull: [number, number][] = [
    P(2, -3), P(6, 0), P(50, 0), P(53, -5), P(55, -10), P(57, -13), P(59, -12), P(58, -7), P(56, 0), P(52, 6),
    P(44, 10), P(30, 12), P(16, 11), P(8, 8), P(3, 3), P(1, -1),
  ];
  g.poly(hull, (x, y) => (y >= oy + 1 && (y - oy) % 4 === 3 ? C.woodDk : C.wood));
  // Franja de la borda y sombra baja del casco (la luz viene de arriba)
  g.hline(ox + 6, ox + 50, oy, C.woodDk);
  for (let x = ox + 4; x <= ox + 54; x++) for (let y = oy + 6; y <= oy + 13; y++) if (g.get(x, y) !== T && g.get(x, y + 1) === T) { g.px(x, y, C.woodDk); }
  // Mascarón: cabeza de caballo en la proa
  g.rect(ox, oy - 6, 3, 3, C.wood); g.px(ox - 1, oy - 5, C.wood); g.px(ox + 1, oy - 7, C.woodDk); g.px(ox, oy - 5, C.ink);
  // Ojo apotropaico pintado en la proa
  g.px(ox + 6, oy + 2, C.cream); g.px(ox + 7, oy + 2, C.ink);
  // Carga en cubierta: ánforas y fardos
  for (const [i, x] of [12, 16, 20, 40, 44].entries()) { g.rect(ox + x, oy - 3, 3, 3, i % 2 ? C.sand : C.stone); g.px(ox + x + 1, oy - 4, C.stoneDk); }
  if (sailUp) {
    // Jarcia (detrás de la vela) y mástil
    g.line(ox + 28, oy - 40, ox + 2, oy - 4, C.ink);
    g.line(ox + 28, oy - 40, ox + 57, oy - 12, C.ink);
    g.vline(ox + 28, oy - 40, oy - 1, C.woodDk);
    g.hline(ox + 12, ox + 44, oy - 38, C.woodDk);
    // Vela: franjas verticales terracota/crema con panza hacia abajo
    for (let x = ox + 13; x <= ox + 43; x++) {
      const t = (x - (ox + 28)) / 15;
      const bottom = oy - 14 + Math.round(3 * (1 - t * t)); // panza
      const stripe = Math.floor((x - (ox + 13)) / 3) % 2 === 0 ? C.terra : C.cream;
      for (let y = oy - 37; y <= bottom; y++) g.px(x, y, stripe);
    }
    // Sombra de la vela: el lado derecho se aleja del sol
    for (let x = ox + 38; x <= ox + 43; x++) for (let y = oy - 37; y <= oy - 11; y++) {
      const c = g.get(x, y);
      if ((c === C.cream || c === C.terra) && ((x + y) & 1) === 0) g.px(x, y, c === C.cream ? C.sand : C.terraDk);
    }
  } else {
    g.vline(ox + 28, oy - 26, oy - 1, C.woodDk);
    g.rect(ox + 14, oy - 24, 30, 2, C.cream); g.hline(ox + 14, ox + 43, oy - 22, C.sand);
  }
  // Remo de gobierno
  g.line(ox + 53, oy - 2, ox + 60, oy + 12, C.woodDk);
  // 2. Limpieza: contorno de tinta alrededor de todo
  g.outline(C.ink);
  // 3. Luces: borde superior del casco donde pega el sol
  for (let x = ox + 7; x <= ox + 30; x++) if (g.get(x, oy + 1) === C.wood) g.px(x, oy + 1, C.sand);
  return g;
}

export function smallShip(): Grid {
  const g = new Grid(16, 14);
  g.poly([[1, 9], [14, 9], [12, 12], [3, 12]], C.wood);
  g.vline(8, 1, 9, C.woodDk);
  for (let x = 3; x <= 12; x++) for (let y = 2; y <= 7; y++) g.px(x, y, Math.floor((x - 3) / 2) % 2 ? C.cream : C.terra);
  g.outline(C.ink);
  return g;
}

// --------------------------------------------------------------------------- escena completa
export function drawPort(W: number, H: number, seed = 7): { grid: Grid; hotspots: Hotspot[]; ships: { x: number; y: number; flip: boolean }[]; waterTop: number } {
  const g = new Grid(W, H, C.sky);
  const r = rng(seed);
  const X = (x: number) => Math.round((W - 180) / 2 + x); // diseño de 180 anclado al centro
  const oy = Math.round((H - 320) / 2);
  const Y = (y: number) => oy + y;

  // ---- Cielo: más intenso arriba, bruma crema sobre el horizonte
  g.dith(0, 0, W, Y(20), C.sky, C.shallow, 1);
  g.dith(0, Y(46), W, 8, C.sky, C.cream, 1);
  g.dith(0, Y(54), W, 8, C.sky, C.cream, 2);
  // Nubes: crema sólido con base en dither (masas horizontales, no óvalos)
  const cloud = (cx: number, cy: number, w: number) => {
    g.rect(cx, cy, w, 2, C.cream); g.rect(cx + 3, cy - 2, w - 9, 2, C.cream); g.rect(cx + 6, cy - 3, w - 16, 1, C.cream);
    g.dith(cx - 2, cy + 2, w + 4, 1, C.sky, C.cream, 2);
  };
  cloud(X(8), Y(22), 34); cloud(X(118), Y(14), 26); cloud(X(150), Y(34), 18);

  // ---- Montes del Líbano al fondo (fríos y lejanos)
  for (let x = 0; x < W; x++) {
    const h = Math.round(6 + 4 * Math.sin(x / 23) + 3 * Math.sin(x / 9 + 1));
    for (let y = Y(62) - h; y < Y(62); y++) g.px(x, y, ((x + y) & 1) ? C.shallow : C.sky);
  }
  // ---- Isla de Tiro en el horizonte: murallas y casas, poco contraste por la distancia
  const city = (x0: number, x1: number) => {
    // Muralla sobre el agua, almenada
    g.rect(X(x0), Y(54), x1 - x0, 8, C.stone);
    g.hline(X(x0), X(x1) - 1, Y(54), C.sand);
    for (let x = x0; x < x1; x += 4) g.rect(X(x), Y(52), 2, 2, C.stone);
    g.hline(X(x0), X(x1) - 1, Y(60), C.stoneDk);
    // Casas apiñadas detrás, de anchos y alturas distintas (cara izquierda en luz)
    let x = x0 + 1;
    while (x < x1 - 3) {
      const w = 3 + Math.floor(r() * 5), h = 3 + Math.floor(r() * 8);
      g.rect(X(x), Y(52) - h, w, h, C.sand);
      g.vline(X(x) + w - 1, Y(52) - h, Y(51), C.stone);
      if (r() < 0.4 && w > 3) g.px(X(x) + 1, Y(52) - h + 2, C.stoneDk);
      x += w + (r() < 0.3 ? 1 : 0);
    }
    // Pocas torres, desiguales: la del templo de Melqart más alta
    for (const [tx, th] of [[x0 + 14, 15], [x0 + 47, 21], [x0 + 78, 13]] as const) {
      g.rect(X(tx), Y(52) - th, 5, th, C.sand); g.vline(X(tx) + 4, Y(52) - th, Y(51), C.stone);
      g.hline(X(tx) - 1, X(tx) + 5, Y(52) - th - 1, C.stone); g.px(X(tx) + 2, Y(52) - th + 4, C.stoneDk);
    }
  };
  city(-10, 92);
  g.rect(0, Y(62), W, 1, C.stone);

  // ---- Mar abierto: claro en el horizonte, más profundo hacia la costa
  g.rect(0, Y(63), W, 4, C.shallow);
  g.dith(0, Y(67), W, 6, C.shallow, C.sea, 2);
  g.rect(0, Y(73), W, Y(160) - Y(73), C.sea);
  g.dith(0, Y(96), W, Y(160) - Y(96), C.sea, C.deep, 1);
  // Brillos del sol en el agua: guiones crema, más densos bajo el sol (izquierda)
  for (let i = 0; i < W * 0.5; i++) {
    const x = Math.floor(r() * W), y = Y(64) + Math.floor(r() * 34);
    if (r() < 1 - x / W) g.hline(x, x + 1 + Math.floor(r() * 3), y, y < Y(70) ? C.cream : C.sky);
  }
  // Barco lejano
  g.stamp(gridSprite(smallShip()), X(140), Y(64));

  // ---- Muelle: empedrado de losas (luz cálida), bordes en piedra
  const qTop = Y(148), qWall = Y(198), water = Y(208);
  g.rect(0, qTop, W, qWall - qTop, C.sand);
  for (let y = qTop + 3; y < qWall; y += 5) {
    g.hline(0, W - 1, y, C.stone);
    const off = ((y - qTop) / 5) % 2 ? 0 : 6;
    for (let x = off; x < W; x += 12) g.vline(x, y + 1, Math.min(y + 4, qWall - 1), C.stone);
  }
  g.hline(0, W - 1, qTop, C.stone);
  // Muro del muelle con sillares, sombra al pie
  g.rect(0, qWall, W, water - qWall, C.stone);
  g.hline(0, W - 1, qWall, C.cream);
  for (let y = qWall + 3; y < water; y += 4) { g.hline(0, W - 1, y, C.stoneDk); for (let x = ((y / 4) % 2) * 7; x < W; x += 14) g.vline(x, y - 3, y - 1, C.stoneDk); }
  g.hline(0, W - 1, water - 1, C.ink);

  // ---- Agua del puerto: turquesa somera junto al muro, más profunda hacia abajo
  g.rect(0, water, W, H - water, C.sea);
  g.dith(0, water, W, 4, C.sea, C.shallow, 3);
  g.dith(0, water + 4, W, 8, C.sea, C.shallow, 1);
  g.dith(0, Y(262), W, H - Y(262), C.sea, C.deep, 2);
  g.dith(0, Y(292), W, H - Y(292), C.deep, C.sea, 1);
  // Reflejo del muro (sombra fría)
  g.dith(0, water, W, 2, C.sea, C.deep, 2);
  // Ondas
  for (let i = 0; i < W * 0.6; i++) {
    const x = Math.floor(r() * W), y = water + 10 + Math.floor(r() * (H - water - 10));
    g.hline(x, x + 2 + Math.floor(r() * 3), y, r() < 0.5 ? C.shallow : C.sky);
  }

  // ---- Embarcadero de madera hacia el agua
  const px0 = X(76), px1 = X(100);
  for (let y = qWall; y < Y(300); y++) g.hline(px0, px1, y, (y - qWall) % 3 === 2 ? C.woodDk : C.wood);
  g.vline(px0, qWall, Y(300), C.ink); g.vline(px1, qWall, Y(300), C.woodDk);
  for (let y = Y(212); y < Y(300); y += 16) { g.rect(px0 - 2, y, 2, 5, C.woodDk); g.rect(px1 + 1, y, 2, 5, C.woodDk); g.dith(px0 - 3, y + 5, 3, 2, C.sea, C.deep, 2); }
  g.dith(px1 + 1, qWall + 1, 3, Y(300) - qWall, C.sea, C.deep, 2); // sombra del embarcadero en el agua
  g.hline(px0, px1, Y(300), C.ink);

  const hotspots: Hotspot[] = [];

  // ---- Oficina del puerto (izquierda): azotea con parapeto, estandartes púrpura
  {
    const g0 = g; { const g = new Grid(W, H);
    const x0 = X(8), x1 = X(62), top = Y(108), base = qTop + 4;
    g.rect(x0, top, x1 - x0, base - top, C.stone);
    g.rect(x0, top, 4, base - top, C.sand);                                 // canto en luz
    g.rect(x1 - 5, top, 5, base - top, C.stoneDk);                          // cara en sombra
    g.rect(x0 - 2, top - 4, x1 - x0 + 4, 4, C.sand); g.hline(x0 - 2, x1 + 1, top - 1, C.stoneDk);
    for (let x = x0; x < x1; x += 6) g.rect(x, top - 7, 3, 3, C.sand);      // almenas
    // Puerta y ventanas
    g.rect(x0 + 21, base - 18, 12, 18, C.woodDk); g.rect(x0 + 22, base - 19, 10, 1, C.woodDk); g.vline(x0 + 27, base - 18, base - 1, C.wood);
    for (const wx of [x0 + 8, x0 + 38]) { g.rect(wx, top + 10, 5, 7, C.ink); g.hline(wx - 1, wx + 5, top + 17, C.sand); }
    // Estandartes púrpura con remate de oro
    for (const bx of [x0 + 6, x0 + 41]) { g.rect(bx, top + 1, 5, 8, C.purple); g.px(bx + 2, top + 9, C.purple); g.hline(bx, bx + 4, top, C.gold); g.px(bx + 2, top + 4, C.gold); }
    g.outline(C.ink);
    g0.stamp(gridSprite(g), 0, 0);
    hotspots.push({ id: 'oficina', label: 'Oficina del puerto', x: x0, y: top - 7, w: x1 - x0, h: base - top + 7 });
  } }

  // ---- Almacén (derecha): gran nave con tejado de tejas a dos aguas
  {
    const g0 = g; { const g = new Grid(W, H);
    const x0 = X(104), x1 = X(174), top = Y(116), base = qTop + 6;
    // Tejado: hiladas alternas de terracota
    g.poly([[x0 - 4, top], [x0 + 10, top - 18], [x1 - 10, top - 18], [x1 + 4, top]], (x, y) => ((y - top) & 1 ? C.terra : (x & 1 ? C.terra : C.terraDk)));
    g.hline(x0 + 10, x1 - 10, top - 18, C.terraDk);
    g.hline(x0 - 4, x1 + 3, top, C.terraDk);
    // Muros
    g.rect(x0, top + 1, x1 - x0, base - top - 1, C.stone);
    g.rect(x0, top + 1, 4, base - top - 1, C.sand);
    g.rect(x1 - 6, top + 1, 6, base - top - 1, C.stoneDk);
    g.dith(x0, top + 1, x1 - x0, 3, C.stone, C.stoneDk, 2);                // sombra del alero
    // Gran puerta en arco y ventanucos
    const dx = x0 + 26;
    g.rect(dx, base - 20, 18, 20, C.woodDk); g.rect(dx + 2, base - 22, 14, 2, C.woodDk); g.rect(dx + 4, base - 23, 10, 1, C.woodDk);
    for (let x = dx + 2; x < dx + 17; x += 4) g.vline(x, base - 19, base - 1, C.wood);
    for (const wx of [x0 + 9, x0 + 52]) g.rect(wx, top + 8, 4, 6, C.ink);
    // Chimenea del taller
    g.rect(x1 - 16, top - 26, 6, 9, C.stone); g.rect(x1 - 11, top - 26, 1, 9, C.stoneDk); g.hline(x1 - 17, x1 - 10, top - 26, C.sand);
    g.outline(C.ink);
    g0.stamp(gridSprite(g), 0, 0);
    hotspots.push({ id: 'almacen', label: 'Almacén de Tiro', x: x0 - 4, y: top - 26, w: x1 - x0 + 8, h: base - top + 26 });
  } }

  // ---- Puesto: toldo a rayas púrpura y crema sobre una mesa con ánforas
  {
    const x0 = X(66), x1 = X(98), top = Y(130), base = qTop + 14;
    g.vline(x0 + 1, top, base, C.woodDk); g.vline(x1 - 1, top, base, C.woodDk);
    for (let x = x0 - 2; x <= x1 + 2; x++) for (let y = top - 5; y <= top; y++) g.px(x, y, Math.floor((x - x0 + 2) / 3) % 2 ? C.cream : C.purple);
    for (let x = x0 - 2; x <= x1 + 2; x += 3) g.px(x + 1, top + 1, Math.floor((x - x0 + 2) / 3) % 2 ? C.cream : C.purple); // flecos
    g.rect(x0, base - 7, x1 - x0, 3, C.wood); g.hline(x0, x1 - 1, base - 7, C.sand);
    g.stamp(AMPHORA, x0 + 4, base - 14); g.stamp(AMPHORA, x0 + 11, base - 14); g.stamp(SACK, x0 + 19, base - 12);
    hotspots.push({ id: 'puesto', label: 'Puesto', x: x0 - 2, y: top - 5, w: x1 - x0 + 5, h: base - top + 5 });
  }

  // ---- Sombras proyectadas a la derecha de los edificios sobre el empedrado
  g.dith(X(63), qTop + 4, 6, 20, C.sand, C.stone, 2);
  g.dith(X(175), qTop + 6, 5, 24, C.sand, C.stone, 2);

  // ---- Palmera junto a la oficina
  {
    const bx = X(64), by = qTop + 10;
    for (let i = 0; i < 34; i++) { const x = bx + Math.round(Math.sin(i / 12) * 3), y = by - i; g.px(x, y, i % 3 ? C.wood : C.woodDk); g.px(x + 1, y, C.woodDk); }
    const cx = bx + 3, cy = by - 34;
    const frond = (dx: number, dy: number, len: number) => { for (let i = 0; i < len; i++) { const x = cx + Math.round(dx * i), y = cy + Math.round(dy * i + 0.06 * i * i); g.px(x, y, C.green); g.px(x, y + 1, i > len / 2 ? C.deep : C.green); } };
    frond(1, -0.2, 14); frond(-1, -0.2, 14); frond(0.7, 0.4, 12); frond(-0.7, 0.4, 12); frond(0.3, -0.6, 8); frond(-0.3, -0.6, 8);
    g.rect(cx - 1, cy, 3, 2, C.woodDk);
  }

  // ---- Mercancía apilada en el muelle
  g.stamp(CRATE, X(108), qTop + 16); g.stamp(CRATE, X(115), qTop + 16); g.stamp(CRATE, X(111), qTop + 10);
  g.stamp(BARREL, X(150), qTop + 18); g.stamp(BARREL, X(157), qTop + 18);
  g.stamp(AMPHORA, X(30), qTop + 24); g.stamp(AMPHORA, X(35), qTop + 25); g.stamp(SACK, X(40), qTop + 27);
  g.stamp(CRATE, X(102), qTop + 36); g.stamp(SACK, X(110), qTop + 39);

  // ---- Gente
  g.stamp(PEOPLE.purple[0], X(56), qTop + 22);
  g.stamp(PEOPLE.cream[1], X(88), qTop + 30);
  g.stamp(PORTER, X(124), qTop + 28);
  g.stamp(PEOPLE.terra[0], X(84), Y(232));
  g.stamp(PEOPLE.cream[0], X(92), Y(258));

  // Barcos atracados (se dibujan como capa aparte para que puedan mecerse)
  const ships = [{ x: X(10), y: Y(196), flip: false }, { x: X(102), y: Y(224), flip: true }];
  return { grid: g, hotspots, ships, waterTop: water };
}
