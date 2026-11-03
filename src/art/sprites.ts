// Sprites ASCII colocados a mano (las formas pequeñas no salen bien de una fórmula).
import { C, sprite, type Sprite } from './kit';

const M = {
  k: C.ink, d: C.deep, s: C.sea, q: C.shallow, a: C.sky, v: C.green, o: C.stoneDk, t: C.stone, n: C.sand, c: C.cream,
  r: C.terra, R: C.terraDk, W: C.woodDk, w: C.wood, p: C.purple, g: C.gold,
};
const S = (rows: string[]) => sprite(rows, M);

// --------------------------------------------------------------------------- barra inferior (16x16)
export const ICONS: Record<'ciudad' | 'mercado' | 'muelle' | 'mapa', Sprite> = {
  // Templo de columnas con frontón
  ciudad: S([
    '.......kk.......',
    '.....kkggkk.....',
    '...kkggggggkk...',
    '.kkggggggggggkk.',
    'kkkkkkkkkkkkkkkk',
    'kccccccccccccccn',
    '.cn.cn.cn.cn.cn.',
    '.cn.cn.cn.cn.cn.',
    '.cn.cn.cn.cn.cn.',
    '.cn.cn.cn.cn.cn.',
    '.cn.cn.cn.cn.cn.',
    '.cn.cn.cn.cn.cn.',
    'kkkkkkkkkkkkkkkk',
    '.cccccccccccccn.',
    'cccccccccccccccn',
    '................',
  ]),
  // Balanza de mercader
  mercado: S([
    '.......gg.......',
    '..ggggggggggggg.',
    '..k....gw....k..',
    '.k.k...gw...k.k.',
    '.k.k...gw...k.k.',
    'k...k..gw..k...k',
    'ggggg..gw..ggggg',
    '.www...gw...www.',
    '.......gw.......',
    '.......gw.......',
    '.......gw.......',
    '.......gw.......',
    '.....ggggww.....',
    '....gggggwww....',
    '...gggggggwww...',
    '................',
  ]),
  // Ancla de piedra y madera
  muelle: S([
    '......gggg......',
    '.....g....g.....',
    '.....g....g.....',
    '......gggg......',
    '....ggggggww....',
    '.......gw.......',
    '.......gw.......',
    '.......gw.......',
    '.......gw.......',
    '.g.....gw.....g.',
    '.gg....gw....gw.',
    '..gg...gw...gw..',
    '...ggggggggww...',
    '.....gggwww.....',
    '................',
    '................',
  ]),
  // Mapa plegado con ruta y alfiler púrpura
  mapa: S([
    '...........pp...',
    '..........pccp..',
    '..........pppp..',
    '.ccccnnnnccppnn.',
    '.ccccnnnncc.pnn.',
    '.cr.cnnnncccnnn.',
    '.c.rcnnnnccccnn.',
    '.cc.rnnnnccccnn.',
    '.ccccnrnnccccnn.',
    '.ccccnn.rcccrnn.',
    '.ccccnnnnr.r.nn.',
    '.ccccnnnnccccnn.',
    '.ccccnnnnccccnn.',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
  ]),
};

// --------------------------------------------------------------------------- objetos del muelle
export const CRATE = S([
  'kkkkkkk',
  'kwwwwWk',
  'kwkkkWk',
  'kwkwkWk',
  'kwkkkWk',
  'kWWWWWk',
  'kkkkkkk',
]);
export const AMPHORA = S([
  '.kkk.',
  '.knk.',
  'knnnk',
  'kntnk',
  'kntok',
  '.kok.',
  '..k..',
]);
export const SACK = S([
  '.kkk.',
  'kcnnk',
  'kcnnk',
  'knnok',
  '.kkk.',
]);
export const BARREL = S([
  '.kkkk.',
  'kwwwWk',
  'kkkkkk',
  'kwwwWk',
  'kkkkkk',
  'kwwwWk',
  '.kkkk.',
]);

// --------------------------------------------------------------------------- gente (vista lateral, 3x7)
// Cabeza (piel = piedra), túnica de color, piernas. Dos poses de paso para caminar a saltos de celda.
const person = (tunic: string, legs: string[]) => S([
  '.k.',
  'ktk',
  `k${tunic}k`,
  `${tunic}${tunic}${tunic}`,
  `k${tunic}k`,
  ...legs,
]);
export const PEOPLE = {
  purple: [person('p', ['k.k', 'k.k']), person('p', ['.k.', 'k.k'])],
  cream: [person('c', ['k.k', 'k.k']), person('c', ['.k.', 'k.k'])],
  terra: [person('r', ['k.k', 'k.k']), person('r', ['.k.', 'k.k'])],
};
// Porteador con un saco al hombro
export const PORTER = S([
  'kkk..',
  'kcnk.',
  '.kkkk',
  '.ktk.',
  'krrrk',
  '.rrr.',
  '.krk.',
  '.k.k.',
]);

// --------------------------------------------------------------------------- HUD
export const COIN = S([
  '..kkkkk..',
  '.kggggnk.',
  'kgcggggWk',
  'kgggWggWk',
  'kggWkWgWk',
  'kgggWggWk',
  'kgggggWWk',
  '.kWWWWWk.',
  '..kkkkk..',
]);
export const ARROW_UP = S([
  '...k...',
  '..kvk..',
  '.kvvvk.',
  'kvvvvvk',
  'kkvvvkk',
  '.kvvvk.',
  '.kkkkk.',
]);
export const STAR = S([
  '....k....',
  '...kgk...',
  'kkkkgkkkk',
  'kgggggggk',
  '.kgggggk.',
  '..kgggk..',
  '.kggkggk.',
  'kgkk.kkgk',
  'kk.....kk',
]);
