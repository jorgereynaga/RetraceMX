# Manual de Usuario - Consulta / Reportes

## 1. Objetivo del rol
Revisar informacion operativa sin modificar datos.

## 2. Alcance dentro del sistema
Es un rol de lectura y control. Sirve para supervisar, auditar o validar trazabilidad.

## 3. Modulos que utiliza
Dashboard, Historial de compras, Historial de ventas, Inventarios, Procesamiento, Logistica, reportes y trazabilidad por lote.

## 4. Flujo general de trabajo
1. Abrir el dashboard o historial.
2. Filtrar por fecha, centro, material o folio.
3. Consultar trazabilidad y evidencias.

## 5. Procedimientos paso a paso
### 5.1 Consultar un folio
- Buscar por folio, comprador, proveedor o lote.

### 5.2 Revisar inventario
- Filtrar por centro y material.
- Validar movimiento y saldo.

### 5.3 Revisar trazabilidad
- Seguir el material desde compra, proceso y venta cuando aplique.

## 6. Campos y datos que debe capturar
Filtros de busqueda: fecha, centro, material, estado, folio, lote, comprador o proveedor.

## 7. Validaciones y reglas importantes
No debe existir edicion desde este rol. La informacion se usa para revision y control.

## 8. Errores comunes y como resolverlos
- Filtro muy amplio: limitar por fecha o folio.
- Folio no encontrado: validar que pertenezca al modulo correcto.
- Pantalla de auditoria ausente: usar historiales y reportes disponibles.

## 9. Buenas practicas
- Buscar por folio o lote.
- Validar cantidades, fechas y estados finales.
- Usar reportes para corroborar lo que se ve en pantalla.

## 10. Casos especiales o contingencias
La auditoria completa existe en backend y por historial; si falta una pantalla dedicada, se consulta por modulos de historial.

## 11. Relacion con otros usuarios
Apoya a administracion, inventario, ventas y auditoria interna.

## 12. Preguntas frecuentes
- ¿Puedo modificar algo? No.
- ¿Puedo ver trazabilidad? Si.
