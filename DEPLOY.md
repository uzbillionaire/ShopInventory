# Deploying ShopInventory

A complete recipe for putting this app on a server, and for looking after it
afterwards. Follow it top to bottom the first time; after that you only ever
need the "Updating" and "Backups" sections.

---

## How the pieces fit together

```
            internet
               |
     [ caddy ]  :80 / :443          <- belongs to the cinevault project,
       |                               the only container with public ports
       |  (shared docker network)
       v
  [ shopproxy ]  nginx, no public port
      /      \
 React app   /api/, /admin/, /static/
(static files)       |
                 [ web ]  gunicorn + Django
                     |
                  [ db ]  PostgreSQL     <- private, no public port
```

Three containers, described by `docker-compose.yml`:

| Container | Built from | Job |
|---|---|---|
| `db` | `postgres:17-alpine` | stores the data |
| `web` | `Dockerfile` | runs Django under gunicorn |
| `shopproxy` | `frontend/Dockerfile` | serves the React app, forwards API calls to `web` |

HTTPS is handled by Caddy, which is **not** part of this project. See Part 5.

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

**Skip this part for the current server** — it already runs Docker and hosts the
cinevault project. It is written for the next time you start from a blank VPS.

On a shared server, do NOT run `ufw enable` without first allowing the ports the
existing project needs; you would lock out the other site (and possibly
yourself).

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

## Part 5 — Publish through the existing Caddy

**This server is shared.** Another project (cinevault) already runs here, and its
Caddy container owns ports 80 and 443 for the whole machine. Our app must sit
behind it, exactly as cinevault's own nginx does:

```
internet → [ cinevault-caddy-1 ] :80/:443      ← handles all TLS
              ├── cinevault domain  → nginx:80                 (theirs)
              └── shop hostname     → shopinventory-nginx:80   (ours)
```

Caddy obtains and renews Let's Encrypt certificates by itself, so there is no
certbot to run and no renewal cron job to remember.

### 5.1 Pick a hostname

With no domain of your own, `sslip.io` provides one free: any hostname
containing an IP address resolves to that IP, with no signup. Caddy can get a
real certificate for it, which matters because **browsers only allow camera
access over https** — without it the barcode scanner will not work.

```bash
IP=$(curl -4 -s ifconfig.me)
HOST="shop.${IP//./-}.sslip.io"
echo "$HOST"          # e.g. shop.203-0-113-10.sslip.io
```

Check that it resolves back to your server before going further:

```bash
getent hosts "$HOST"
```

### 5.2 Configure this app

```bash
cd /var/www/ShopInventory
cp .env.example .env
nano .env
```

Set these (the rest as in Part 4):

| Variable | Value |
|---|---|
| `DJANGO_ALLOWED_HOSTS` | the `$HOST` value from above |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `https://` + that host |
| `DJANGO_SECURE_SSL` | `1` — Caddy provides https from the first request |
| `EDGE_NETWORK` | `cinevault_default` |

Start it. Nothing is published to the internet yet, so this cannot disturb
cinevault:

```bash
docker compose up -d --build
docker compose ps        # db, web, shopproxy should all be running
```

### 5.3 Add the site to Caddy

Back up first — this file belongs to the other project:

```bash
cp /opt/cinevault/docker/Caddyfile /opt/cinevault/docker/Caddyfile.bak
```

Append a block for our hostname:

```bash
cat >> /opt/cinevault/docker/Caddyfile <<EOF

# ShopInventory - separate project, same server.
${HOST} {
        reverse_proxy shopinventory-nginx:80
}
EOF
```

`shopinventory-nginx` is the network alias set in our `docker-compose.yml`.
Our service is called `shopproxy`, *not* `nginx`, because cinevault's Caddy
already resolves `nginx` to its own container — two containers answering to the
same name would send cinevault's traffic to the wrong app at random.

Check the syntax before applying it:

```bash
docker exec cinevault-caddy-1 caddy validate --config /etc/caddy/Caddyfile
```

Only if that says "Valid configuration", reload:

```bash
docker exec cinevault-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

`reload` swaps the config in place without dropping connections, so cinevault
stays up. If validation fails, restore the backup and change nothing:

```bash
cp /opt/cinevault/docker/Caddyfile.bak /opt/cinevault/docker/Caddyfile
```

### 5.4 Confirm

```bash
curl -sI "https://${HOST}/" | head -3        # expect HTTP/2 200
docker logs --tail 20 cinevault-caddy-1      # certificate issued
```

Then open `https://$HOST` in a browser and check cinevault's own site still
works. Certificates usually arrive within seconds; if not, the cause is almost
always DNS or a blocked port 80.

Once https is confirmed, you may set `DJANGO_HSTS_SECONDS=31536000` in `.env`
and `docker compose up -d`. Do this last — HSTS tells browsers "never use http
for this host again" and is hard to undo.

### Moving to a real domain later

Point the domain's `A` record at the server, then change the hostname in the
Caddyfile block and in `DJANGO_ALLOWED_HOSTS` / `DJANGO_CSRF_TRUSTED_ORIGINS`.
Reload Caddy and restart the app. Nothing else changes.

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
