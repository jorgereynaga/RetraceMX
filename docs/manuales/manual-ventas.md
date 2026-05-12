# Manual de Usuario - Comercializacion / Ventas

## 1. Objetivo del rol
Registrar ventas de materiales crudos o procesados, controlar precios y dejar lista la salida comercial.

## 2. Alcance dentro del sistema
Puede vender materiales sin procesar o procesados. La venta puede ser de contado o a credito segun la configuracion de la operacion.

## 3. Modulos que utiliza
Ventas, Historial de ventas, Listas de precios, Materiales, Personas / Empresas y, cuando aplica, Logistica y Caja.

## 4. Flujo general de trabajo
1. Crear la orden de venta.
2. Seleccionar comprador, materiales y cantidades.
3. Confirmar precio, lote y cantidad.
4. Cerrar la venta o enviarla a caja / logistica.

## 5. Procedimientos paso a paso
### 5.1 Crear venta
- Abrir una venta nueva.
- Capturar comprador, condiciones y partidas.

### 5.2 Agregar material
- Elegir material.
- Capturar cantidad, precio y lote si existe.

### 5.3 Confirmar venta
- Revisar totales y stock.
- Cerrar la venta o dejarla lista para caja / entrega.

## 6. Campos y datos que debe capturar
Comprador, tipo de venta, condiciones de pago, material, lote, cantidad, precio unitario, precio negociado, notas y datos de transporte.

## 7. Validaciones y reglas importantes
- No vender mas inventario del disponible.
- No aceptar cantidades negativas.
- No cerrar una venta con partidas invalidas.

## 8. Errores comunes y como resolverlos
- Falta de stock: revisar inventario antes de confirmar.
- Precio incorrecto: corregir antes de cerrar.
- Lote inexistente: validar trazabilidad.

## 9. Buenas practicas
- Confirmar precio antes de cerrar.
- Usar lote cuando exista.
- Documentar descuentos o negociaciones.

## 10. Casos especiales o contingencias
Si la venta es a credito o con entrega programada, coordinar con Caja y Logistica.

## 11. Relacion con otros usuarios
Se coordina con Inventario, Caja y Logistica.

## 12. Preguntas frecuentes
- ¿Puedo vender material procesado? Si.
- ¿Puedo vender material crudo? Si, si hay stock.
