// ============================================================================
// FENICIA · Enseñar al jugador (mejora 2): primeros pasos guiados, anuncio de cada función
// nueva (pausa el juego y explica qué es y dónde se usa), textos de información y el
// glosario completo de mensajes con su causa y su significado.
// ============================================================================

export interface TutorialStep { id: string; text: string; target?: string; button?: string }

/** Primeros pasos: se avanza haciendo lo que pide cada paso (la interfaz comprueba cuándo se cumple). */
export const TUTORIAL: TutorialStep[] = [
  { id: 'bienvenida', text: '<b>Eres un mercader de {ciudad}</b> con 20 monedas y una cesta. Nadie vende por ti: <b>tú mismo compras</b> mercancía barata en el mercado y <b>tú mismo la vendes</b> a los clientes, más cara. La diferencia es tu ganancia.', button: 'Empezar' },
  { id: 'abrir_mercado', text: 'Abre el <b>Mercado</b> en la barra de abajo.', target: '.nav [data-a="mercado"]' },
  { id: 'comprar', text: 'Compra <b>cuentas de vidrio</b>: toca <b>Máx</b> para gastar tus 20 monedas.', target: '[data-act="buy"][data-a="cuentas_vidrio"][data-q="max"]' },
  { id: 'pestana_vender', text: 'Ahora ve a la pestaña <b>Vender</b>.', target: '[data-act="tab"][data-a="vender"]' },
  { id: 'vender', text: 'Véndelas a los clientes: toca <b>Máx</b>.', target: '[data-act="sell"][data-q="max"]' },
  { id: 'ganancia', text: '¡Ganaste dinero! Así se crece: <b>compra, vende y repite</b>. Cada ciclo de 60 segundos llegan clientes nuevos; tú atiendes hasta 50 por ciclo. Mira el indicador junto a «Tienes»: la flecha verde significa que se vende.', button: 'Entendido' },
  { id: 'tiempo', text: '<b>Control del tiempo:</b> mantén el dedo sobre la ciudad y desliza <b>a la derecha</b> para acelerar ×6, <b>hacia abajo</b> para pausar y <b>hacia arriba</b> para volver a la velocidad normal. Con dos dedos acercas o alejas la ciudad. Toca el <b>escudo</b> para el menú de pausa.', button: 'Entendido' },
  { id: 'hitos', text: 'Arriba a la izquierda está tu <b>próximo hito</b>: al cumplirlo desbloqueas funciones nuevas (trabajadores, puestos, almacenes…). Tócalo para ver el camino completo.', target: '.top .hudhito', button: 'Listo' },
];

export interface Intro { title: string; icon: string; body: string; where: string; go?: string }

