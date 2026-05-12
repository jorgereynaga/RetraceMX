# ReTrace MX

ReTrace MX es una plataforma operativa y de trazabilidad para empresas recicladoras. El sistema organiza la compra de materiales, el pesaje, la caja, el inventario, la comercialización, la logística y la auditoría bajo un núcleo de dominio desacoplado de la interfaz.

## Enfoque funcional

La plataforma está diseñada para cubrir el ciclo operativo completo:

- clientes y generadores,
- centros de acopio,
- rutas y transporte,
- recepción y pesaje,
- inventario por material,
- comercialización de compra y venta,
- documentación y evidencias,
- trazabilidad y auditoría,
- reportes y analítica.

La operación central es el ticket de compra. Cada operación puede tener varias partidas, cada partida puede capturarse por báscula vehicular o báscula secundaria, y el inventario se materializa al pago.

## Contexto normativo

El diseño funcional considera como base la LGPGIR y, para residuos de manejo especial, la NOM-161-SEMARNAT-2011. El sistema está orientado a:

- prevención y valorización,
- gestión integral,
- uniformidad de inventarios,
- trazabilidad documental,
- control de recolección, acopio y salida comercial.

## Stack

- Backend: Django
- API: Django REST Framework
- Base de datos: PostgreSQL
- Frontend: React + TypeScript + Vite
- Pruebas backend: pytest + pytest-django
- Integración de dispositivos: capa desacoplada con simuladores y adaptadores

## Estructura del repositorio

- `backend/`: núcleo Django, apps de dominio, API, auditoría y pruebas
- `frontend/`: aplicación React operativa
- `docs/`: arquitectura, integración de dispositivos y notas técnicas
- `deploy/`: despliegue local y de producción
- `.env.example`: variables de entorno para desarrollo
- `.env.production.example`: variables para producción
- `docker-compose.yml`: entorno local con PostgreSQL, backend y frontend
- `docker-compose.prod.yml`: entorno de producción con reverse proxy y HTTPS

## Apps principales del backend

- `users`: autenticación, usuarios, roles y permisos
- `parties`: personas, empresas, centros de acopio, vehículos y conductores
- `materials`: familias, materiales y listas de precios
- `logistics`: rutas, viajes, entregas, GPS y evidencias logísticas
- `devices`: básculas, impresoras térmicas y simuladores
- `weighing`: sesiones de pesaje y lecturas de báscula
- `operations`: operaciones de compra y partidas del ticket
- `payments`: caja, pagos y cancelaciones
- `inventory`: movimientos y resumen de inventario
- `commercialization`: ventas, partidas y pagos de venta
- `evidence`: bitácoras de impresión, custodia y archivos
- `auditing`: eventos de auditoría
- `reporting`: KPIs y reportes básicos

## Flujo operativo principal

1. Se abre una operación de compra.
2. Se agregan una o más partidas.
3. Cada partida puede capturarse con:
   - diferencia vehicular,
   - báscula secundaria directa,
   - contingencia manual.
4. Se calcula peso neto e importe.
5. Se imprime el ticket térmico.
6. Se registra el pago en caja.
7. Al quedar pagada la compra, se confirma y se materializa el inventario.
8. Se conserva historial, reimpresión y auditoría.

## Modelos principales

- `User`
- `Role`
- `CommercialRole`
- `PersonOrCompany`
- `Vehicle`
- `Driver`
- `CollectionCenter`
- `MaterialFamily`
- `Material`
- `PriceList`
- `Route`
- `Device`
- `WeighingSession`
- `ScaleReading`
- `PurchaseOperation`
- `TicketItem`
- `Payment`
- `PrintLog`
- `InventoryMovement`
- `CustodyEvent`
- `EvidenceFile`
- `AuditLog`

## Cómo correr el proyecto en local

### Con Docker

```bash
docker compose up --build
```

- Frontend: `http://localhost:5000`
- API: `http://localhost:8001`

### Backend sin Docker

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend sin Docker

```bash
cd frontend
npm install
npm run dev
```

## Variables de entorno

Revisa estos archivos:

- `.env.example`
- `.env.production.example`

Variables clave:

- `DATABASE_URL`
- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`
- `DJANGO_CORS_ALLOWED_ORIGINS`
- `FRONTEND_URL`
- `DJANGO_SUPERUSER_USERNAME`
- `DJANGO_SUPERUSER_PASSWORD`
- `SEED_DEMO`

## Pruebas

```bash
cd backend
pytest
```

También puedes correr el chequeo de Django:

```bash
python manage.py check
```

## Dispositivos

La integración física está desacoplada del frontend. La base incluye:

- simulación de báscula vehicular USB,
- simulación de báscula secundaria USB,
- simulación de impresora térmica Epson POS,
- interfaces para adaptadores reales por puerto serie o middleware local.

Consulta:

- [docs/device-integration.md](docs/device-integration.md)

## Despliegue

Producción:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

La pila de producción usa:

- backend Django con Gunicorn,
- frontend compilado a estático,
- PostgreSQL,
- Caddy como reverse proxy con HTTPS automático.

## Documentación técnica

- [docs/architecture.md](docs/architecture.md)
- [docs/domain-model.md](docs/domain-model.md)
- [docs/device-integration.md](docs/device-integration.md)

## Siguientes pasos sugeridos

1. Conectar una báscula USB real por puerto serie virtual o driver OEM.
2. Sustituir la impresión simulada por Epson POS real.
3. Completar flujos de geolocalización para rutas.
4. Endurecer reglas de cancelación, reimpresión y ajustes con doble validación.
5. Agregar reportes operativos y analítica avanzada por centro, material y período.
