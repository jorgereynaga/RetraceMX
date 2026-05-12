# ReTrace MX - Deployment Guide

## Production topology

- Frontend: `https://retracemx.softwaresci.org`
- API: `https://apiretracemx.softwaresci.org`
- Host: `64.23.234.101`
- Reverse proxy: Caddy
- Backend: Django + Gunicorn
- Frontend: compiled static site served by Nginx
- Database: PostgreSQL 16

## DNS

Point both records to `64.23.234.101`:

- `retracemx.softwaresci.org`
- `apiretracemx.softwaresci.org`

## Server prerequisites

Install on the server:

- Docker
- Docker Compose v2
- Git

Open firewall ports:

- 80/tcp
- 443/tcp

## Environment file

Create `.env.production` from `.env.production.example` and set:

- `DJANGO_SECRET_KEY`
- `DATABASE_URL`
- `DJANGO_SUPERUSER_PASSWORD`
- `GPS_INGEST_API_KEY` if needed

Recommended values:

- `DJANGO_DEBUG=0`
- `DJANGO_ALLOWED_HOSTS=64.23.234.101,retracemx.softwaresci.org,apiretracemx.softwaresci.org`
- `DJANGO_CSRF_TRUSTED_ORIGINS=https://retracemx.softwaresci.org,https://apiretracemx.softwaresci.org`
- `DJANGO_CORS_ALLOWED_ORIGINS=https://retracemx.softwaresci.org,https://apiretracemx.softwaresci.org`
- `DJANGO_CSRF_COOKIE_SECURE=1`
- `DJANGO_SESSION_COOKIE_SECURE=1`
- `DJANGO_SECURE_SSL_REDIRECT=1`
- `SEED_DEMO=0` after the first deploy
- Keep `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` aligned with `DATABASE_URL`

## Deployment commands

Clone the repository on the server and then run:

```bash
bash deploy/server-deploy.sh
```

If this is the first deployment and you want demo data seeded, set `SEED_DEMO=1` temporarily in `.env.production`, run the deployment once, and then return it to `0`.

Check status:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail 100
```

## Post-deploy validation

Verify:

- Frontend loads on `https://retracemx.softwaresci.org`
- API login works on `https://apiretracemx.softwaresci.org/api/auth/login/`
- Django admin responds
- Certificates are issued by Caddy

For a step-by-step operational checklist, see [POST_DEPLOY_CHECKLIST.md](./POST_DEPLOY_CHECKLIST.md).
For common incidents and recovery steps, see [RUNBOOK.md](./RUNBOOK.md).

## Troubleshooting

- If Caddy cannot issue certificates, confirm DNS and ports 80/443.
- If the backend rejects requests, check `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, and `CORS_ALLOWED_ORIGINS`.
- If static files do not load, re-run `collectstatic` inside the backend container.
