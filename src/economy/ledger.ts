// ============================================================================
// Contabilidad. ÚNICO punto que modifica s.cash → garantiza consistencia (GDD §23).
//
// Cuentas (el importe se registra siempre en positivo; la cuenta define el efecto):
//   revenue.*         ingreso bruto                   caja +   resultado +
//   cogs.*            costo de mercancía vendida      caja =   resultado −   (la caja salió al comprar)
//   variable.*        costos variables                caja −   resultado −
//   fixed.*           costos fijos recurrentes        caja −   resultado −
//   interest.*        intereses y recargos            caja −   resultado −
//   loss.*            pérdidas no monetarias          caja =   resultado −   (carga perdida, venta de activos bajo valor)
//   inventory.*       compra de mercancía             caja −   (pasa a inventario, no es gasto)
//   investment.*      inversiones únicas              caja −   (pasa a activos, no es gasto)
//   loan_in.*         capital recibido                caja +   (pasivo)
//   loan_principal.*  devolución de capital           caja −   (reduce pasivo)
//   asset_sale.*      venta de activos                caja +
//   arrears_paid.*    pago de obligaciones vencidas   caja −   (reduce pasivo; el gasto ya se registró)
// ============================================================================
import { BALANCE } from './balance';
import type { CycleReport, GameState } from './types';

const CASH_SIGN: Record<string, number> = {
  revenue: 1, cogs: 0, variable: -1, fixed: -1, interest: -1, loss: 0,
  inventory: -1, investment: -1, loan_in: 1, loan_principal: -1, asset_sale: 1, arrears_paid: -1,
};

export function emptyReport(cycle: number, cash: number): CycleReport {
  return { cycle, lines: {}, cashStart: cash, cashEnd: cash, netWorth: 0, revenue: 0, cogs: 0, variable: 0, fixed: 0, interest: 0, losses: 0, netProfit: 0, unitsSold: 0 };
}

/**
 * Registra un movimiento. Para costos que se pagan aunque no haya caja (fijos, cuotas),
 * usar allowArrears=true: lo que no se pueda pagar pasa a obligaciones vencidas.
 */
export function post(s: GameState, key: string, amount: number, note?: string, allowArrears = false): void {
  if (!(amount > 0) || !isFinite(amount)) return;
  amount = Math.round(amount * 100) / 100;
  const account = key.split('.')[0];
  const sign = CASH_SIGN[account];
  if (sign === undefined) throw new Error(`Cuenta desconocida: ${key}`);
  if (sign < 0) {
    if (allowArrears && s.cash < amount) {
      const paid = Math.max(0, s.cash);
      s.arrears += amount - paid;
      s.cash -= paid;
    } else {
      s.cash -= amount;
    }
  } else if (sign > 0) {
    s.cash += amount;
  }
  s.cash = Math.round(s.cash * 100) / 100;
  const r = s.current;
  r.lines[key] = (r.lines[key] ?? 0) + amount;
  switch (account) {
    case 'revenue': r.revenue += amount; break;
    case 'cogs': r.cogs += amount; break;
    case 'variable': r.variable += amount; break;
    case 'fixed': r.fixed += amount; break;
    case 'interest': r.interest += amount; break;
    case 'loss': r.losses += amount; break;
  }
  s.ledger.push({ cycle: s.time.cycle, key, amount, note });
  if (s.ledger.length > BALANCE.ledgerLength) s.ledger.splice(0, s.ledger.length - BALANCE.ledgerLength);
}

export function finalizeReport(r: CycleReport): void {
  r.netProfit = Math.round((r.revenue - r.cogs - r.variable - r.fixed - r.interest - r.losses) * 100) / 100;
}

export function notify(s: GameState, kind: GameState['notifications'][number]['kind'], text: string): void {
  s.notifications.push({ cycle: s.time.cycle, kind, text });
  if (s.notifications.length > BALANCE.notificationsLength) s.notifications.splice(0, s.notifications.length - BALANCE.notificationsLength);
}

/** Etiquetas legibles de las subcuentas para la interfaz. */
export const LEDGER_LABELS: Record<string, string> = {
  'revenue.manual': 'Ventas propias', 'revenue.auto': 'Ventas de trabajadores', 'revenue.wholesale': 'Distribución a comerciantes',
  'revenue.maritime': 'Ventas en puertos', 'revenue.contracts': 'Contratos', 'revenue.home_wholesale': 'Venta de excedente al desembarcar', 'revenue.liquidacion': 'Remate de inventario por acreedores', 'revenue.tierra': 'Ventas en pueblos (carretas)', 'revenue.dividendos': 'Dividendos de talleres', 'revenue.tesoro': 'Intereses del tesoro del templo',
  'cogs.goods': 'Costo de mercancía vendida',
  'variable.logistica': 'Logística de distribución', 'variable.alquiler_barco': 'Alquiler de barco (por viaje)', 'variable.capitan': 'Capitán por viaje',
  'variable.tripulacion': 'Tripulación', 'variable.carga': 'Carga y descarga', 'variable.tasas_portuarias': 'Tasas portuarias',
  'variable.proteccion': 'Protección', 'variable.expedicion': 'Expediciones', 'variable.transporte_tierra': 'Carretas y arrieros',
  'fixed.salarios': 'Salarios', 'fixed.alquiler_locales': 'Alquiler de puestos y locales', 'fixed.alquiler_almacenes': 'Alquiler de almacenes',
  'fixed.mantenimiento_propiedades': 'Mantenimiento e impuestos de propiedades', 'fixed.mantenimiento_barcos': 'Mantenimiento de barcos',
  'fixed.amarre': 'Amarre', 'fixed.capitanes': 'Salarios de capitanes', 'fixed.astillero': 'Personal y mantenimiento del astillero',
  'fixed.rutas': 'Mantenimiento de rutas', 'fixed.monopolios': 'Tasas de monopolio', 'fixed.alquiler_barcos': 'Alquiler de barcos (por ciclo)', 'fixed.reparaciones': 'Reparaciones',
  'interest.prestamos': 'Intereses de préstamos', 'interest.mora': 'Recargo por mora',
  'loss.pirateria': 'Carga perdida por piratería', 'loss.bandidos': 'Carga robada por bandidos', 'loss.venta_activos': 'Pérdida en venta de activos',
  'inventory.mercado': 'Compras en el mercado', 'inventory.proveedor': 'Compras a proveedores', 'inventory.puerto': 'Compras en puertos',
  'inventory.reposicion': 'Reposición automática',
  'investment.local': 'Compra de locales', 'investment.almacen': 'Compra de almacenes', 'investment.barco': 'Compra y construcción de barcos',
  'investment.astillero': 'Compra del astillero', 'investment.mejora': 'Mejoras de barcos', 'investment.caballerizas': 'Caballerizas', 'investment.taller': 'Participación en talleres', 'investment.tesoro': 'Depósitos en el tesoro',
  'loan_in.prestamo': 'Préstamo recibido', 'loan_principal.prestamo': 'Devolución de capital',
  'asset_sale.activo': 'Venta de activos', 'arrears_paid.mora': 'Pago de deudas pendientes',
};
