# ReTrace MX - Post Deployment Checklist

Usa esta lista cuando ReTrace MX ya esté desplegado en el servidor `64.23.234.101`.

## 1) DNS

- Verifica que `retracemx.softwaresci.org` apunte a `64.23.234.101`.
- Verifica que `apiretracemx.softwaresci.org` apunte a `64.23.234.101`.
- Confirma que no existan registros antiguos apuntando a otro host.

## 2) Firewall y puertos

- Confirma que el puerto `80/tcp` esté abierto.
- Confirma que el puerto `443/tcp` esté abierto.
- Confirma que el puerto `22/tcp` esté abierto solo si usarás SSH.

## 3) Contenedores

Ejecuta:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail 100
```

Debes ver:

- `db` en estado healthy.
- `backend` en ejecución.
- `frontend` en ejecución.
- `caddy` en ejecución.

## 4) Backend

Verifica:

- `https://apiretracemx.softwaresci.org/api/auth/login/`
- `https://apiretracemx.softwaresci.org/admin/`
- `https://apiretracemx.softwaresci.org/api/reports/daily/`

Prueba login con:

- `admin / Admin1234!` o la contraseña definida en `.env.production`

Resultado esperado:

- respuesta `200` o token válido,
- no debe aparecer `Credenciales inválidas` si los datos son correctos,
- no debe aparecer `DisallowedHost` ni `CSRF verification failed`.

## 5) Frontend

Verifica:

- `https://retracemx.softwaresci.org`
- pantalla de login
- navegación principal
- dashboard
- compras
- ventas
- caja
- usuarios
- inventarios

Resultado esperado:

- la app debe cargar sin consola roja,
- el login debe apuntar al API de producción,
- no debe intentar usar `localhost` en producción.

## 6) Certificados HTTPS

Confirma:

- que Caddy emitió certificado TLS,
- que el navegador muestra candado seguro,
- que `http://` redirige a `https://`.

Si falla:

- revisa DNS,
- revisa puertos 80/443,
- revisa logs de Caddy.

## 7) Datos iniciales

Confirma:

- usuario `admin` existe,
- roles mínimos fueron creados,
- catálogos base están disponibles,
- listas de precios cargan,
- el dashboard muestra datos.

## 8) Validación operativa mínima

Haz estas pruebas:

1. Crear una compra.
2. Iniciar compra.
3. Registrar pago.
4. Confirmar que la operación queda confirmada solo al pagar.
5. Crear una venta.
6. Registrar una venta y validar que aparece en caja.
7. Revisar inventario y confirmar que los movimientos se reflejan.

## 9) Logs útiles

Si algo falla revisa:

- logs del backend,
- logs del frontend,
- logs de Caddy.

Comandos:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail 200 backend
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail 200 frontend
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail 200 caddy
```

## 10) Checklist rápido final

- [ ] DNS correcto
- [ ] Puertos 80/443 abiertos
- [ ] Contenedores arriba
- [ ] HTTPS funcionando
- [ ] Login funciona
- [ ] API responde
- [ ] Frontend carga
- [ ] Dashboard carga
- [ ] Caja funciona
- [ ] Compras funcionan
- [ ] Ventas funcionan
- [ ] Inventario actualiza
- [ ] Usuarios y roles visibles

