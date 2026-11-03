# FENICIA

Simulación económica y de gestión comercial (*tycoon*) ambientada en el Mediterráneo fenicio.

**Estado:** Fase 1 (motor económico) completa. Fase 2 (juego) en curso: ciudad isométrica jugable con el arte P1.

- `index.html` → **el juego**.
- `laboratorio.html` → laboratorio económico de la Fase 1.
- `assets/` → piezas de arte (PNG). Añadir un PNG con el nombre del encargo (`docs/especificacion-arte.html`) lo hace aparecer en el juego.

## Probarlo

```bash
npm install
npm run dev        # http://localhost:5173/juego.html (juego) y /index.html (laboratorio)
npm test           # 20 pruebas del motor (reglas del GDD §23, ejemplos del documento)
npm run simulate   # bot que juega la partida completa y compara con la tabla del GDD §7
npm run simulate -- cartago 5 1500   # ciudad, semillas, ciclos máximos
npm run build      # sitio estático en dist/
```

## Publicar en GitHub Pages

Sube **todo el contenido de esta carpeta** a la raíz del repositorio (no la carpeta `fenicia/` entera: `index.html` tiene que quedar en la raíz). Después ve a *Settings → Pages* y elige *Deploy from a branch → main → / (root)*.

`index.html` y `laboratorio.html` ya están compilados y son autónomos; el juego carga las imágenes desde la carpeta `assets/`, que debe subirse junto a ellos. Si cambias el código, ejecuta `npm run build`, que los regenera.

*Alternativa:* en *Settings → Pages* elige *Source: GitHub Actions*. El flujo `.github/workflows/deploy.yml` prueba, compila y publica `dist/` en cada push a `main`.

## Estructura

```
src/economy/            Motor económico (TypeScript puro, sin dependencias, sin DOM)
  index.ts              API pública: actions.* y consultas
  types.ts              Estado del juego (JSON serializable)
  balance.ts            TODOS los parámetros ajustables en un solo archivo
  data/                 Mercancías, puertos/ciudades, locales, almacenes, barcos, niveles, hitos, eventos
  ledger.ts             Contabilidad: único punto que mueve el dinero
  market.ts             Precios, demanda, oferta, fluctuaciones
  commerce.ts           Compra/venta, distribución, proveedores y negociación, contratos
  business.ts           Personal, establecimientos, almacenes
  automation.ts         Ventas, reposición y distribución automáticas dentro del ciclo
  maritime.ts           Barcos, viajes, piratería, expediciones, rutas, astillero
  finance.ts            Préstamos, mora, embargos y bancarrota
  progression.ts        Patrimonio, niveles, prestigio, hitos
  eventsEngine.ts       Acontecimientos del mercado
  simulation.ts         Bucle de tiempo (×0 / ×1 / ×6) y cierre contable del ciclo
  save.ts               Guardado de partidas independientes por ciudad
index.html              Laboratorio ya compilado en un solo archivo (lo que sirve GitHub Pages)
app/                    Código del laboratorio económico (interfaz de validación, no es la UI final)
scripts/bot.ts          Jugador automático "razonable"
scripts/simulate.ts     Informe de balance (docs/balance-<ciudad>.json)
tests/                  Pruebas (vitest)
docs/BALANCE.md         Decisiones de balance y puntos pendientes
```

## Cómo usar el motor desde la interfaz (Fase 2)

```ts
import { createGame, actions, advance, setSpeed, balanceSheet } from './src/economy';

const s = createGame('tiro');           // nueva partida
actions.buy(s, 'baratijas', 5);         // → { ok, error?, warning?, data? }
setSpeed(s, 6);                          // gesto "deslizar hacia adelante"
advance(s, deltaSegundosReales);         // en cada fotograma
balanceSheet(s).netWorth;                // patrimonio
```

Cada acción valida sus requisitos (hitos, nivel, prestigio, dinero, espacio) y devuelve el motivo si no se puede. El estado es un objeto plano: se guarda con `JSON.stringify`.
