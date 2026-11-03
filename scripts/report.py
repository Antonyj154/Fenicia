# Genera el informe de balance (HTML) a partir de docs/balance-<ciudad>.json
import json, sys, html
OUT = sys.argv[1]
CITIES = [('tiro','Tiro','media'),('sidon','Sidón','fácil'),('biblos','Biblos','fácil'),('cartago','Cartago','difícil'),('gadir','Gadir','difícil')]
D = {c: json.load(open(f'/home/user/fenicia/docs/balance-{c}.json')) for c,_,_ in CITIES}
def f(n):
    if n is None: return '—'
    return f"{round(n):,}".replace(',', '.')
def h(c): return '—' if c is None else f"{c}"
def hrs(c): return '' if c is None else f"{c/60:.1f} h · {c/360:.1f} h"
T = D['tiro']

def dev(sim, gdd):
    if sim is None or not gdd: return '<span class="chip mute">—</span>'
    r = sim / gdd
    cls = 'ok' if 0.66 <= r <= 1.5 else ('hi' if r > 1.5 else 'lo')
    return f'<span class="chip {cls}">×{r:.1f}</span>'

stage_rows = ''.join(f'''<tr><td class="n">{st['n']}</td><td>{html.escape(st['name'])}</td><td class="n">{h(st.get('first'))}</td>
<td class="n">{f(st['sim'].get('rev'))}</td><td class="n g">{f(st['gdd']['rev'])}</td>
<td class="n">{f(st['sim'].get('net'))}</td><td class="n g">{f(st['gdd']['net'])}</td><td>{dev(st['sim'].get('net'), st['gdd']['net'])}</td></tr>''' for st in T['stages'])

KEY = [3,5,10,14,15,20,22,24,27,29]
ms = {m['id']: m for m in T['milestones']}
city_hdr = ''.join(f'<th class="n">{n}<small>{d}</small></th>' for _,n,d in CITIES)
mil_rows = ''.join('<tr><td class="n">%d</td><td>%s</td>%s</tr>' % (i, html.escape(ms[i]['name']), ''.join(
    f'<td class="n">{h({m["id"]: m for m in D[c]["milestones"]}[i].get("cycle"))}</td>' for c,_,_ in CITIES)) for i in KEY)
lv_rows = ''.join('<tr><td class="n">Nv %d</td>%s</tr>' % (l, ''.join(
    f'<td class="n">{h(D[c]["levels"][l-1].get("cycle"))}</td>' for c,_,_ in CITIES)) for l in [3,6,10,13,15])
outcome = ''.join('<tr><td>%s</td><td class="n">%s</td><td class="n">%s</td></tr>' % (n,
    sum(1 for x in D[c]['finals'] if x['netWorth'] >= 12_000_000), len(D[c]['finals'])) for c,n,_ in CITIES)
ok_runs = sum(1 for c,_,_ in CITIES for x in D[c]['finals'] if x['netWorth'] >= 12_000_000)
all_runs = sum(len(D[c]['finals']) for c,_,_ in CITIES)
t24 = ms[24].get("cycle"); t3 = ms[3].get("cycle"); lv15 = T["levels"][14].get("cycle")

