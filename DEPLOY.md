# Deploying with Docker

The stack runs as Docker Compose services: `db` (Postgres 16), `app` (Next.js) and an optional `cloudflared` (Cloudflare Tunnel). Tables are created automatically on first use.

## 1. Prerequisites
- Docker Desktop (Windows/Mac) or Docker Engine + Compose plugin (Linux: `curl -fsSL https://get.docker.com | sh`)
- Verify: `docker compose version`

## 2. Get the code
```bash
git clone https://github.com/Salinda-Kumara/attend.git
cd attend
```

## 3. Configure
```bash
cp .env.example .env
```
Edit `.env`:

| Variable | Purpose |
|---|---|
| `ADMIN_USER` / `ADMIN_PASS` | Admin login (`ADMIN_PASS` required) |
| `SESSION_SECRET` | Long random string, e.g. `openssl rand -hex 32` (required) |
| `DB_PASSWORD` | Postgres password. Set before first start; changing it later does not update an existing database volume |
| `APP_PORT` | Host port for the app (default 3000) |
| `CLOUDFLARE_TUNNEL_TOKEN` | Only for the tunnel profile |

`DATABASE_URL` and `EXCEL_FILE` in `.env.example` are for local development; Compose sets the database URL itself.

## 4. Build and start
```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app
```
Open `http://<server-ip>:3000`. Admin page: `/admin`.

## 5. Import the attendee list
The Excel file is not in git (it contains names and personal details). Copy it to the server, then:
```bash
mkdir -p data          # put "20B List.xlsx" inside
docker compose run --rm app node scripts/import.js "/data/20B List.xlsx"
```
Alternatively use the import function on the admin page.

## 6. Public HTTPS with Cloudflare Tunnel (optional)
1. Add your domain to Cloudflare.
2. Zero Trust → Networks → Tunnels → Create a tunnel (Cloudflared). Copy the token from the Docker install command (`--token ...`).
3. Add a public hostname: e.g. `attendance.yourdomain.com`, service type `HTTP`, URL `app:3000` (use the compose service name, not `localhost`).
4. Put the token in `.env`:
   ```
   CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi...
   ```
5. Start with the tunnel profile:
   ```bash
   docker compose --profile tunnel up -d --build
   ```
6. Check `docker compose logs -f cloudflared` for "Registered tunnel connection", then open the hostname.

Hardening:
- Remove the `ports:` mapping from the `app` service so it is reachable only via Cloudflare.
- Add a Cloudflare Access policy (Zero Trust → Access → Applications) for `attendance.yourdomain.com/admin*` as a second login in front of the admin page.

## Everyday commands
| Task | Command |
|---|---|
| Logs | `docker compose logs -f app` |
| Restart | `docker compose restart app` |
| Update after `git pull` | `docker compose up -d --build` (add `--profile tunnel` if using the tunnel) |
| Stop (keeps data) | `docker compose down` |
| Stop and **delete database** | `docker compose down -v` |
| Backup | `docker compose exec db pg_dump -U postgres attendance > backup.sql` |
| Restore | `docker compose exec -T db psql -U postgres attendance < backup.sql` |

## Troubleshooting
- **Compose says a variable is not set:** `ADMIN_PASS` and `SESSION_SECRET` (and the tunnel token with `--profile tunnel`) are required in `.env`.
- **App cannot reach the database:** check `docker compose logs db`; confirm `DB_PASSWORD` has not changed since the volume was first created.
- **Port in use:** change `APP_PORT`.
- **Build fails with a missing module:** check the build log; the Dockerfile copies `xlsx` and `dotenv` into the runtime image for the import script.
