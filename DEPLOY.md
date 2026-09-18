# Deploying ShopInventory

A complete recipe for putting this app on a server, and for looking after it
afterwards. Follow it top to bottom the first time; after that you only ever
need the "Updating" and "Backups" sections.

---

## How the pieces fit together

```
            internet
               |
          [ nginx ]  :80 / :443     <- the only container exposed publicly
           /      \
   React app    /api/, /admin/, /static/
  (static files)        |
                    [ web ]  gunicorn + Django
                        |
                     [ db ]  PostgreSQL     <- private, no public port
```

Three containers, described by `docker-compose.yml`:

| Container | Built from | Job |
|---|---|---|
| `db` | `postgres:17-alpine` | stores the data |
| `web` | `Dockerfile` | runs Django under gunicorn |
| `nginx` | `frontend/Dockerfile` | serves the React app, forwards API calls, handles https |

Two named volumes hold everything that must survive a restart: `pgdata`
(the database) and `media` (uploaded product pictures).

---

## What you need

- A server (VPS) running Ubuntu 24.04 or similar. 1 CPU and 2 GB RAM is plenty
  for one shop; 1 GB works if you add swap.
- A domain name pointing at the server's IP address (an `A` record).
  You can start without one and use the bare IP.
- SSH access to the server.

---

## Part 1 — Try it on your own machine first

Never debug on a live server if you can debug on your laptop.

```bash
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(64))"   # paste into DJANGO_SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(24))"   # paste into POSTGRES_PASSWORD
```

Set `DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1` and
`DJANGO_CSRF_TRUSTED_ORIGINS=http://localhost`, then:

```bash
docker compose up --build
```

Open <http://localhost>. Create your login in a second terminal:

```bash
docker compose exec web python manage.py createsuperuser
```

Stop it with `Ctrl+C`, or `docker compose down` to remove the containers.
`docker compose down -v` also deletes the volumes — that erases your data, so
never run it on a real server without a backup.

### Working without Docker, as before

`DEBUG` is now off by default, so a fresh clone needs a `.env` before anything
runs. Django reads that file automatically:

```bash
cp .env.example .env
echo "DJANGO_DEBUG=1" >> .env
python manage.py migrate
python manage.py runserver        # still SQLite, still port 8000
cd frontend && npm run dev        # still port 5173
```

Real environment variables always beat the `.env` file, which is why the server
ignores it entirely — Docker Compose injects the values directly.

---

## Part 2 — Prepare the server

SSH in as root, then:

```bash
# 1. Update the system
apt update && apt upgrade -y

# 2. Install Docker (official script)
curl -fsSL https://get.docker.com | sh

# 3. Create a normal user instead of working as root
adduser deploy
usermod -aG docker deploy      # lets this user run docker
usermod -aG sudo deploy

# 4. Only allow SSH, http and https through the firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

Why a non-root user: if anything you run is compromised, it cannot immediately
take over the whole machine. Why the firewall: your server has many ports open
by default, and every open port is a door someone can try.

Log out and back in as `deploy` from now on.

---

## Part 3 — Get the code onto the server

Push this project to GitHub (a private repo is fine), then on the server:

```bash
git clone https://github.com/YOUR-NAME/ShopInventory.git
cd ShopInventory
```

If the project is not in git yet, run `git init && git add . && git commit -m "initial"`
locally first. `.gitignore` already keeps `.env`, `db.sqlite3` and `media/` out of
the repo, which is exactly right — secrets and data never belong in git.

---

## Part 4 — Configure and start

```bash
cp .env.example .env
nano .env
```

Fill in, at minimum:

| Variable | Value |
|---|---|
| `DJANGO_SECRET_KEY` | output of `python3 -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `POSTGRES_PASSWORD` | output of `python3 -c "import secrets; print(secrets.token_urlsafe(24))"` |
| `DJANGO_ALLOWED_HOSTS` | `your-domain.com,www.your-domain.com` (or the server IP) |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `https://your-domain.com,https://www.your-domain.com` |
| `DJANGO_SECURE_SSL` | `0` for now — there is no certificate yet |

Then start everything:

```bash
docker compose up -d --build
```

`-d` means "detached": it runs in the background and survives you closing SSH.

Watch it come up:

```bash
docker compose ps          # all three should say "running"
docker compose logs -f web # Ctrl+C to stop watching
```

Migrations run automatically on every start (see `docker-entrypoint.sh`).
Create your admin account once:

```bash
docker compose exec web python manage.py createsuperuser
```

Visit `http://your-domain.com` — the app should load.

---

## Part 5 — Turn on https

Browsers block the camera on plain http, so the barcode scanner will not work
until this is done. Certificates from Let's Encrypt are free.

