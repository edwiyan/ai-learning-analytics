# AILAS Deployment Plan — Hostinger

Target: run the production stack (`docker-compose.prod.yml`: Nginx TLS edge → React SPA +
FastAPI → PostgreSQL 16) on a **Hostinger VPS** behind a public domain with Let's Encrypt.

## 0. Hosting choice

Hostinger **shared / Cloud / "Web" hosting cannot run AILAS**. Those plans give you PHP and MySQL.
They have no Docker, no long-running Python process and no PostgreSQL. Use a **KVM VPS**.

| Plan | Spec | Fit |
|---|---|---|
| KVM 1 | 1 vCPU / 4 GB / 50 GB | Demo or defense only; image builds are slow |
| **KVM 2 (recommended)** | 2 vCPU / 8 GB / 100 GB | Pilot: 2 Uvicorn workers + Postgres + Tesseract OCR |
| KVM 4 | 4 vCPU / 16 GB | Only if the pilot grows past one college |

- OS template: **Ubuntu 24.04 with Docker** (hPanel → VPS → OS & Panel → "Docker"). This template
  ships Docker Engine and the Compose plugin already installed.
- Data center: **Asia (Singapore)**, which has the lowest latency to Bulacan.
- Domain: buy or point one through hPanel. Example used below: `ailas.example.com`.

## 1. Pre-deployment checks in the repo

Already fixed in the repo:
- **Uploads persist.** `docker-compose.prod.yml` mounts an `uploads` volume at `/app/uploads`
  (syllabi + resource files survive rebuilds).
- **No default admin password in production.** `backend/seed.py` reads `ADMIN_EMAIL` and
  `ADMIN_PASSWORD`, and exits when `ENVIRONMENT=production` and no password is set.
  (`Admin@1234` remains the dev/QA fallback only.)
- **`.env.example`** now lists `POSTGRES_*`, `ADMIN_*` and the SMTP keys.

Still to do:
1. **Never run `seed_demo` in production.** The prod compose `command:` overrides
   `entrypoint.sh` and runs only migrations and Uvicorn. Keep it that way.
2. Merge `panel-revisions` → `main` and tag the release (`git tag v1.0-pilot`). The server deploys
   from that tag.

## 2. Provision the VPS (hPanel)

1. Create the KVM 2 VPS with the Ubuntu 24.04 + Docker template. Set a strong root password and
   **add your SSH public key**.
2. hPanel → VPS → **Firewall**: allow inbound **22, 80, 443** only. Postgres (5432) and the backend
   (8000) are never published by the prod compose. Keep it that way.
3. hPanel → Domains → DNS zone: add an **A record** `ailas` → VPS IPv4 (plus AAAA if you use IPv6).
   TTL 300. Wait until `nslookup ailas.example.com` returns the VPS IP.
4. Optional: enable Hostinger **weekly VPS backups / snapshots** (a paid add-on on some plans).

## 3. Harden the server (SSH as root, once)

```bash
adduser ailas && usermod -aG sudo,docker ailas
rsync --archive --chown=ailas:ailas ~/.ssh /home/ailas
# /etc/ssh/sshd_config: PermitRootLogin no, PasswordAuthentication no → systemctl restart ssh
apt update && apt -y upgrade && apt -y install ufw fail2ban unattended-upgrades git
ufw allow OpenSSH && ufw allow 80,443/tcp && ufw enable
dpkg-reconfigure -plow unattended-upgrades
timedatectl set-timezone Asia/Manila
```

