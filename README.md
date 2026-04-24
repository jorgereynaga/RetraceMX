# Acopio360

Plataforma base de gestión operativa y trazabilidad para recicladoras.

## Objetivo

El repositorio inicial implementa una base funcional para:

- compra y operación central por ticket,
- múltiples partidas por operación,
- pesaje vehicular diferencial y pesaje individual,
- caja y pagos,
- inventario y movimientos,
- trazabilidad y auditoría,
- impresión térmica desacoplada,
- simulación de básculas USB,
- frontend React + TypeScript para operación y consulta.

## Stack

- Backend: Django
- API: Django REST Framework
- Base de datos: PostgreSQL
- Pruebas: pytest + pytest-django
- Frontend: React + TypeScript + Vite

## Estructura

- `backend/`: núcleo Django, dominio, API, auditoría y pruebas
- `frontend/`: interfaz React inicial
- `docs/`: notas técnicas y decisiones base
- `.env.example`: variables de entorno de referencia

## Cómo correr el backend

1. Crear entorno virtual e instalar dependencias de `backend/requirements.txt`.
2. Copiar `.env.example` a `.env`.
3. Ejecutar migraciones.
4. Cargar datos iniciales con `python manage.py seed_demo` si quieres una base de prueba.
5. Levantar el servidor.

Ejemplo:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

## Con Docker

```bash
docker compose up --build
```

## Cómo correr el frontend

```bash
cd frontend
npm install
npm run dev
```

## Variables de entorno

Revisa `.env.example` para los valores esperados. El backend usa `DATABASE_URL`, `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS` y `DJANGO_CSRF_TRUSTED_ORIGINS`.

## Pruebas

```bash
cd backend
pytest
```

## Flujo principal ya cubierto

- apertura de operación,
- partidas con pesaje diferencial o individual,
- cálculo de importe y total de ticket,
- registro de inventario,
- registro de pago con validación de saldo,
- cierre de operación condicionado a liquidación,
- impresión y reimpresión auditadas,
- cambio de precio auditado en listas de precios,
- auditoría básica,
- reporte básico de operación,
- simulación de báscula e impresora.

## Decisiones clave

- La operación central es el ticket de compra.
- El pesaje vive desacoplado de la UI.
- Toda partida confirmada genera inventario.
- Auditoría explícita para cambios sensibles.
- Integraciones de dispositivos con simuladores reemplazables por hardware real.

## Siguientes pasos sugeridos

1. Conectar un conector real de báscula USB por puerto serie/driver.
2. Completar reglas de impresión Epson POS con plantillas reales.
3. Agregar dashboards y reportes operativos más avanzados.
4. Implementar flujo de cancelación y ajustes con doble validación.
5. Incorporar geolocalización futura para rutas y recolección.