/** Ventana que se abre (y pausa el juego) la primera vez que se desbloquea cada función. */
export const INTROS: Record<number, Intro> = {
  2: { title: 'Contratos', icon: 'ui_contrato', body: 'Los clientes grandes te encargan cantidades fijas de una mercancía, a mejor precio que en el mercado y con un plazo. Si cumples ganas <b>prestigio</b>; si no llegas a tiempo, lo pierdes.', where: 'Mercado → pestaña <b>Contratos</b>.', go: 'contratos' },
  3: { title: 'Tu primer trabajador', icon: 'aviso_personal', body: 'Un <b>vendedor ambulante</b> recorre la calle y vende solo lo que tengas en tu inventario, aunque tú no estés vendiendo. Cobra su sueldo en cada cierre de ciclo, venda o no.', where: 'Toca <b>Tu puesto</b> en la plaza → Contratar vendedor.', go: 'lot:ambulante' },
  5: { title: 'Puestos', icon: 'hito_locales', body: 'Un <b>puesto</b> en la plaza atrae a muchos más clientes: cada vendedor que trabaja ahí vende el doble que en la calle. Se paga un alquiler por ciclo.', where: 'Toca un <b>solar</b> con estacas en el mapa → Alquilar.' },
  8: { title: 'Almacenes', icon: 'hito_almacenes', body: 'Tu cesta guarda poca mercancía. Un <b>almacén</b> te deja comprar en grande cuando está barato y vender después.', where: 'Toca el <b>solar del almacén</b> junto al muelle.', go: 'almacenes' },
  9: { title: 'Almaceneros', icon: 'hito_almacenes', body: 'Un <b>almacenero</b> repone solo las mercancías que vendes, comprando en el mercado cuando se acaban: mantiene en stock lo que se vendió en el último ciclo y la mitad más. En Almacenes puedes elegir, mercancía por mercancía, reponer en automático, hasta una cantidad fija o no reponer.', where: 'Almacenes → Contratar almacenero.', go: 'almacenes' },
  10: { title: 'Locales propios', icon: 'hito_locales', body: 'Un <b>local</b> tiene más plazas y más tráfico que un puesto, y puedes <b>comprarlo</b>: dejas de pagar alquiler (solo un pequeño mantenimiento) y suma a tu patrimonio.', where: 'Toca un <b>solar de local</b> en la ciudad.' },
  11: { title: 'Proveedores', icon: 'ui_proveedores', body: 'Los proveedores venden <b>lotes grandes</b> con descuento. Puedes regatear: ofrece menos y el proveedor acepta, contraoferta o rechaza si te pasas.', where: 'Mercado → pestaña <b>Proveedores</b>.', go: 'proveedores' },
  14: { title: 'Distribuir', icon: 'ui_distribuir', body: '<b>Vender</b> es atender a los clientes de la calle: mejor precio, pero pocos clientes. <b>Distribuir</b> es vender al por mayor a otros comerciantes: <b>menos margen</b> por unidad, pero te compran <b>mucha cantidad</b>.', where: 'Mercado → pestaña Vender → botón <b>Distribuir</b>.', go: 'vender' },
  30: { title: 'Rutas por tierra', icon: 'hito_tierra', body: 'En las <b>Caballerizas</b> alquilas carretas que llevan tu mercancía a los pueblos cercanos. Allí se vende <b>toda la carga</b> y la carreta vuelve. Es más barato que el mar, y el paso previo a tener barcos.', where: 'Toca las <b>Caballerizas</b> al oeste de la isla.', go: 'caballerizas' },
  31: { title: 'Contrato exclusivo', icon: 'ui_contrato_exclusivo', body: 'Has vendido 3.000 unidades de un producto: el proveedor te ofrece una <b>compra automática y permanente</b> cada ciclo, a precio rebajado. Tú decides cuántas unidades por ciclo.', where: 'Mercado → pestaña <b>Contratos</b> → Exclusivos.', go: 'contratos' },
  15: { title: 'Barcos', icon: 'hito_mar', body: 'Ya puedes <b>alquilar galeras</b>. Un barco lleva mucha carga a otros puertos y la vende allí entera. Es lo más caro y lo más rentable.', where: 'Barra de abajo → <b>Muelle</b>.', go: 'muelle' },
  17: { title: 'Expediciones', icon: 'hito_mar', body: 'Financia una <b>expedición</b> para descubrir rutas a puertos lejanos con mercancías y precios distintos.', where: 'Barra de abajo → <b>Mapa</b>.', go: 'mapa' },
  20: { title: 'Encargar barcos', icon: 'hito_astillero', body: 'Para tener <b>barcos propios</b> hace falta un astillero. Contrata el <b>astillero de la ciudad</b> (se paga por ciclo) y encarga un mercante: se construye en la grada en varios ciclos y después es tuyo.', where: 'Toca el <b>Astillero</b> junto al muelle.', go: 'astillero' },
  22: { title: 'Préstamos', icon: 'hito_finanzas', body: 'Pide prestado para invertir antes. Pagas una <b>cuota fija</b> cada ciclo: parte es capital y parte interés.', where: 'Toca la <b>Oficina del puerto</b> → Finanzas.', go: 'oficina' },
  23: { title: 'Talleres', icon: 'hito_finanzas', body: 'Compra una <b>participación en los talleres</b> de la ciudad (alfarería, vidrio, cedro, púrpura y bronce). Cada ciclo cobras un <b>dividendo</b> y compras su mercancía un <b>10% más barata</b>.', where: 'Toca un <b>taller</b> en la ciudad.', go: 'talleres' },
  24: { title: 'Astillero', icon: 'hito_astillero', body: 'Compra el <b>astillero</b>: los barcos te salen un 30% más baratos, se reparan a mitad de precio y se pueden mejorar. Ya no pagas el contrato por ciclo.', where: 'Toca el <b>Astillero</b> junto al muelle.', go: 'astillero' },
  28: { title: 'Monopolios', icon: 'ui_contrato_exclusivo', body: 'Controlas buena parte del mercado. Declara un <b>monopolio</b> en una mercancía con contrato exclusivo: en la ciudad la vendes un <b>20% más cara</b>, a cambio de una tasa por ciclo.', where: 'Mercado → Contratos → Exclusivos → <b>Monopolio</b>.', go: 'contratos' },
  29: { title: 'Tesoro del templo', icon: 'hito_finanzas', body: 'Deposita dinero en el <b>tesoro del templo</b>: rinde un 0,6% cada ciclo y lo retiras cuando quieras. Cuenta en tu patrimonio.', where: 'Toca el <b>{templo}</b>.', go: 'templo' },
};

