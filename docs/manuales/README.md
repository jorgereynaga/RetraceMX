# Manuales de Usuario - Retrace MX

Este directorio contiene los manuales operativos del sistema Retrace MX, redactados a partir de la implementacion real del repositorio.

## Contenido

- [Portal documental](./portal-documental.md)
- [Resumen ejecutivo](./resumen-ejecutivo.md)
- [Roles detectados o inferidos](./roles-detectados.md)
- [Matriz rol vs modulo](./matriz-rol-modulo.md)
- [Matriz rol vs acciones](./matriz-rol-acciones.md)
- [Manual general resumido](./manual-general.md)
- [Administrador](./manual-administrador.md)
- [Supervisor](./manual-supervisor.md)
- [Recepcion / Bascula](./manual-recepcion-bascula.md)
- [Caja](./manual-caja.md)
- [Inventario / Acopio](./manual-inventario-acopio.md)
- [Procesamiento de materiales](./manual-procesamiento.md)
- [Comercializacion / Ventas](./manual-ventas.md)
- [Logistica](./manual-logistica.md)
- [Operador / Chofer](./manual-operador.md)
- [Consulta / Reportes](./manual-consulta-reportes.md)
- [Guias rapidas](./guias-rapidas.md)

## Observaciones

- El sistema tiene roles tecnicos y roles funcionales.
- `Supervisor` no aparece como rol tecnico independiente; se documenta como rol inferido a partir de `admin`.
- La integracion real de bascula USB e impresora Epson esta desacoplada y aun tiene una capa simulada / adaptadora.
- La trazabilidad por lote existe de forma operativa mediante `lot_code`, aunque no como entidad de lote totalmente formalizada.
