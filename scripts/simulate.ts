// Simulador de balance: ejecuta el bot en varias semillas/ciudades y resume la progresión.
//   npm run simulate                    → Tiro, 3 semillas
//   npm run simulate -- sidon 5 1500    → ciudad, semillas, ciclos máximos
import { writeFileSync, mkdirSync } from 'node:fs';
import { createGame, LEVELS, MILESTONES, netWorth, prestigeRank } from '../src/economy';
import type { CycleReport, GameState } from '../src/economy/types';
import { botCycle } from './bot';

const [city = 'tiro', seedsArg = '3', maxArg = '1500'] = process.argv.slice(2);
const SEEDS = Number(seedsArg), MAX = Number(maxArg);

// Etapas del GDD §7 detectadas por la configuración del negocio
export const STAGES = [
  { n: 1,  name: 'Venta manual de 5 baratijas',     gdd: { rev: 25, varc: 20, fixed: 0, net: 5 } },
  { n: 2,  name: 'Venta manual de 50 baratijas',    gdd: { rev: 250, varc: 200, fixed: 0, net: 50 } },
  { n: 3,  name: 'Primer trabajador',               gdd: { rev: 500, varc: 400, fixed: 50, net: 50 } },
  { n: 4,  name: 'Primer puesto alquilado',         gdd: { rev: 1000, varc: 800, fixed: 100, net: 100 } },
  { n: 5,  name: 'Puesto y 2 trabajadores',         gdd: { rev: 2000, varc: 1600, fixed: 150, net: 250 } },
  { n: 6,  name: 'Primer local propio',             gdd: { rev: 3500, varc: 2800, fixed: 200, net: 500 } },
  { n: 7,  name: 'Local propio y almacén',          gdd: { rev: 6000, varc: 4600, fixed: 350, net: 1050 } },
  { n: 8,  name: 'Dos locales y 5 trabajadores',    gdd: { rev: 12000, varc: 9000, fixed: 700, net: 2300 } },
  { n: 9,  name: 'Negociación con proveedores',     gdd: { rev: 20000, varc: 14000, fixed: 1100, net: 4900 } },
  { n: 10, name: 'Distribución a comerciantes',     gdd: { rev: 35000, varc: 30000, fixed: 1500, net: 3500 } },
  { n: 11, name: 'Primer barco alquilado',          gdd: { rev: 55000, varc: 40000, fixed: 8000, net: 7000 } },
  { n: 12, name: 'Primera ruta automatizada',       gdd: { rev: 90000, varc: 65000, fixed: 12000, net: 13000 } },
  { n: 13, name: 'Primer barco propio',             gdd: { rev: 150000, varc: 105000, fixed: 18000, net: 27000 } },
  { n: 14, name: 'Flota de 3 barcos y contratos',   gdd: { rev: 300000, varc: 205000, fixed: 35000, net: 60000 } },
  { n: 15, name: 'Astillero propio y red comercial',gdd: { rev: 600000, varc: 400000, fixed: 70000, net: 130000 } },
];

export function stageOf(s: GameState, r: CycleReport | undefined): number {
  const locals = s.venues.filter(v => v.defId.startsWith('local') || v.defId.startsWith('casa') || v.defId.startsWith('gran')).length;
  const owned = s.ships.filter(x => x.owned).length;
  if (s.hasShipyard) return 15;
  if (s.ships.length >= 3) return 14;
  if (owned >= 1) return 13;
  if (s.autoRoutes.length) return 12;
  if (s.ships.length) return 11;
  if (s.milestones.includes(14)) return 10;
  if (s.stats.negotiationsWon > 0) return 9;
  if (locals >= 2 && s.workers.length >= 5) return 8;
  if (s.venues.some(v => v.owned) && s.warehouses.length) return 7;
  if (s.venues.some(v => v.owned)) return 6;
  if (s.venues.length && s.workers.length >= 2) return 5;
  if (s.venues.length) return 4;
  if (s.workers.length) return 3;
  return (r?.unitsSold ?? 0) > 20 ? 2 : 1;
}

interface Run {
  seed: number;
  milestones: Record<number, number>;
  levels: Record<number, number>;
  ranks: Record<number, number>;
  stages: Record<number, { first: number; cycles: number; rev: number; varc: number; fixed: number; net: number }>;
  curve: { cycle: number; netWorth: number; level: number; cash: number; profit: number }[];
  final: { cycle: number; netWorth: number; level: number; prestige: number; rank: number };
  arrearsCycles: number;
}

