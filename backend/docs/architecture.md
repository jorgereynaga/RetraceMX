# Arquitectura inicial

La solución separa:

- dominio: reglas de compra, pesaje, inventario y trazabilidad,
- aplicación: servicios que coordinan los casos de uso,
- infraestructura: persistencia Django/DRF, simulación de hardware y reportes,
- presentación: frontend React para operación.

El ticket de compra es la unidad central. El pesaje no es el objeto principal: es una entrada que alimenta partidas, inventario, pagos, impresión y auditoría.

