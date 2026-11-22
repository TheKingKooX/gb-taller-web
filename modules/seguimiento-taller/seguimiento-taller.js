/**
 * MÓDULO DESACOPLADO: Seguimiento de Reparación en Taller (GB Taller y Repuestos)
 * Estado: Archivado fuera de la app principal (index.html / admin.html) para fácil reintegración futura.
 * Almacenamiento compartido: localStorage['gb_orders_v1']
 */
(function (global) {
  const STORAGE_KEY = 'gb_orders_v1';

  const STAGES = {
    1: { ang: -72, fill: 20, short: 'Recibida', step: 'Etapa 1 de 5', title: 'Recibida en taller', desc: 'Moto registrada en recepción con Andrés.' },
    2: { ang: -36, fill: 40, short: 'Diagnóstico', step: 'Etapa 2 de 5', title: 'En diagnóstico', desc: 'Inspección de transmisión, frenos y fluidos.' },
    3: { ang: 0,   fill: 60, short: 'Aprobado', step: 'Etapa 3 de 5', title: 'Presupuesto aprobado', desc: 'Cotización confirmada por WhatsApp.' },
    4: { ang: 45,  fill: 75, short: 'Reparación', step: 'Etapa 4 de 5', title: 'En reparación', desc: 'Instalando kit de arrastre DID 428 Oro.' },
    5: { ang: 82,  fill: 100, short: '¡Lista!', step: 'Etapa 5 de 5', title: '¡Lista para entrega!', desc: 'Prueba de ruta superada. Lista en Taller GB.' }
  };

  const DEFAULT_ORDERS = [
    { id: '#0231', plate: 'ABC-123', client: 'Carlos Mendoza', phone: '987654321', motoKey: 'msx', stage: 4, mech: 'Andrés', budget: 280, eta: 'Hoy, 5:00 pm', note: 'Instalando kit de arrastre DID 428 Oro y pastillas Brembo.' },
    { id: '#0234', plate: '4582-JM', client: 'Luis Quispe', phone: '945112890', motoKey: 'nmax', stage: 5, mech: 'Andrés', budget: 220, eta: '¡Lista hoy!', note: 'Cambio de faja CVT Yamaha y rodillos Dr. Pulley completado. Prueba de ruta OK.' },
    { id: '#0238', plate: '9104-KP', client: 'Marco Paredes', phone: '912334567', motoKey: 'pulsar', stage: 2, mech: 'Jhonatan', budget: 140, eta: 'Mañana 11 am', note: 'Revisión de triple bujía DTS-i, limpieza de inyector y nivel de refrigerante.' }
  ];

  function loadOrders() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return JSON.parse(JSON.stringify(DEFAULT_ORDERS));
  }

  function saveOrders(orders) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch (_) {}
  }

  function buildOrderWhatsAppNotifyUrl(ord, motoLabel, webUrl) {
    const st = STAGES[ord.stage] || STAGES[4];
    const phone51 = '51' + String(ord.phone || '').replace(/\D/g, '').slice(-9);
    const txt =
`Hola *${ord.client}*! Te escribimos de *GB Taller y Repuestos* 🏍️🔧

Actualización de tu orden *${ord.id}*:
• *Moto:* ${motoLabel || ord.motoKey} (Placa *${ord.plate}*)
• *Estado actual:* ${st.step} — *${st.title}*
• *Detalle:* ${ord.note}
• *Entrega estimada:* ${ord.eta}
• *Presupuesto:* S/ ${Number(ord.budget || 0).toLocaleString('es-PE')}

Consulta tu tacómetro en vivo: ${webUrl || 'https://thekingkoox.github.io/gb-taller-web/'}`;
    return `https://wa.me/${phone51}?text=${encodeURIComponent(txt)}`;
  }

  function renderTachometerCardHtml(order) {
    const o = order || DEFAULT_ORDERS[0];
    const st = STAGES[o.stage] || STAGES[4];
    return `
      <section class="gb-track-widget" data-order-id="${o.id}">
        <div class="track-h">
          <span>Orden ${o.id} · ${o.client.split(' ')[0]} (${o.plate})</span>
          <span class="eta">${o.eta}</span>
        </div>
        <svg class="gauge" viewBox="0 0 240 126" aria-hidden="true">
          <defs><linearGradient id="oroGradMod" x1="0" x2="1"><stop offset="0" stop-color="#F5B700"/><stop offset="1" stop-color="#FFE07D"/></linearGradient></defs>
          <path class="g-track" d="M26 116 A94 94 0 0 1 214 116" pathLength="100"/>
          <path class="g-fill" d="M26 116 A94 94 0 0 1 214 116" pathLength="100" style="stroke-dasharray:${st.fill} 100"/>
          <g class="needle" style="transform:rotate(${st.ang}deg)">
            <line x1="120" y1="116" x2="120" y2="44"/>
            <circle cx="120" cy="46" r="2.5" fill="#FFE07D"/>
          </g>
          <circle class="hub" cx="120" cy="116" r="6.5"/>
        </svg>
        <div class="stage">
          <small>${st.step}</small>
          <strong>${st.title}</strong>
          <p>${o.note || st.desc}</p>
        </div>
      </section>
    `;
  }

  global.GBSeguimientoModule = {
    STORAGE_KEY,
    STAGES,
    DEFAULT_ORDERS,
    loadOrders,
    saveOrders,
    buildOrderWhatsAppNotifyUrl,
    renderTachometerCardHtml
  };
})(window);