page = f'''<title>Balance económico FENICIA</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Marcellus&display=swap">
<style>
/* Informe de balance: libro de cuentas. Columna de lectura + tablas comparativas (simulado frente a GDD). */
:root {{ --bg:#f6f3ee; --panel:#fffdf9; --ink:#221c2b; --muted:#6c6474; --line:#e2dbd2; --purple:#7a1f5c; --soft:#f3e4ee; --bronze:#9a6a2b; --good:#2f7d4f; --bad:#b3322d; --warn:#a86400; --chip:#efe9e1;
  --display:"Marcellus","Palatino Linotype",Georgia,serif; --ui:"IBM Plex Sans",system-ui,sans-serif; --num:"IBM Plex Mono",ui-monospace,Menlo,monospace; }}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg:#17131c; --panel:#201a27; --ink:#efe8f0; --muted:#a79fb0; --line:#352c3e; --purple:#d877b5; --soft:#3a2135; --bronze:#d6a35c; --good:#5cc28a; --bad:#f07a73; --warn:#e0a040; --chip:#2b2333; color-scheme:dark; }} }}
:root[data-theme="dark"] {{ --bg:#17131c; --panel:#201a27; --ink:#efe8f0; --muted:#a79fb0; --line:#352c3e; --purple:#d877b5; --soft:#3a2135; --bronze:#d6a35c; --good:#5cc28a; --bad:#f07a73; --warn:#e0a040; --chip:#2b2333; color-scheme:dark; }}
* {{ box-sizing:border-box }}
body {{ background:var(--bg); color:var(--ink); font-family:var(--ui); font-size:15px; line-height:1.55; margin:0; }}
.wrap {{ max-width:980px; margin:0 auto; padding-left:max(16px, env(safe-area-inset-left,0px)); padding-right:max(16px, env(safe-area-inset-right,0px)); padding-block:32px 56px; display:grid; gap:28px; }}
header .eyebrow {{ font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }}
h1 {{ font-family:var(--display); font-weight:400; font-size:clamp(28px,5vw,40px); margin:4px 0 8px; color:var(--purple); text-wrap:balance; }}
h2 {{ font-family:var(--display); font-weight:400; font-size:22px; margin:0 0 6px; text-wrap:balance; }}
p {{ margin:0; max-width:68ch; }}
.lede {{ font-size:17px; }}
.muted {{ color:var(--muted); }}
.facts {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; }}
.fact {{ background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px 14px; display:grid; gap:2px; }}
.fact b {{ font-family:var(--num); font-variant-numeric:tabular-nums; font-size:22px; font-weight:500; }}
.fact span {{ font-size:13px; color:var(--muted); }}
section {{ display:grid; gap:10px; min-width:0; }}
.tbl {{ overflow-x:auto; background:var(--panel); border:1px solid var(--line); border-radius:10px; }}
table {{ width:100%; border-collapse:collapse; font-size:13.5px; }}
th {{ text-align:left; font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); font-weight:600; padding:9px 10px; border-bottom:1px solid var(--line); white-space:nowrap; }}
th small {{ display:block; text-transform:none; letter-spacing:0; font-weight:400; }}
td {{ padding:8px 10px; border-bottom:1px solid var(--line); }}
tr:last-child td {{ border-bottom:0; }}
.n {{ text-align:right; font-family:var(--num); font-variant-numeric:tabular-nums; white-space:nowrap; }}
.g {{ color:var(--muted); }}
.chip {{ display:inline-block; font-family:var(--num); font-size:12px; padding:1px 8px; border-radius:999px; background:var(--chip); }}
.chip.ok {{ color:var(--good); }} .chip.hi {{ color:var(--warn); }} .chip.lo {{ color:var(--bad); }} .chip.mute {{ color:var(--muted); }}
ol.dec {{ margin:0; padding-left:22px; display:grid; gap:10px; max-width:72ch; }}
ol.dec b {{ color:var(--purple); font-weight:600; }}
.note {{ background:var(--soft); border-radius:10px; padding:12px 14px; max-width:72ch; }}
</style>
<div class="wrap">
<header>
  <div class="eyebrow">FENICIA · Fase 1 · Motor económico</div>
  <h1>Balance económico</h1>
  <p class="lede">Un bot que juega como un comerciante sensato recorrió la partida completa en las cinco ciudades jugables, con 3 semillas por ciudad y hasta 1.500 ciclos. Así se ve la economía frente a la tabla §7 de tu GDD.</p>
</header>

<div class="facts">
  <div class="fact"><b>{h(t3)}</b><span>ciclos hasta el primer trabajador (Tiro)</span></div>
  <div class="fact"><b>{h(t24)}</b><span>ciclos hasta 1,5 M, hito del astillero ({hrs(t24).split(' · ')[0]} a ×1)</span></div>
  <div class="fact"><b>{h(lv15)}</b><span>ciclos hasta el nivel 15 (Tiro, mediana)</span></div>
  <div class="fact"><b>{ok_runs}/{all_runs}</b><span>partidas que llegaron a 12 M sin quebrar</span></div>
</div>

<section>
  <h2>Etapas del GDD §7, simulado frente a la tabla</h2>
  <p class="muted">Tiro, promedio por ciclo mientras el negocio estuvo en cada etapa. La etiqueta indica cuántas veces la ganancia neta simulada supera o queda por debajo de la tabla; en verde, dentro de un rango de ×0,66 a ×1,5. Algunas etapas no aparecen porque el bot pasa por ellas en el mismo ciclo.</p>
  <div class="tbl"><table>
    <thead><tr><th class="n">Etapa</th><th>Modelo de negocio</th><th class="n">Desde ciclo</th><th class="n">Ingresos</th><th class="n">GDD</th><th class="n">Neto</th><th class="n">GDD</th><th>Desvío</th></tr></thead>
    <tbody>{stage_rows}</tbody></table></div>
</section>

<section>
  <h2>Hitos por ciudad</h2>
  <p class="muted">Ciclo en que se alcanza cada hito (mediana de 3 partidas). Un ciclo dura 60 s a ×1 y 10 s a ×6.</p>
  <div class="tbl"><table><thead><tr><th class="n">Hito</th><th>Nombre</th>{city_hdr}</tr></thead><tbody>{mil_rows}</tbody></table></div>
  <div class="tbl"><table><thead><tr><th>Nivel</th>{city_hdr}</tr></thead><tbody>{lv_rows}</tbody></table></div>
</section>

<section>
  <h2>Qué está calibrado</h2>
  <p>De la etapa 9 a la 14, ingresos y ganancias quedan en el orden de magnitud de la tabla. La ruta Tiro–Sidón cuesta unas 1.100 monedas, como en el ejemplo §14.4. El préstamo de ejemplo (10.000 → 11.500 en 10 cuotas de 1.150) y la negociación 100 / 85 / 90 se reproducen exactamente, y están cubiertos por pruebas automáticas. Las ciudades difíciles exigen más: Cartago y Gadir tardan entre 150 y 210 ciclos en llegar al astillero, frente a 100–120 en Sidón y Biblos.</p>
</section>

<section>
  <h2>Decisiones que necesito de ti</h2>
  <ol class="dec">
    <li><b>Ritmo total.</b> Con la tabla §7 como referencia, 1,5 M llega hacia el ciclo {h(t24)}: unas {hrs(t24)} (a ×1 · a ×6). ¿Es la duración que buscas para una progresión «extensa»? Si quieres más, lo estiro desde un único parámetro.</li>
    <li><b>Final de partida.</b> Tras el astillero, la ganancia queda muy por debajo de la tabla: la etapa 15 da ≈ {f(T['stages'][14]['sim'].get('net'))} netos por ciclo frente a 130.000. Una flota grande satura la demanda de los puertos, y parte de las partidas acaba en bancarrota. Los hitos 23 (participación en negocios), 28 (monopolios) y 29 (inversiones avanzadas) no tienen reglas en el GDD y son el sitio natural para esa economía. ¿Quieres que proponga sus reglas?</li>
    <li><b>Inicio más ágil.</b> Las etapas 2 a 5 rinden de 3 a 14 veces lo que dice la tabla, porque las mercancías de niveles 2 a 5 se desbloquean pronto. Aun así, cada etapa dura pocos ciclos y el primer trabajador llega hacia el ciclo 3. ¿Lo dejo así o freno el arranque?</li>
    <li><b>Préstamos.</b> Con interés total fijo por contrato, el plazo más largo siempre es el más barato por ciclo. ¿Hago que el interés crezca con el plazo?</li>
  </ol>
</section>

<section>
  <h2>Reglas que propuse donde el GDD no decía nada</h2>
  <div class="note">Mora escalonada: aviso → embargo de mercancía al 60% → renuncias y remate de activos al 50% → bancarrota con operaciones cerradas. No se puede vender en persona con el tiempo en pausa. El inventario de puestos, locales y almacenes funciona como un solo fondo. Vendedor 50, almacenero 70 y coordinador 150 por ciclo. Barco mercante: mantenimiento 1.600 y amarre 250 por ciclo. Todos los valores están en <code>balance.ts</code> y en <code>docs/BALANCE.md</code>.</div>
</section>
</div>
'''
open(OUT,'w').write(page)
print('ok', len(page))
