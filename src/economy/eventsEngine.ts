// Acontecimientos económicos (GDD §17). Su duración se mide en ciclos.
import { BALANCE } from './balance';
import { EVENTS } from './data/events';
import { PORT_BY_ID } from './data/ports';
import { notify } from './ledger';
import { discoverRoute } from './maritime';
import { hasMilestone } from './progression';
import { nextId, rand, randInt } from './rng';
import type { GameState } from './types';

export function processEvents(s: GameState): void {
  const c = s.time.cycle;
  for (const e of s.events.filter(e => e.endCycle <= c)) notify(s, 'info', `Terminó: ${e.name}.`);
  s.events = s.events.filter(e => e.endCycle > c);
  if (s.events.length >= BALANCE.maxActiveEvents || rand(s) > BALANCE.eventChancePerCycle) return;
  const eligible = EVENTS.filter(d => s.level >= d.minLevel
    && (!d.requiresMilestone || hasMilestone(s, d.requiresMilestone))
    && !s.events.some(e => e.defId === d.id));
  if (!eligible.length) return;
  let r = rand(s) * eligible.reduce((a, d) => a + d.weight, 0);
  const def = eligible.find(d => (r -= d.weight) < 0) ?? eligible[0];
  const built = def.build ? def.build(s, () => rand(s)) : { effects: def.effects ?? {} };
  if (!built) return;
  let description = built.description ?? def.description;
  if (built.effects.blockedPort) description = description.replace(built.effects.blockedPort, PORT_BY_ID[built.effects.blockedPort].name);
  if (built.effects.discoverPort) {
    description = description.replace(built.effects.discoverPort, PORT_BY_ID[built.effects.discoverPort].name);
    discoverRoute(s, built.effects.discoverPort, def.name);
  }
  const dur = randInt(s, def.duration[0], def.duration[1]);
  s.events.push({ id: nextId(s, 'ev'), defId: def.id, name: def.name, description, startCycle: c, endCycle: c + dur, effects: built.effects });
  notify(s, 'evento', `${def.name}: ${description}`);
}
