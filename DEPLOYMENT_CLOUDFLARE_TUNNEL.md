# AILAS Deployment — Cloudflare Tunnel from this PC

AILAS runs on this Windows PC in Docker (production build); Cloudflare Tunnel publishes it at
`https://<your domain>` with Cloudflare's certificate. No server rental, no router ports.
Cost: domain only (Cloudflare Registrar, ≈ US$10–11/yr for .com) + OpenAI credit.

The site is online **only while this PC is on, Docker Desktop is running and the internet works.**

Example domain below: `ailas-btech.com`. Replace it with yours.

## What is already set up

- Production stack as a separate Docker project **`ailas-prod`** (own database and uploads volumes;
  the dev database is untouched). Settings in **`.env.prod`** (git-ignored; fresh `SECRET_KEY` and
  `POSTGRES_PASSWORD`, same `STUDENT_ID_SALT` as `.env`).
- Self-signed certificate in `nginx/certs/` for the hop between `cloudflared` and Nginx on this PC.
  Visitors see Cloudflare's real certificate.
- Data copied from the dev database (demo accounts included) and `uploads/`.
- `cloudflared` installed (winget).
- Nginx takes the visitor's IP from `CF-Connecting-IP` and Uvicorn trusts the proxy headers, so
  per-IP rate limits (login 30/min, uploads) apply per visitor instead of to everyone at once.

Commands (Git Bash, repo root):

```bash
C="docker compose -p ailas-prod --env-file .env.prod -f docker-compose.prod.yml"
$C up -d --build      # start / rebuild after code changes
$C ps                 # status
$C logs -f backend    # logs
$C down               # stop (data stays in the volumes)
```

## 1. Buy the domain on Cloudflare

Cloudflare dashboard → **Domain Registration → Register Domains**. Buying it here puts the DNS on
Cloudflare automatically. (A domain bought elsewhere also works: add it to Cloudflare and change
the nameservers at your registrar; wait until Cloudflare shows it **Active**.)

## 2. Create the tunnel (dashboard)

1. Cloudflare dashboard → **Zero Trust** → **Networks → Tunnels → Create a tunnel** →
   **Cloudflared** → name it `ailas`.
2. Choose **Windows**. Copy the command shown (`cloudflared.exe service install <long token>`) and
   run it in **PowerShell as Administrator**. This installs the tunnel as a Windows service that
   starts on boot.
3. **Public hostname**: Domain `ailas-btech.com` (leave subdomain empty, or use `app`),
   Service type **HTTPS**, URL **`localhost:443`**.
   Under **Additional application settings → TLS**, turn on **No TLS Verify** (Nginx on this PC
   uses the self-signed certificate).
4. Save. The tunnel status should turn **Healthy**.

## 3. Cloudflare security settings (domain → SSL/TLS)

- **Edge Certificates → Minimum TLS Version: TLS 1.3** (capstone §3.5).
- **Edge Certificates → Always Use HTTPS: On**.

## 4. Keep it running

- Docker Desktop → Settings → General → **Start Docker Desktop when you sign in**. The AILAS
  containers use `restart: unless-stopped`, so they come back with Docker.
- Windows power settings: **Sleep: Never** while plugged in during the defense/pilot.
- Test the day before from a phone on mobile data: `https://ailas-btech.com` and
  `https://ailas-btech.com/health`.

## 5. Before sharing the link

- Put a real `OPENAI_API_KEY` in `.env.prod`, then `$C up -d` (AI features are off until then).
- **The demo passwords are public in the repo.** Change at least the admin, VP, Dean and PD
  passwords (Settings page), or the passwords of every account you won't demo with.
- After the defense: `$C down`, or delete the tunnel in Zero Trust to take the site offline.

## Refreshing the data from the dev database

```bash
MSYS_NO_PATHCONV=1 docker exec ai-learning-analytics-postgres-1 pg_dump -U ailas_user -Fc ailas_db -f /tmp/ailas.dump
MSYS_NO_PATHCONV=1 docker cp ai-learning-analytics-postgres-1:/tmp/ailas.dump ./ailas.dump
MSYS_NO_PATHCONV=1 docker cp ./ailas.dump ailas-prod-postgres-1:/tmp/ailas.dump
MSYS_NO_PATHCONV=1 docker exec ailas-prod-postgres-1 pg_restore -U ailas_user -d ailas_db --clean --if-exists --no-owner /tmp/ailas.dump
rm ailas.dump && $C restart backend
```
This overwrites the production data (including any passwords you changed there).

## Quick test without a domain

```bash
"/c/Program Files (x86)/cloudflared/cloudflared.exe" tunnel --url https://localhost:443 --no-tls-verify
```
Prints a temporary `https://<random>.trycloudflare.com` address that lasts until you stop it.