Add 2 GB of swap on KVM 1/2 so the `npm ci` / pip builds don't OOM:
```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 4. Deploy the code

As `ailas`:
```bash
git clone https://github.com/<you>/ai-learning-analytics.git ~/ailas
cd ~/ailas && git checkout v1.0-pilot
cp .env.example .env && chmod 600 .env
```

Fill `.env` with production values:

| Key | Value |
|---|---|
| `POSTGRES_USER` / `POSTGRES_DB` | `ailas_user` / `ailas_db` |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |
| `SECRET_KEY` | `openssl rand -hex 32` |
| `STUDENT_ID_SALT` | `python3 -c "import secrets;print(secrets.token_hex(32))"`. **Write it down offline. Never change it** (see CLAUDE.md, `rehash_student_ids`) |
| `OPENAI_API_KEY` | production key, with a monthly usage limit set in the OpenAI dashboard |
| `GEMINI_ENABLED` | `false` unless using a **paid** Gemini key |
| `SMTP_*`, `EMAIL_FROM` | Hostinger email (`smtp.hostinger.com`, port 587/465) or the BTECH mail server |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | first admin account; strong password (seed refuses to run without it) |
| `ENVIRONMENT` | `production` (`DEBUG` unset, so `/docs` and `/openapi.json` stay off) |

> If migrating existing pilot data, copy the **same** `STUDENT_ID_SALT` from the current `.env`.

## 5. TLS certificate + first start

`nginx/nginx.conf` expects `nginx/certs/fullchain.pem` and `privkey.pem` (TLS 1.3 only).

```bash
sudo apt -y install certbot
sudo certbot certonly --standalone -d ailas.example.com -m <admin email> --agree-tos -n
mkdir -p nginx/certs
sudo cp /etc/letsencrypt/live/ailas.example.com/{fullchain,privkey}.pem nginx/certs/
sudo chown ailas:ailas nginx/certs/*.pem
```

Optionally set `server_name ailas.example.com;` in both `server` blocks of `nginx/nginx.conf`.

Build and start:
```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f backend   # wait for "alembic upgrade head" + Uvicorn
docker compose -f docker-compose.prod.yml exec backend python -m backend.seed   # admin + resource repo, once
```

Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, then remove `ADMIN_PASSWORD` from `.env`. Then set the institution
settings (thresholds 75 / 3 / 15 / 85, review 0.75, `mapping_auto_accept` off) under
Admin → Institution Settings.

**Migrating existing local data instead of seeding fresh:**
```bash
# local (Windows)
pg_dump -U ailas_user -d ailas_db -Fc -f ailas_prod_seed.dump
scp ailas_prod_seed.dump ailas@<vps>:~/
# server
docker compose -f docker-compose.prod.yml exec -T postgres pg_restore -U ailas_user -d ailas_db --clean --if-exists < ~/ailas_prod_seed.dump
```
Also copy `uploads/` across (`scp -r uploads ...` then `docker cp` into the volume) so stored
syllabus files resolve. Don't migrate demo or test data (`seed_demo`, QA accounts).

## 6. Certificate auto-renewal

Port 80 is held by the Nginx container, so renew with a short stop:
```bash
sudo crontab -e
0 3 * * 1 certbot renew --pre-hook "docker compose -f /home/ailas/ailas/docker-compose.prod.yml stop nginx" --post-hook "cp /etc/letsencrypt/live/ailas.example.com/*.pem /home/ailas/ailas/nginx/certs/ && docker compose -f /home/ailas/ailas/docker-compose.prod.yml start nginx"
```
(Expect about 10 s of downtime on Mondays at 03:00 when a renewal is due.)

## 7. Backups

The DB holds hashed IDs and grades, so back it up daily and keep a copy off the VPS.

```bash
# ~/backup.sh  (cron: 30 2 * * * /home/ailas/backup.sh)
set -e
cd /home/ailas/ailas
TS=$(date +%Y%m%d_%H%M)
mkdir -p ~/backups
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U ailas_user -Fc ailas_db > ~/backups/db_$TS.dump
docker run --rm -v ailas_uploads:/u -v ~/backups:/b alpine tar czf /b/uploads_$TS.tgz -C /u .
find ~/backups -mtime +14 -delete
```
- Off-site: `rclone` to the BTECH Google Drive, or pull weekly to a campus machine.
- Store `.env`, especially `STUDENT_ID_SALT` and `SECRET_KEY`, **separately** from the dumps.
- **Test a restore** into a scratch container before go-live.

## 8. Updating the app

```bash
cd ~/ailas && ~/backup.sh
git fetch --tags && git checkout v1.x
docker compose -f docker-compose.prod.yml up -d --build    # migrations run on backend start
docker image prune -f
```
Rollback: check out the previous tag, rebuild, and restore the pre-update dump if a migration ran.

## 9. Monitoring

- **Uptime** (≥ 99% target): UptimeRobot or Hostinger monitoring on `https://ailas.example.com/health`,
  alert to the admin email.
- Logs: `docker compose -f docker-compose.prod.yml logs --since 1h backend`. Cap log size in
  `/etc/docker/daemon.json` (`"log-opts": {"max-size": "10m", "max-file": "3"}`).
- Resource use: `docker stats`, plus the hPanel VPS graphs. Check the OpenAI usage dashboard weekly.

## 10. Go-live verification checklist

- [ ] `https://ailas.example.com` loads and `http://` redirects to `https://`
- [ ] `openssl s_client -connect ailas.example.com:443 -tls1_2` **fails**, and `-tls1_3` succeeds
- [ ] `/docs` and `/openapi.json` return 404
- [ ] Security headers present (`curl -I`); SSL Labs grade A
- [ ] Ports 5432 and 8000 are closed from outside (`nmap <ip>`)
- [ ] Admin login works and `ADMIN_PASSWORD` is removed from `.env`
- [ ] Syllabus upload → AI extraction → competencies appear (OpenAI key works)
- [ ] Scanned-PDF upload triggers the Tesseract fallback
- [ ] Assessment CSV upload → topic mapping → risk flags → student recommendations
- [ ] An At-Risk transition sends the SMTP email
- [ ] PDF and Excel reports export
- [ ] Uploaded files survive `docker compose ... up -d --build`
- [ ] Dashboard loads in < 3 s and API calls in < 5 s from a BTECH campus connection
- [ ] Nightly backup produced a file, and a test restore succeeded

## 11. Rough monthly cost

| Item | Est. |
|---|---|
| Hostinger KVM 2 (24-month term) | ≈ ₱400–600 / mo |
| Domain (.com) | ≈ ₱600–800 / yr |
| OpenAI GPT-4o-mini (pilot volume, `llm_cache` on) | usually < US$5 / mo |
| Let's Encrypt, UptimeRobot free tier | ₱0 |

Check current Hostinger pricing before purchase. The figures above are estimates.