```bash
# 1. Ask for a certificate. nginx must already be running on port 80.
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d your-domain.com -d www.your-domain.com \
  --email you@example.com --agree-tos --no-eff-email

# 2. Point nginx at the https config
cp deploy/nginx-tls.conf deploy/nginx-tls.live.conf
sed -i 's/example\.com/your-domain.com/g' deploy/nginx-tls.live.conf
```

Edit `docker-compose.yml` and change the nginx config mount to:

```yaml
      - ./deploy/nginx-tls.live.conf:/etc/nginx/conf.d/default.conf:ro
```

Then tighten Django and restart:

```bash
sed -i 's/^DJANGO_SECURE_SSL=.*/DJANGO_SECURE_SSL=1/' .env
docker compose up -d
```

Confirm `https://your-domain.com` works and that http redirects to it. Only
then set `DJANGO_HSTS_SECONDS=31536000` in `.env` and `docker compose up -d`
again — HSTS tells browsers "never use http for this domain again" and is hard
to undo, so switch it on last.

**Renewal.** Certificates last 90 days. Add a monthly cron job:

```bash
crontab -e
```

```cron
0 3 1 * * cd /home/deploy/ShopInventory && docker compose run --rm certbot renew && docker compose exec -T nginx nginx -s reload
```

---

## Updating after you change the code

```bash
cd ~/ShopInventory
git pull
docker compose up -d --build
```

That rebuilds the images, applies any new migrations and restarts. Expect a few
seconds of downtime. Roll back with `git checkout <previous-commit>` and the
same command.

---

## Backups

The database is the only thing you cannot recreate. Back it up daily:

```bash
docker compose exec -T db pg_dump -U shopinventory shopinventory \
  | gzip > ~/backups/shop-$(date +%F).sql.gz
```

As a cron job, keeping 14 days:

```cron
0 2 * * * cd /home/deploy/ShopInventory && mkdir -p ~/backups && docker compose exec -T db pg_dump -U shopinventory shopinventory | gzip > ~/backups/shop-$(date +\%F).sql.gz && find ~/backups -name 'shop-*.sql.gz' -mtime +14 -delete
```

Restoring:

```bash
gunzip -c ~/backups/shop-2026-09-18.sql.gz \
  | docker compose exec -T db psql -U shopinventory shopinventory
```

Also copy the product pictures somewhere off the server now and then:

```bash
docker run --rm -v shopinventory_media:/m -v ~/backups:/b alpine \
  tar czf /b/media-$(date +%F).tar.gz -C /m .
```

A backup you have never restored is not a backup. Test it once.

---

## Everyday commands

| Task | Command |
|---|---|
| See what is running | `docker compose ps` |
| Follow the logs | `docker compose logs -f web` |
| Restart one service | `docker compose restart web` |
| Django shell | `docker compose exec web python manage.py shell` |
| Database shell | `docker compose exec db psql -U shopinventory shopinventory` |
| Stop everything | `docker compose down` |
| Free up disk space | `docker system prune -af` |

---

## When something breaks

| Symptom | Cause and fix |
|---|---|
| `DJANGO_SECRET_KEY must be set` | `.env` is missing or empty. This is the guard doing its job. |
| `DisallowedHost` / 400 on every page | Your domain is not in `DJANGO_ALLOWED_HOSTS`. |
| 502 Bad Gateway | `web` crashed. Run `docker compose logs web`. |
| CSRF failed on admin login | Add your `https://domain` to `DJANGO_CSRF_TRUSTED_ORIGINS`. |
| Endless https redirect loop | Certificate not ready yet — set `DJANGO_SECURE_SSL=0` and restart. |
| 413 on photo upload | Raise `client_max_body_size` in the nginx config. |
| Admin pages have no styling | `collectstatic` failed during build — check the build output. |
| Camera will not open | https is not active. Browsers only allow the camera on https or localhost. |
| `db` keeps restarting | Usually a `POSTGRES_PASSWORD` change against an existing volume. The password is set only when the volume is first created. |

---

## Go-live checklist

- [ ] `DJANGO_DEBUG=0`
- [ ] `DJANGO_SECRET_KEY` is long, random, and not in git
- [ ] `DJANGO_ALLOWED_HOSTS` lists only your real domains
- [ ] `.env` is not committed (`git status` should never show it)
- [ ] https works and http redirects to it
- [ ] `DJANGO_SECURE_SSL=1` and HSTS enabled
- [ ] A superuser exists and its password is strong
- [ ] Backup cron job runs, and you have restored one successfully
- [ ] `ufw status` shows only 22, 80 and 443
- [ ] `docker compose exec web python manage.py check --deploy` reports no issues