/** Botones de información (mejora 2.3). */
export const INFO: Record<string, { title: string; text: string }> = {
  vendedor: { title: 'Vendedor', text: 'Trabaja <b>en este puesto o local</b> y vende solo lo que tengas en tu inventario. Aquí atiende a más clientes que en la calle (el tráfico del lugar multiplica sus ventas). Ocupa una plaza.' },
  ambulante: { title: 'Traer un ambulante', text: 'Si ya tienes un vendedor <b>caminando por la calle</b> (ambulante), lo mueves a este lugar sin contratar a nadie nuevo: no pagas un sueldo más y él vende más aquí.' },
  vender_distribuir: { title: 'Vender o distribuir', text: '<b>Vender</b>: a los clientes de la calle, al precio de venta, hasta los clientes que haya este ciclo. <b>Distribuir</b>: a otros comerciantes al por mayor, a un precio menor (compra + 10 %) pero en grandes cantidades; útil para lotes grandes o cuando se estanca la venta.' },
  almacenero: { title: 'Almacenero', text: 'Repone automáticamente las mercancías que se acaban, comprándolas en el mercado. Necesita un almacén (máximo 2 por almacén).' },
  indicadores: { title: 'Indicadores de venta', text: 'Junto a «Tienes» verás:<br><img class="px" src="./assets/ui/ind_vende.png" alt=""> <b>Flecha verde</b>: se está vendiendo ahora.<br><img class="px" src="./assets/ui/ind_estancado.png" alt=""> <b>Barra amarilla</b>: estancado; no quedan clientes para esta mercancía en este ciclo.<br><img class="px" src="./assets/ui/ind_exceso.png" alt=""> <b>Cajas</b>: tienes mucho más de lo que se vende; compra menos o distribuye.<br><img class="px" src="./assets/ui/ind_sin_stock.png" alt=""> <b>Flecha roja</b>: sin stock; no puedes venderla hasta reponer.' },
  restock: { title: 'Reposición', text: '<b>Auto</b>: el almacenero mantiene lo que se vendió en el último ciclo y la mitad más (si deja margen). <b>Fija</b>: repone hasta esa cantidad. <b>No</b>: no la repone. Nunca gasta la reserva para los gastos del próximo cierre.' },
  capitan: { title: 'Capitán', text: 'Un capitán propio cobra sueldo cada ciclo, pero ahorra el capitán por viaje y reduce el riesgo de piratas según su pericia.' },
};

export interface MessageInfo { message: string; when: string; meaning: string; todo: string }

