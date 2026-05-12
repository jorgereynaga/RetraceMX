# Manual de Usuario - Caja

## 1. Objetivo del rol
Registrar pagos de compra y venta, controlar saldos y dejar evidencia del cobro.

## 2. Alcance dentro del sistema
La pantalla trabaja como centro de cobro y permite alternar entre compras y ventas pendientes.

## 3. Modulos que utiliza
Caja y pagos, historial de compras, historial de ventas y consulta de tickets.

## 4. Flujo general de trabajo
1. Buscar la operacion pendiente.
2. Registrar el pago.
3. Confirmar el cobro.
4. Verificar el impacto en estado e inventario.

## 5. Procedimientos paso a paso
### 5.1 Buscar operacion
- Elegir modo compra o venta.
- Buscar por folio, cliente o estado.

### 5.2 Registrar pago
- Capturar metodo, monto recibido, monto aplicado, referencia y notas.

### 5.3 Confirmar
- Revisar el resumen.
- Guardar el pago.

## 6. Campos y datos que debe capturar
Metodo de pago, monto recibido, monto aplicado, cambio, referencia, notas y usuario cobrador.

## 7. Validaciones y reglas importantes
- No pagar sin operacion valida.
- No exceder el saldo.
- En compras, el inventario se materializa al quedar pagada la compra.

## 8. Errores comunes y como resolverlos
- Monto excedente: corregir antes de confirmar.
- Folio incorrecto: usar la busqueda.
- Pago ya cubierto: revisar historial.

## 9. Buenas practicas
- Confirmar el folio con el cliente.
- Registrar referencias claras.
- No usar un metodo de pago incorrecto por rapidez.

## 10. Casos especiales o contingencias
Si un pago ya afecto inventario, cualquier correccion debe seguir la politica de reversa o autorizacion especial.

## 11. Relacion con otros usuarios
Trabaja con Compras, Inventario y Ventas.

## 12. Preguntas frecuentes
- ¿Puedo cobrar una compra impresa? Si, si sigue pendiente.
- ¿Puedo cancelar un pago? Solo si el flujo lo permite.
