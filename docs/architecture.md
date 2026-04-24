# Arquitectura inicial

La plataforma se organiza en capas:

- `domain/services`: reglas de negocio para compra, pesaje, inventario, pagos y auditoría.
- `infrastructure`: modelos Django, persistencia PostgreSQL, API DRF y simuladores.
- `presentation`: frontend React con TypeScript para operación y consulta.

El ticket de operación es la entidad central. El pesaje, los pagos, la impresión y la trazabilidad son efectos de esa operación.

