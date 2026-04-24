# Acopio360

Sistema de gestión operativa para empresa recicladora. Cubre el flujo completo de compra de materiales reciclables: pesaje vehicular diferencial, ticket térmico, caja, inventario y auditoría.

## Arquitectura

- **Backend**: Django 5 + Django REST Framework, base de datos PostgreSQL (gestionada por Replit)
- **Frontend**: React 19 + TypeScript + Vite, en puerto 5000
- **Backend API**: Puerto 8000, con proxy desde Vite hacia /api

## Acceso inicial

- Usuario: `admin`
- Contraseña: `Admin1234!`

## Módulos implementados

1. Autenticación y usuarios con roles
2. Personas/Empresas (proveedores y clientes)
3. Vehículos y conductores
4. Centros de acopio
5. Catálogo de materiales (familias, subfamilias, precios)
6. Listas de precios
7. Operaciones de compra (ticket central)
8. Pesaje vehicular diferencial por USB
9. Pesaje individual (báscula secundaria)
10. Partidas del ticket con merma editable
11. Cálculo económico (peso, merma, precio, importe, total)
12. Estados de operación (pendiente, registrado, anulado)
13. Impresión de ticket térmico Epson POS
14. Caja y pagos
15. Inventario del centro de acopio
16. Historial y consultas
17. Auditoría de acciones sensibles
18. Reportes básicos
19. Logística y rutas de recolección
20. Comercialización (ventas)

## Estructura del repositorio

```
/
├── backend/               # Django backend
│   ├── acopio360/         # Configuración del proyecto
│   ├── apps/
│   │   ├── auditing/      # Bitácora de auditoría
│   │   ├── commercialization/ # Ventas y comercialización
│   │   ├── core/          # Utilidades comunes
│   │   ├── devices/       # Básculas e impresoras USB
│   │   ├── evidence/      # Evidencias y fotos
│   │   ├── inventory/     # Inventario de materiales
│   │   ├── logistics/     # Rutas y recolección
│   │   ├── materials/     # Catálogo de materiales
│   │   ├── operations/    # Operaciones de compra
│   │   ├── parties/       # Personas/empresas, vehículos
│   │   ├── payments/      # Caja y pagos
│   │   ├── reporting/     # Reportes
│   │   ├── users/         # Usuarios y roles
│   │   └── weighing/      # Sesiones de pesaje
│   └── requirements.txt
├── frontend/              # React + Vite frontend
│   └── src/
│       ├── api/           # Cliente API y recursos
│       ├── components/    # Componentes reutilizables
│       ├── context/       # AuthContext
│       ├── pages/         # Páginas principales
│       └── utils/         # Utilidades
└── docs/                  # Documentación técnica
```

## Workflows configurados

- **Backend API**: `cd backend && python manage.py runserver 0.0.0.0:8000` (puerto 8000)
- **Start application**: `cd frontend && npm run dev` (puerto 5000, vista previa web)

## Datos de demo

La base de datos tiene datos de ejemplo cargados con `seed_demo`. Incluye:
- 36 materiales en 7 familias (Metales Ferrosos, No Ferrosos, Plásticos, Papel y Cartón, Vidrio, Electrónicos, Otros)
- 5 proveedores, 3 vehículos
- 3 dispositivos: báscula vehicular (`bascula-vehicular-01`), báscula secundaria (`bascula-secundaria-01`), impresora (`impresora-epson-01`)
- 1 lista de precios con todos los materiales

## UI/UX

- Diseño oscuro profesional con variables CSS en `frontend/src/styles.css`
- Sidebar con navegación agrupada por sección (Catálogos, Operación, Comercial, Control)
- Sistema de colores: accent verde `#22c55e`, amber `#f59e0b`, azul `#3b82f6`, peligro `#ef4444`
- Tarjetas KPI con colores semánticos, tablas con cabeceras en mayúsculas, badges de estado

## Módulo de pesaje

- Página `WeighingPage.tsx` con simulador real conectado al endpoint `GET /api/devices/{id}/simulate_scale/`
- Modo **Diferencial** (báscula vehicular): captura peso bruto → peso tara → calcula neto
- Modo **Directo** (báscula de banco): lectura directa + tara opcional
- Indicador de estabilidad animado, soporte a fallback manual

## Dashboard diario

- Endpoint `GET /api/reports/daily/?date=YYYY-MM-DD` en `backend/apps/reporting/views.py`
- KPIs: operaciones, peso, merma, ingresos del día
- Gráfico de barras por familia de material
- Tendencia 7 días
- Tabla de compras por cliente/proveedor

## Notas de integración con dispositivos

- Básculas USB: módulo `apps/devices` con adaptadores, simuladores y servicios
- Impresión térmica Epson POS: endpoint de impresión en `apps/evidence`
- En desarrollo local, los pesos se capturan por simulación (`simulate_scale`) o entrada manual
