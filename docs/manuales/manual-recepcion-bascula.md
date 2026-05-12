# Manual de Usuario - Recepcion / Bascula

## 1. Objetivo del rol
Registrar la entrada de material, capturar pesaje y construir la compra con sus partidas.

## 2. Alcance dentro del sistema
Opera la compra en el punto de recepcion y pesaje. El flujo es el de una compra central con una o varias partidas.

## 3. Modulos que utiliza
Compra de materiales, modulo de pesaje, ticket operativo e historial de compras.

## 4. Flujo general de trabajo
1. Iniciar una compra nueva.
2. Seleccionar cliente, centro, vehiculo y material.
3. Capturar pesaje.
4. Agregar la partida.
5. Imprimir el ticket cuando la operacion este lista.

## 5. Procedimientos paso a paso
### 5.1 Abrir compra
- Entrar a Compra de materiales.
- Crear una operacion nueva.

### 5.2 Capturar pesaje
- Registrar peso vehicular o lectura directa.
- Verificar tara, bruto y neto.

### 5.3 Agregar partidas
- Seleccionar material.
- Capturar merma, precio y notas.

### 5.4 Imprimir ticket
- Emitir ticket cuando la compra ya este armada.
- Recordar que imprimir no equivale a pagar.

## 6. Campos y datos que debe capturar
Cliente o proveedor, centro de acopio, vehiculo, conductor, material, tipo de pesaje, bruto, tara, neto, merma, precio, notas.

## 7. Validaciones y reglas importantes
- No permitir peso neto negativo.
- No permitir partidas sin material.
- La compra no se inventaria hasta que quede pagada.

## 8. Errores comunes y como resolverlos
- Lectura inestable: repetir lectura o usar contingencia si aplica.
- Dispositivo no conectado: revisar hardware o usar captura manual.
- Material incorrecto: corregir antes del pago.

## 9. Buenas practicas
- Verificar que la lectura corresponda al vehiculo correcto.
- Revisar merma y precio antes de imprimir.
- Documentar observaciones de la operacion.

## 10. Casos especiales o contingencias
Si falla la bascula, usar captura manual de contingencia con motivo. Si ya se imprimio y no hay pago, la operacion sigue siendo cancelable.

## 11. Relacion con otros usuarios
Coordina con Compras para el cierre, con Caja para el cobro y con Inventario para la materializacion del stock.

## 12. Preguntas frecuentes
- ¿Imprimir confirma? No.
- ¿Puedo cancelar despues de imprimir? Si, mientras no haya pago.
