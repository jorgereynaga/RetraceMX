# Manual de Usuario - Administrador / Supervisor

## 1. Objetivo del rol
Supervisar la operacion completa, administrar catalogos y usuarios, y autorizar cambios sensibles.

## 2. Alcance dentro del sistema
Acceso total a los modulos operativos y de control. En la version actual del sistema el rol tecnico `admin` cubre esta funcion. `Supervisor` se documenta como rol inferido.

## 3. Modulos que utiliza
Dashboard, Catalogos, Compra / Pesaje, Caja, Inventario, Procesamiento, Ventas, Logistica, Historiales, Reportes y Usuarios.

## 4. Flujo general de trabajo
1. Revisar el dashboard del dia.
2. Validar usuarios y permisos.
3. Supervisar compras, pagos, inventario, procesos y ventas.
4. Revisar historiales y trazabilidad ante incidencias.

## 5. Procedimientos paso a paso
### 5.1 Revisar la operacion diaria
- Entrar al dashboard.
- Validar compras, ventas, inventario y procesos del dia.

### 5.2 Administrar usuarios
- Abrir Usuarios.
- Crear o editar usuario.
- Asignar roles y estado activo / inactivo.

### 5.3 Autorizar cambios sensibles
- Revisar el caso.
- Validar historial.
- Autorizar solo si el motivo es correcto.

## 6. Campos y datos que debe capturar
Usuario, correo, telefono, roles, estado, fecha, motivo de autorizacion, filtros de consulta.

## 7. Validaciones y reglas importantes
Toda accion sensible debe quedar auditada. No debe perderse la trazabilidad de compra, pago, proceso o venta.

## 8. Errores comunes y como resolverlos
- Usuario duplicado: revisar alta previa.
- Rol mal asignado: corregir desde Usuarios.
- Operacion inconsistente: revisar historial y flujo original.

## 9. Buenas practicas
- Aplicar minimo privilegio aun siendo administrador.
- Revisar historial antes de reabrir o corregir.
- Documentar motivos claros en autorizaciones.

## 10. Casos especiales o contingencias
Si una operacion ya afecto inventario o caja, la correccion debe seguir la regla de reversa o la politica interna de la empresa.

## 11. Relacion con otros usuarios
Coordina con bascula, compras, caja, inventario, ventas, logistica y auditoria.

## 12. Preguntas frecuentes
- ¿Puedo ver todo? Si.
- ¿Puedo modificar todo? Solo si la regla de negocio lo permite.
- ¿Donde reviso incidencias? En historiales y reportes.
