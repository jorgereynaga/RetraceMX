# ReTrace MX - Production Runbook

Este documento cubre incidencias comunes en producción y su resolución rápida.

## 1) El frontend no carga

### Síntomas

- `https://retracemx.softwaresci.org` no abre.
- El navegador muestra error de conexión o 502.

### Causas probables

- DNS no apunta al servidor correcto.
- Caddy no está levantado.
- El contenedor `frontend` no está corriendo.

### Qué revisar

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail 100 frontend
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail 100 caddy
```

### Solución

- Verifica DNS.
- Reinicia con:

```bash
bash deploy/server-deploy.sh
```

- Si sigue fallando, revisa que `frontend` sirva en el puerto 80 dentro de la red Docker.

## 2) El API no responde

### Síntomas

- `https://apiretracemx.softwaresci.org/api/auth/login/` no responde.
- La app muestra errores de red.

### Causas probables

- El contenedor `backend` no está levantado.
- `ALLOWED_HOSTS` no incluye el dominio.
- CORS o CSRF mal configurados.

### Qué revisar

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail 100 backend
```

### Solución

- Revisa `.env.production`.
- Confirma estos valores:
  - `DJANGO_ALLOWED_HOSTS`
  - `DJANGO_CSRF_TRUSTED_ORIGINS`
  - `DJANGO_CORS_ALLOWED_ORIGINS`
- Reinicia la pila.

## 3) Login devuelve credenciales inválidas

### Síntomas

- El formulario responde `Credenciales inválidas.` aunque el usuario exista.

### Causas probables

- La contraseña en la base no coincide con la sembrada.
- El usuario fue desactivado.
- Estás apuntando a otro entorno.

### Qué revisar

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail 100 backend
```

### Solución

- Ejecuta la semilla:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend python manage.py seed_demo
```

- Verifica que el usuario esté activo.

## 4) Error 403 en la API

### Síntomas

- La UI funciona, pero ciertas acciones no se pueden ejecutar.
- El backend responde `403 Forbidden`.

### Causas probables

- El rol del usuario no tiene permiso.
- Se intenta ejecutar una acción sensible sin autorización.

### Qué revisar

- Rol del usuario.
- Matriz de permisos.
- Endpoint específico que falló.

### Solución

- Inicia sesión con un usuario autorizado.
- Revisa la matriz de permisos en el módulo de usuarios.
- Si es una acción administrativa, usa un usuario `admin` o `superadmin`.

## 5) El navegador sigue apuntando a localhost

### Síntomas

- La app intenta llamar a `localhost:8000` o `localhost:5000`.

### Causas probables

- El frontend quedó con un build viejo.
- El `VITE_API_URL` no se compiló para producción.

### Qué revisar

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail 100 frontend
```

### Solución

- Recompila el frontend.
- Verifica que `docker-compose.prod.yml` pase:
  - `VITE_API_URL=https://apiretracemx.softwaresci.org/api`

## 6) Certificados HTTPS no se emiten

### Síntomas

- El navegador no muestra candado.
- Caddy no logra obtener certificado.

### Causas probables

- DNS no resuelto.
- Puerto 80/443 bloqueado.
- El dominio no apunta al host.

### Qué revisar

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail 100 caddy
```

### Solución

- Confirma DNS.
- Abre puertos 80 y 443.
- Reinicia Caddy levantando la pila de nuevo.

## 7) La base de datos no arranca

### Síntomas

- `db` aparece unhealthy o reiniciando.

### Causas probables

- Volumen corrupto.
- Contraseña o credenciales inconsistentes.

### Qué revisar

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail 100 db
```

### Solución

- Verifica `POSTGRES_DB`, `POSTGRES_USER` y `POSTGRES_PASSWORD`.
- Si es una instalación nueva, recrea el volumen solo si sabes que no hay datos que conservar.

## 8) El dashboard sale vacío

### Síntomas

- La UI abre, pero no hay métricas.

### Causas probables

- No hay datos cargados.
- El seed no se ejecutó.
- El backend no está respondiendo correctamente.

### Qué revisar

- Usa el módulo de compras y ventas para generar actividad.
- Revisa logs del backend.

### Solución

- Ejecuta la semilla demo.
- Realiza una compra y una venta de prueba.

## 9) Recuperación rápida

Si no tienes claro qué pasó, usa este orden:

1. `docker compose ps`
2. `docker compose logs backend`
3. `docker compose logs frontend`
4. `docker compose logs caddy`
5. Verifica `.env.production`
6. Reinicia la pila

```bash
bash deploy/server-deploy.sh
```

