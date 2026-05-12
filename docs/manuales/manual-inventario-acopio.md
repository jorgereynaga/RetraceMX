# Manual de Usuario - Inventario / Acopio

## 1. Objetivo del rol
Controlar existencias, movimientos, ajustes y la relacion entre compra, proceso y venta.

## 2. Alcance dentro del sistema
Administra inventario por material y por centro. Tambien opera el catalogo de tipos de proceso y los procesos internos.

## 3. Modulos que utiliza
Inventarios, Procesamiento de materiales, Tipos de procesos, Materiales, Centros de acopio y reportes de trazabilidad.

## 4. Flujo general de trabajo
1. Revisar existencias y movimientos.
2. Confirmar procesos internos.
3. Aplicar ajustes solo con autorizacion.

## 5. Procedimientos paso a paso
### 5.1 Consultar stock
- Abrir Inventarios.
- Filtrar por material, centro o tipo de stock.

### 5.2 Confirmar proceso
- Revisar entradas, salidas y merma.
- Confirmar para afectar inventario.

### 5.3 Ajustar inventario
- Capturar motivo y referencia.
- Guardar solo si hay permiso.

## 6. Campos y datos que debe capturar
Centro, material, cantidad, unidad, tipo de movimiento, referencia, motivo, lote y observaciones.

## 7. Validaciones y reglas importantes
- No permitir cantidades negativas.
- No permitir movimientos por encima del stock disponible.
- La compra entra al inventario al pagarse.
- El proceso entra al inventario al confirmarse.

## 8. Errores comunes y como resolverlos
- Saldo negativo: revisar origen del movimiento.
- Ajuste no autorizado: pedir permiso.
- Proceso sin stock: validar inventario antes de confirmar.

## 9. Buenas practicas
- Mantener materiales bien clasificados.
- Usar lote cuando aplique.
- Documentar cada ajuste.

## 10. Casos especiales o contingencias
Si un proceso ya fue confirmado, la reversa debe hacerse de forma controlada y con permisos especiales.

## 11. Relacion con otros usuarios
Trabaja con Compras, Procesamiento, Ventas y Administracion.

## 12. Preguntas frecuentes
- ¿Cuando entra una compra al inventario? Al pagarse.
- ¿Puedo ajustar stock? Si, con permiso y motivo.
