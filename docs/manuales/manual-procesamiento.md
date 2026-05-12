# Manual de Usuario - Procesamiento de materiales

## 1. Objetivo del rol
Transformar materiales comprados en materiales procesados, registrar merma y dejar trazabilidad entre entrada y salida.

## 2. Alcance dentro del sistema
El catalogo de tipos de proceso se administra desde Catalogos. Aqui se ejecuta el proceso operativo.

## 3. Modulos que utiliza
Procesamiento de materiales, Tipos de procesos, Inventarios y trazabilidad por lote.

## 4. Flujo general de trabajo
1. Crear proceso en borrador.
2. Capturar entradas, salidas y merma.
3. Confirmar para afectar inventario.

## 5. Procedimientos paso a paso
### 5.1 Crear proceso
- Seleccionar tipo de proceso.
- Elegir centro.
- Capturar fecha y notas.

### 5.2 Capturar entradas
- Agregar materiales de entrada.
- Capturar cantidades y unidad.

### 5.3 Capturar salidas
- Registrar materiales de salida.
- Capturar cantidad y `lot_code` si aplica.

### 5.4 Capturar merma
- Registrar merma o desperdicio.
- Documentar motivo.

### 5.5 Confirmar proceso
- Validar stock.
- Confirmar para mover inventario.

## 6. Campos y datos que debe capturar
Folio, tipo de proceso, centro, fecha, entradas, salidas, cantidades, unidad, lote, merma, notas y responsable.

## 7. Validaciones y reglas importantes
- No permitir proceso sin entradas.
- No permitir cantidades negativas.
- No permitir confirmacion doble.
- No confirmar si no hay stock suficiente.

## 8. Errores comunes y como resolverlos
- Lote vacio: capturar o corregir.
- Salida mayor a entrada: revisar cantidades.
- Proceso bloqueado: ya fue confirmado o cancelado.

## 9. Buenas practicas
- Definir bien el tipo de proceso antes de confirmar.
- Usar lote consistente.
- Documentar merma con claridad.

## 10. Casos especiales o contingencias
La cancelacion de un proceso confirmado requiere permiso especial o reversa controlada.

## 11. Relacion con otros usuarios
Trabaja con Inventario, Ventas y Auditoria.

## 12. Preguntas frecuentes
- ¿Puedo editar despues de confirmar? No, salvo reversa.
- ¿Donde veo el origen del procesado? En el lote y la trazabilidad.
