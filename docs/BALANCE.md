# FENICIA · Balance económico (Fase 1)

Este documento recoge cómo se implementó cada sistema del GDD v1.3, qué valores se propusieron donde el GDD no los fija y qué queda pendiente de decisión. Todos los valores viven en `src/economy/balance.ts` y `src/economy/data/`.

## 1. Decisiones tomadas

| Tema | Decisión | Dónde |
|---|---|---|
| Ciclo | 60 s a ×1, 10 s a ×6, pausa detiene todo (GDD §3–4) | `simulation.ts` |
| Ventas manuales en pausa | Bloqueadas: "no hay clientes en la calle". Comprar y gestionar sí se permite. | `commerce.sell` |
| Interés de préstamos | **Total por contrato** (Tiro 15%), cuotas fijas por ciclo que separan capital e interés. Pasivo = capital pendiente. | `finance.ts` |
| Inventario | Un fondo único cuya capacidad suma cesta (60), puestos, locales y almacenes. | `inventory.ts` |
| Valor del inventario | A precio de compra actual del mercado local (reposición). La carga en barcos, al costo. | `progression.balanceSheet` |
| Contabilidad | Devengo: el costo de la mercancía se reconoce al venderla; la compra es un movimiento de inventario. Inversiones fuera del resultado. | `ledger.ts` |
| Hitos monetarios | Se miden sobre el **patrimonio neto**. | `progression.ts` |
| Niveles | Requieren XP (margen bruto ganado), patrimonio mínimo y rango de prestigio mínimo. | `data/catalog.ts` |
| Mercancías 11–15 | Restringidas por prestigio (rangos 4 a 8). | `data/goods.ts` |
| Ventas manuales | Hasta 50 clientes por ciclo atendidos en persona. | `balance.ts` |
| Trabajadores | Vendedor 50, almacenero 70, coordinador 150 por ciclo (×modificador de ciudad). | `balance.ts` |
| Capacidad de venta | 100 u/ciclo por vendedor × tráfico del lugar (ambulante 1, puestos 2–2,6, locales 2,5–4). | `data/catalog.ts` |
| Negociación | Mínimo oculto 6–14% bajo la referencia (+5% en lotes mayoristas). ≥ mínimo: acepta; hasta el doble de esa distancia: contraoferta al mínimo; más abajo: rechazo. 3 intentos. Reproduce el ejemplo 100 / 85 / 90. | `commerce.negotiate` |
| Distribución | Precio = compra × 1,10 (ejemplo GDD §13), logística 3% del valor. | `balance.ts` |
| Viaje de ejemplo | Tiro–Sidón en galera: alquiler 500, capitán 150, tripulación 200, carga ≈100, tasas ≈45, escolta 100 ⇒ ≈1.100 (GDD §14.4). | `maritime.estimateVoyageCosts` |
| Mora | 1.er ciclo: aviso y −6 de prestigio. 2.º: embargo de mercancía al 60%. 3.º: renuncia ¼ de la plantilla, se rescinde un alquiler y se rematan activos al 50%. Patrimonio negativo: bancarrota (se cierran operaciones, se congelan recargos). | `finance.ts` |
| Saturación de mercado | Vender o comprar grandes volúmenes mueve el precio de forma moderada (≈ −10% con saturación sostenida). | `market.fluctuate` |

## 2. Cómo se validó

* **20 pruebas automáticas** (`npm test`): tiempo y pausa, etapa 1 exacta (5 baratijas → +5), sin ingresos sin inventario, demanda y capacidad respetadas, cuadre de caja contra el libro en cada ciclo, sin doble conteo al comprar activos, costos fijos sin duplicar, negociación del ejemplo, préstamo del ejemplo, viaje del ejemplo, rutas automáticas, hitos, independencia entre nivel y prestigio, ciudades distintas, determinismo, mora y bancarrota.
* **Simulador de balance** (`npm run simulate`): un bot juega la partida completa con decisiones sensatas. Mide tiempos de hitos y niveles y compara el resultado medio por ciclo de cada etapa con la tabla §7.

Los resultados de la última simulación están en `docs/balance-<ciudad>.json` y en el informe publicado.

## 3. Pendiente de decisión

1. **Ritmo total.** El astillero (1,5 M) llega hacia el ciclo 100–120 en ciudades fáciles o medias (unas 2 h a ×1, 20 min a ×6) y hacia el 150–210 en las difíciles. Para una progresión "extensa" probablemente convenga estirarlo (subir exigencias de nivel, bajar márgenes o limitar más la demanda).
2. **Final de partida.** Después del astillero, la ganancia por ciclo queda por debajo de la tabla (etapa 15: ≈ 20 mil netos frente a 130 mil), y una flota grande satura los puertos: 3 de 15 partidas simuladas acabaron en bancarrota en esa fase. Los hitos 23 (participación en negocios), 28 (monopolios) y 29 (inversiones avanzadas) están sin reglas en el GDD y son el lugar natural para la economía de final de partida.
3. **Inicio más ágil que la tabla.** Las etapas 2 a 5 rinden entre 3 y 14 veces lo previsto, porque las mercancías de niveles 2–5 se desbloquean pronto; cada etapa dura pocos ciclos y el primer trabajador llega hacia el ciclo 3. Se puede frenar si se prefiere un inicio más pausado.
4. **Préstamos.** Con interés total fijo, el plazo más largo siempre es el más barato por ciclo. Se puede escalar el interés con el plazo.
5. **Depreciación** de activos (prevista "más adelante" en GDD §21): no aplicada; los activos se valoran a precio de compra.
