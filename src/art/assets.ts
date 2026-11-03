// ============================================================================
// Piezas de arte externas (ver docs/especificacion-arte.html). Si el PNG existe en
// assets/<carpeta>/<archivo>.png se usa; si no, el juego dibuja la pieza con código.
// La IA entrega imágenes de cualquier tamaño: aquí se fija la base en unidades del juego
// y el cargador escala la imagen para que su base ocupe exactamente esa huella isométrica.
// ============================================================================
export interface AssetDef { file: string; folder: 'edificios' | 'barcos' | 'personas' | 'objetos' | 'mercancias' | 'ui'; w: number; l: number; frames?: number }

export const ASSETS: Record<string, AssetDef> = {
  puesto_ambulante: { file: 'edif_puesto_ambulante', folder: 'edificios', w: 1, l: 1 },
  puesto_plaza: { file: 'edif_puesto_plaza', folder: 'edificios', w: 2, l: 1.5 },
  puesto_puerto: { file: 'edif_puesto_puerto', folder: 'edificios', w: 2, l: 1.5 },
  puesto_templo: { file: 'edif_puesto_templo', folder: 'edificios', w: 2.5, l: 1.5 },
  local_alfareros: { file: 'edif_local_alfareros', folder: 'edificios', w: 2.5, l: 2.5 },
  local_mercado: { file: 'edif_local_mercado', folder: 'edificios', w: 3, l: 3 },
  casa_comercio: { file: 'edif_casa_comercio', folder: 'edificios', w: 4, l: 3.5 },
  gran_bazar: { file: 'edif_gran_bazar', folder: 'edificios', w: 6, l: 5 },
  almacen_pequeno: { file: 'edif_almacen_pequeno', folder: 'edificios', w: 2, l: 2 },
  almacen_mediano: { file: 'edif_almacen_mediano', folder: 'edificios', w: 3, l: 3 },
  almacen_grande: { file: 'edif_almacen_grande', folder: 'edificios', w: 4, l: 4 },
  almacen_portuario: { file: 'edif_almacen_portuario', folder: 'edificios', w: 6, l: 4 },
  almacen_comercial: { file: 'edif_almacen_comercial', folder: 'edificios', w: 8, l: 6 },
  oficina_puerto: { file: 'edif_oficina_puerto', folder: 'edificios', w: 4, l: 4 },
  astillero: { file: 'edif_astillero', folder: 'edificios', w: 10, l: 5 },
  templo_melqart: { file: 'edif_templo_melqart', folder: 'edificios', w: 6, l: 5 },
  ...Object.fromEntries([1, 2, 3, 4, 5, 6].map(i => [`casa_${i}`, { file: `casa_0${i}`, folder: 'edificios', w: 2.5, l: 2.5 } as AssetDef])),
  barco_galera_se: { file: 'barco_galera_se_izada', folder: 'barcos', w: 7, l: 2.3 },
  barco_mercante_se: { file: 'barco_mercante_se_izada', folder: 'barcos', w: 9, l: 2.8 },
  barco_avanzado_se: { file: 'barco_avanzado_se_izada', folder: 'barcos', w: 12, l: 3.4 },
  pj_jugador: { file: 'pj_jugador', folder: 'personas', w: 0.5, l: 0.5, frames: 5 },
  pj_porteador: { file: 'pj_porteador', folder: 'personas', w: 0.5, l: 0.5, frames: 5 },
};

const cache = new Map<string, HTMLImageElement | null>();

/** Carga una pieza si existe. Devuelve null si no hay archivo (se usa el arte por código). */
export function loadAsset(id: string, base = './assets'): Promise<HTMLImageElement | null> {
  const def = ASSETS[id];
  if (!def) return Promise.resolve(null);
  if (cache.has(id)) return Promise.resolve(cache.get(id)!);
  return new Promise(res => {
    const img = new Image();
    img.onload = () => { cache.set(id, img); res(img); };
    img.onerror = () => { cache.set(id, null); res(null); };
    img.src = `${base}/${def.folder}/${def.file}.png`;
  });
}

/** Escala para que el ancho de la base isométrica (w + l unidades) coincida con la imagen recortada. */
export function assetScale(def: AssetDef, imgWidth: number, unitPx: number): number {
  return ((def.w + def.l) * unitPx) / imgWidth;
}
