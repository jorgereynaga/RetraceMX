# Roles detectados o inferidos

## Roles tecnicos detectados

- Superadministrador
- Administrador / Gerente
- Bascula / Recepcion
- Compras
- Caja
- Inventario / Acopio
- Procesamiento de materiales
- Comercializacion / Ventas
- Logistica
- Operador / Chofer
- Consulta / Reportes

## Roles inferidos

- Supervisor: no existe como rol tecnico separado; operativamente se comporta como una variante de `admin`.

## Observaciones

- `weighing` y `purchasing` comparten gran parte del flujo de compra y pesaje. La diferencia es la estacion de trabajo y la responsabilidad operativa.
- `inventory` opera inventario y procesamiento porque el sistema concentra ahi la gestion de stock y transformaciones internas.
- `auditor` tiene acceso de consulta; no debe modificar registros.