/** Glosario completo de mensajes (mejora 2.4). También se publica como documento. */
export const MESSAGES: MessageInfo[] = [
  { message: 'Deuda pendiente: no alcanzó el dinero para pagar X de gastos', when: 'Al cerrar un ciclo, si los sueldos, alquileres, mantenimiento o cuotas superan tu dinero.', meaning: 'Esa cantidad queda como deuda (antes «obligaciones vencidas»). Cada ciclo sin pagar suma un 5 % de recargo.', todo: 'Oficina del puerto → Finanzas → «Pagar deudas». Vende o despide personal si se repite.' },
  { message: 'Los acreedores embargaron mercancía por X', when: 'Segundo ciclo seguido con deuda pendiente.', meaning: 'Se vendió parte de tu inventario al 60 % para cubrir la deuda.', todo: 'Paga las deudas en la Oficina del puerto cuanto antes.' },
  { message: 'N trabajador(es) renunciaron por falta de pago', when: 'Tercer ciclo seguido con deuda.', meaning: 'Una cuarta parte de tu personal se marcha.', todo: 'Pagar la deuda y reducir gastos fijos.' },
  { message: 'El dueño de un local rescindió tu alquiler por impago', when: 'Tercer ciclo con deuda y sin personal que se pueda ir.', meaning: 'Pierdes un local alquilado.', todo: 'Pagar las deudas.' },
  { message: 'Los acreedores remataron tu … por X', when: 'Deuda que no cubre el embargo de mercancía.', meaning: 'Un bien propio (barco, almacén o local) se vendió al 50 %.', todo: 'Evitar deudas: vigila «Costos fijos del próximo cierre» en Finanzas.' },
  { message: 'Bloqueo en X: el barco da media vuelta con su carga', when: 'Empieza un bloqueo portuario mientras un barco navega hacia ese puerto.', meaning: 'El barco vuelve sin vender; la carga regresa a tu almacén.', todo: 'Espera a que termine el bloqueo (Avisos) o envíalo a otro puerto.' },
  { message: 'No hay más clientes interesados en esta mercancía ahora', when: 'Vendes en persona y se agota la demanda de esa mercancía en el ciclo.', meaning: 'Lo que pusiste a la venta espera al próximo ciclo.', todo: 'Vende otra mercancía, distribúyela o espera.' },
  { message: 'Necesitas el astillero: contrata el de la ciudad o cómpralo', when: 'Intentas encargar un barco sin astillero.', meaning: 'Los barcos propios se construyen en un astillero.', todo: 'Astillero → Contratar (hito 20) o Comprar (hito 24).' },
  { message: 'BANCARROTA', when: 'Tu patrimonio queda negativo tras los remates.', meaning: 'Se cierran tus operaciones: personal, rutas y alquileres. Puedes seguir comerciando a mano.', todo: 'Compra y vende para recuperarte, o empieza otra partida.' },
  { message: 'Te quedan X monedas y los gastos fijos de los próximos 2 ciclos suman Y', when: 'Al comprar un lote grande que te deja con poco dinero (antes «tu caja quedó por debajo de la reserva»).', meaning: 'Es un aviso, no un error: puede que no cubras los gastos del próximo cierre.', todo: 'Vende antes de que acabe el ciclo o compra menos.' },
  { message: 'Tu almacenamiento está lleno / Solo te caben N unidades más', when: 'Al comprar más de lo que cabe.', meaning: 'Tu cesta, puestos y almacenes no tienen más espacio.', todo: 'Vende, o alquila un almacén (botón «Ver almacenes»). No se guarda en Avisos.' },
  { message: 'Dinero insuficiente', when: 'Al comprar o pagar algo que cuesta más de lo que tienes.', meaning: 'No alcanza el dinero.', todo: 'Vende primero. No se guarda en Avisos.' },
  { message: 'El tiempo está en pausa: no hay clientes en la calle', when: 'Al vender con el juego en pausa.', meaning: 'Con el tiempo detenido no llegan clientes.', todo: 'Quita la pausa (mantén pulsado y desliza hacia arriba).' },
  { message: 'Ya atendiste a todos los clientes que podías este ciclo', when: 'Al vender a mano más de 50 unidades en un ciclo.', meaning: 'Tú solo atiendes 50 clientes por ciclo.', todo: 'Espera al siguiente ciclo o contrata vendedores.' },
  { message: 'No hay más clientes interesados en esta mercancía ahora', when: 'Al vender un producto cuya demanda ya se agotó.', meaning: 'El indicador muestra el guion amarillo (venta estancada).', todo: 'Vende otro producto, distribúyelo o espera al siguiente ciclo.' },
  { message: 'Hito N: …', when: 'Al cumplir la condición de un hito.', meaning: 'Se desbloquea una función nueva; a veces se abre una ventana que la explica.', todo: 'Toca el hito (arriba a la izquierda) para ver el camino.' },
  { message: '¡Nivel N! … Nuevas mercancías', when: 'Al reunir experiencia, patrimonio y prestigio suficientes.', meaning: 'Puedes comerciar mercancías nuevas y más caras.', todo: 'Míralas en el Mercado.' },
  { message: 'Prestigio: ahora eres …', when: 'Al acumular puntos de prestigio (contratos, viajes, propiedades).', meaning: 'Subes de rango: se abren proveedores, contratos y mercancías restringidas.', todo: '—' },
  { message: '+N prestigio / −N prestigio', when: 'Al cumplir o incumplir contratos, saldar préstamos, tener deudas.', meaning: 'Cambia tu reputación.', todo: '—' },
  { message: 'Contrato cumplido / Incumpliste el contrato', when: 'Al entregar todo a tiempo o al vencer el plazo.', meaning: 'Ganas o pierdes prestigio (perder resta 1,5 veces lo que daba).', todo: 'Acepta solo contratos que puedas cumplir.' },
  { message: 'Contrato exclusivo: solo se pudieron recibir N de M', when: 'Al cierre, si no hay dinero o espacio para la compra automática.', meaning: 'Llega menos mercancía de la pactada.', todo: 'Libera espacio, ten dinero o baja la cantidad por ciclo.' },
  { message: 'Volvió tu carreta de … : lo vendió todo', when: 'Al regresar una carreta.', meaning: 'Resultado del viaje (ventas − costo de la mercancía − alquiler y arriero).', todo: '—' },
  { message: 'Bandidos asaltaron tu carreta', when: 'Al azar en el camino (más en rutas largas).', meaning: 'Se pierde parte de la carga.', todo: '—' },
  { message: 'El … volvió de … Resultado del viaje', when: 'Al regresar un barco.', meaning: 'Ganancia o pérdida del viaje completo.', todo: '—' },
  { message: 'Piratas asaltaron el …', when: 'Al azar en el mar; menos con escolta, buen capitán o casco reforzado.', meaning: 'Se pierde parte de la carga y el barco se daña.', todo: 'Contrata escolta o un capitán con pericia.' },
  { message: 'Sin espacio en almacén: N … se vendieron al por mayor', when: 'Un barco vuelve con carga de retorno que no cabe.', meaning: 'El excedente se vendió a precio mayorista.', todo: 'Amplía almacenes.' },
  { message: 'Expedición exitosa / regresó sin encontrar ruta', when: 'Al terminar una expedición.', meaning: 'Se descubre (o no) una ruta nueva.', todo: 'Financia con más presupuesto para más probabilidad.' },
  { message: 'Eventos (Feria, Malas cosechas, Piratería, Nuevos impuestos…)', when: 'Al azar cada cierto tiempo.', meaning: 'Cambian precios, demanda, impuestos o riesgos durante unos ciclos.', todo: 'Aprovecha la oportunidad o protégete.' },
  { message: 'Terminó: …', when: 'Fin de un evento.', meaning: 'Los precios vuelven a la normalidad.', todo: '—' },
  { message: 'Contrataste a … / Alquilaste … / … ahora es tuyo', when: 'Al contratar, alquilar o comprar.', meaning: 'Confirmación de la acción.', todo: '—' },
  { message: 'Préstamo de X: N cuotas de Y / Préstamo saldado', when: 'Al pedir o terminar de pagar un préstamo.', meaning: 'La cuota se cobra en cada cierre de ciclo.', todo: '—' },
  { message: 'Saldaste todas tus deudas / Saliste de la bancarrota', when: 'Al pagar toda la deuda pendiente.', meaning: 'Vuelves a estar al día.', todo: '—' },
];
