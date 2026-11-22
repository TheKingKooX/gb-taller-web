# Módulo Archivado: Seguimiento de Reparación en Taller (GB)

Esta carpeta aísla la característica de **seguimiento en vivo de reparaciones en el taller** fuera de la aplicación activa (`index.html` y `admin.html`), conservando intacta su estructura para reintegrarla rápidamente cuando se decida activarla de nuevo.

## Contenido del Módulo
- `seguimiento-taller.js`: Lógica modular (`window.GBSeguimientoModule`) con el catálogo de etapas (`STAGES` 1–5), órdenes base (`DEFAULT_ORDERS`), persistencia sincronizada (`localStorage['gb_orders_v1']`), plantilla SVG del tacómetro y generador de avisos por WhatsApp.
- `seguimiento-standalone.html`: Vista independiente y completamente funcional que conserva tanto el **Tacómetro del Cliente (con consulta por placa)** como el **Panel de Control de Etapas 1–5 del Taller**, lista para pruebas o reintegración.

## Cómo reintegrarlo en el futuro
1. Incluir `<script src="modules/seguimiento-taller/seguimiento-taller.js"></script>` en `index.html` y `admin.html`.
2. Montar el bloque del tacómetro (`GBSeguimientoModule.renderTachometerCardHtml(...)`) debajo de `.moto-bar` en `#scr-inicio`.
3. Reactivar la pestaña `🔧 Taller` en `admin.html` conectada a `GBSeguimientoModule.loadOrders()` / `saveOrders()`.
