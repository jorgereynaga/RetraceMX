# Manual general resumido del sistema

## 1. Objetivo del sistema

Retrace MX administra el ciclo operativo completo de una recicladora: compra, pesaje, inventario, procesamiento, comercializacion, logistica, caja, evidencias, trazabilidad y reportes.

## 2. Flujo central

1. Se abre una compra.
2. Se capturan una o mas partidas.
3. Se imprime el ticket.
4. Se registra el pago.
5. Al quedar pagada la compra, el inventario se materializa.
6. El material puede procesarse o venderse.
7. La venta descuenta inventario.
8. La entrega se programa y se documenta.
9. Todo queda trazable por historial, lotes, movimientos y auditoria.

## 3. Menus principales

- General: Dashboard
- Catalogos: Materiales, Personas / Empresas, Centros de acopio, Listas de precios, Tipos de procesos
- Operacion: Compra de materiales, Procesamiento, Caja y pagos, Inventarios
- Ventas: Comercializacion
- Logistica: Rutas, Entregas
- Control: Historial de compras, Historial de ventas, Usuarios

## 4. Reglas clave

- Imprimir no confirma.
- Pagar confirma el impacto en inventario.
- Procesar consume entrada y genera salida / merma.
- Vender descuenta stock disponible.
- Ajustar inventario requiere permiso y motivo.

## 5. Alcance parcial

- La bascula y la impresora estan integradas mediante una capa desacoplada y aun deben validarse fisicamente en sitio.
- La auditoria interna existe, pero no hay una pantalla de auditoria en el menu principal.
