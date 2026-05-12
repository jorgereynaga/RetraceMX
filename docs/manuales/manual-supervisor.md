# Manual de Usuario - Supervisor

## 1. Objetivo del rol
Supervisar la operacion diaria y validar que las areas ejecuten correctamente sus procesos.

## 2. Alcance dentro del sistema
Rol inferido a partir de `admin`. No existe como rol tecnico independiente, pero funcionalmente se usa como supervision operativa.

## 3. Modulos que utiliza
Dashboard, Catalogos, Compras, Inventario, Procesamiento, Ventas, Logistica, Historiales y Reportes.

## 4. Flujo general de trabajo
1. Revisar indicadores.
2. Validar estados de operacion.
3. Revisar incidencias y autorizar correcciones.

## 5. Procedimientos paso a paso
### 5.1 Validar tablero
- Entrar al dashboard.
- Revisar compras, ventas, procesos, inventario y rutas.

### 5.2 Revisar incidencias
- Abrir historial correspondiente.
- Ver motivo, usuario y resultado.

### 5.3 Autorizar correcciones
- Revisar trazabilidad.
- Autorizar o rechazar segun politica interna.

## 6. Campos y datos que debe capturar
Filtros, observaciones, motivo de autorizacion y comentarios de seguimiento.

## 7. Validaciones y reglas importantes
No debe alterar datos sin revisar el impacto en caja, inventario o trazabilidad.

## 8. Errores comunes y como resolverlos
Filtros muy amplios, operaciones ya cerradas o faltas de permisos. Revisar el flujo original y la politica aplicable.

## 9. Buenas practicas
Trabajar con folio, fecha, centro y material. No autorizar sin evidencia.

## 10. Casos especiales o contingencias
Si un flujo ya cerro, usar historial y reversa controlada si existe permiso.

## 11. Relacion con otros usuarios
Trabaja con todos los roles operativos y con auditoria.

## 12. Preguntas frecuentes
- ¿Puedo editar operaciones? Solo si el sistema y la politica lo permiten.
- ¿Puedo revisar trazabilidad? Si.