function run(seed: number): Run {
  const s = createGame(city, seed);
  const out: Run = { seed, milestones: { 1: 0 }, levels: { 1: 0 }, ranks: { 1: 0 }, stages: {}, curve: [], final: null as any, arrearsCycles: 0 };
  for (let c = 0; c < MAX; c++) {
    botCycle(s);
    const r = s.history[s.history.length - 1];
    for (const m of s.milestones) out.milestones[m] ??= s.time.cycle;
    for (let l = 1; l <= s.level; l++) out.levels[l] ??= s.time.cycle;
    const rk = prestigeRank(s);
    for (let k = 1; k <= rk; k++) out.ranks[k] ??= s.time.cycle;
    const st = stageOf(s, r);
    const e = (out.stages[st] ??= { first: s.time.cycle, cycles: 0, rev: 0, varc: 0, fixed: 0, net: 0 });
    e.cycles++; e.rev += r.revenue; e.varc += r.cogs + r.variable; e.fixed += r.fixed; e.net += r.netProfit;
    if (c % 5 === 0 || c < 60) out.curve.push({ cycle: s.time.cycle, netWorth: r.netWorth, level: s.level, cash: Math.round(s.cash), profit: Math.round(r.netProfit) });
    if (s.arrears > 0) out.arrearsCycles++;
    if (r.netWorth >= 12_000_000) break;
  }
  out.final = { cycle: s.time.cycle, netWorth: netWorth(s), level: s.level, prestige: Math.round(s.prestige), rank: prestigeRank(s) };
  return out;
}

const runs: Run[] = [];
for (let i = 0; i < SEEDS; i++) runs.push(run(1000 + i * 7919));

const median = (xs: number[]) => { const a = xs.filter(x => x !== undefined).sort((p, q) => p - q); return a.length ? a[Math.floor(a.length / 2)] : undefined; };
const fmt = (n: number | undefined) => n === undefined ? '—' : Math.round(n).toLocaleString('es');
const time = (c: number | undefined) => c === undefined ? '—' : `${c} ciclos (${(c / 60).toFixed(1)} h a ×1 · ${(c / 360).toFixed(1)} h a ×6)`;

const summary = {
  city, seeds: SEEDS, maxCycles: MAX,
  milestones: MILESTONES.map(m => ({ id: m.id, name: m.name, cycle: median(runs.map(r => r.milestones[m.id])), reachedBy: runs.filter(r => r.milestones[m.id] !== undefined).length })),
  levels: LEVELS.map(l => ({ level: l.level, cycle: median(runs.map(r => r.levels[l.level])), reachedBy: runs.filter(r => r.levels[l.level] !== undefined).length })),
  ranks: Array.from({ length: 10 }, (_, i) => ({ rank: i + 1, cycle: median(runs.map(r => r.ranks[i + 1])) })),
  stages: STAGES.map(st => {
    const rs = runs.map(r => r.stages[st.n]).filter(Boolean);
    const avg = (k: 'rev' | 'varc' | 'fixed' | 'net') => rs.length ? rs.reduce((a, e) => a + e[k] / e.cycles, 0) / rs.length : undefined;
    return { ...st, first: median(rs.map(e => e.first)), cycles: median(rs.map(e => e.cycles)), sim: { rev: avg('rev'), varc: avg('varc'), fixed: avg('fixed'), net: avg('net') } };
  }),
  curve: runs[0].curve,
  finals: runs.map(r => r.final),
  arrearsCycles: runs.map(r => r.arrearsCycles),
};

mkdirSync('docs', { recursive: true });
writeFileSync(`docs/balance-${city}.json`, JSON.stringify(summary, null, 1));

console.log(`\n=== FENICIA · Simulación de balance · ${city} · ${SEEDS} semillas · máx ${MAX} ciclos ===\n`);
console.log('Hitos (mediana):');
for (const m of summary.milestones) console.log(`  ${String(m.id).padStart(2)} ${m.name.padEnd(42)} ${time(m.cycle)}  [${m.reachedBy}/${SEEDS}]`);
console.log('\nNiveles (mediana):');
for (const l of summary.levels) console.log(`  Nv ${String(l.level).padStart(2)}  ${time(l.cycle)}  [${l.reachedBy}/${SEEDS}]`);
console.log('\nRangos de prestigio:', summary.ranks.map(r => `${r.rank}:${r.cycle ?? '—'}`).join('  '));
console.log('\nEtapas GDD §7 – promedio por ciclo (simulado vs GDD):');
for (const st of summary.stages) {
  console.log(`  ${String(st.n).padStart(2)} ${st.name.padEnd(34)} desde c${fmt(st.first).padStart(5)} · ${fmt(st.cycles).padStart(4)} ciclos | ingresos ${fmt(st.sim.rev).padStart(9)} (${fmt(st.gdd.rev)}) | var ${fmt(st.sim.varc).padStart(9)} (${fmt(st.gdd.varc)}) | fijos ${fmt(st.sim.fixed).padStart(7)} (${fmt(st.gdd.fixed)}) | neto ${fmt(st.sim.net).padStart(8)} (${fmt(st.gdd.net)})`);
}
console.log('\nFinal:', summary.finals.map(f => `c${f.cycle} nw ${fmt(f.netWorth)} Nv${f.level} rango ${f.rank}`).join(' | '));
console.log('Ciclos en mora:', summary.arrearsCycles.join(', '));
