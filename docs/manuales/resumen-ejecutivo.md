# Resumen ejecutivo

Retrace MX es una plataforma operativa y de trazabilidad para recicladoras. El flujo central es la compra de material, su pesaje, el registro de partidas, el cobro en caja, la materializacion del inventario, el procesamiento interno y la venta con salida de inventario.

## Lo que ya existe

- Usuarios, roles y permisos.
- Catalogos de materiales, personas / empresas, centros y listas de precios.
- Compra de materiales con ticket central y partidas.
- Caja y pagos.
- Inventarios por material y movimientos.
- Procesamiento de materiales con entradas, salidas y merma.
- Ventas de material crudo y procesado.
- Rutas, entregas y seguimiento logistico.
- Historial de compras y ventas.
- Reportes basicos y trazabilidad por lote.

## Estados principales

- Compra: `draft`, `open`, `registered`, `confirmed`, `completed`, `cancelled`.
- Pago de compra: `pending`, `partial`, `paid`.
- Impresion: `pending`, `printed`, `reprinted`.
- Proceso: `draft`, `confirmed`, `cancelled`.
- Venta: `draft`, `confirmed`, `sent_to_cashier`, `scheduled_delivery`, `loading`, `in_route`, `delivered`, `completed`, `paid`, `credit`, `closed`, `cancelled`, `adjusted`.

## Puntos clave de operacion

- Imprimir ticket no equivale a pagar ni a confirmar compra.
- La compra se materializa en inventario al quedar pagada.
- El proceso confirmado consume inventario de entrada y crea inventario de salida.
- La venta descuenta inventario y debe tener stock suficiente.
- Toda accion sensible queda auditada o al menos trazable por historial.

## Alcance funcional parcial

- La integracion real con bascula USB y Epson POS esta prevista por capa desacoplada.
- La auditoria tecnica existe en backend, pero no hay aun una pantalla dedicada de auditoria en el menu principal.
- La trazabilidad por lote funciona de forma operativa con `lot_code`.
