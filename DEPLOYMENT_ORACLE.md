# AILAS Deployment — Oracle Cloud Always Free + your own domain

Budget route for the defense and pilot: hosting ₱0 (Oracle Always Free), domain ≈ ₱600–800/yr,
OpenAI ≈ ₱315 (US$5 minimum credit). Sections 7–10 of `DEPLOYMENT_PLAN.md` (backups, updates,
monitoring, go-live checklist) apply unchanged; replace `/home/ailas/ailas` with `/home/ubuntu/ailas`.

Example domain below: `ailas-btech.com`. Replace it everywhere with yours.

## 0. Before you start

- A debit/credit card that works for international payments (Oracle verifies it; Always Free
  resources are not charged). GCash/Maya virtual cards are sometimes rejected; have a backup.
- An SSH key on your Windows PC. In PowerShell: `ssh-keygen -t ed25519` (press Enter for the
  defaults). The public key is `C:\Users\<you>\.ssh\id_ed25519.pub`.
- The real `.env` values you will reuse: **`STUDENT_ID_SALT`** (must match your local DB if you
  copy its data over).

## 1. Create the Oracle account

1. Sign up at oracle.com/cloud/free.
2. **Home region: Singapore (ap-singapore-1).** It is closest to Bulacan. It **cannot be changed
   later**, and Always Free compute only runs in the home region.
3. Optional but recommended after the account is active: **Upgrade to Pay As You Go** (Billing →
   Upgrade). Always Free resources stay free, and Oracle no longer reclaims idle free instances.
   Then set a budget alert of US$1 (Billing → Budgets) so any accidental charge emails you.

## 2. Create the server

Compute → Instances → Create instance:

| Setting | Value |
|---|---|
| Image | **Canonical Ubuntu 24.04** (the aarch64 build is picked automatically for Ampere) |
| Shape | Ampere → **VM.Standard.A1.Flex**, **2 OCPU, 12 GB** (the current Always Free limit) |
| Networking | Create new VCN + public subnet, **Assign a public IPv4 address** |
| SSH keys | Paste the contents of `id_ed25519.pub` |
| Boot volume | 100 GB (Always Free includes 200 GB total) |

If you get **"Out of capacity"**, that is Oracle, not you: retry later (early morning often works),
or try 1 OCPU / 6 GB and resize later.

Write down the instance's **public IP**.

## 3. Open ports 80 and 443 (two places)

**a. Oracle network (Security List).** Instance → Subnet → Default Security List → Add Ingress Rules:
source `0.0.0.0/0`, TCP, destination port `80`; repeat for `443`. Port 22 is already open.

**b. The server's own firewall.** Oracle's Ubuntu image ships iptables rules that reject everything
except SSH. Don't install ufw on Oracle images (it conflicts with these rules).

```bash
ssh ubuntu@<PUBLIC_IP>
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 4. Domain and DNS

1. Buy the domain from any registrar (Porkbun, Namecheap, Cloudflare and Hostinger all sell
   .com at roughly US$10–12 for the first year). Check the **renewal** price too: cheap first-year
   TLDs (.xyz, .site, .online) often renew at several times the price.
2. In the registrar's DNS settings add an **A record**: host `@` → `<PUBLIC_IP>`, TTL 300.
   Optionally `www` → same IP.
3. Wait until `nslookup ailas-btech.com` returns the public IP (minutes to a few hours).

## 5. Prepare the server

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install fail2ban unattended-upgrades certbot
sudo timedatectl set-timezone Asia/Manila
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit   # log in again so the docker group applies
```

Harden SSH: Oracle images already disable password login and root login; leave it that way.

## 6. Copy the code (no GitHub remote needed)

On your Windows PC, in the repo folder (PowerShell):

```powershell
git archive --format=tar.gz -o ailas.tar.gz HEAD
scp ailas.tar.gz ubuntu@<PUBLIC_IP>:~
```

On the server:

```bash
mkdir ~/ailas && tar xzf ~/ailas.tar.gz -C ~/ailas && cd ~/ailas
cp .env.example .env && chmod 600 .env
nano .env
```

`git archive` ships the committed code only: no `.env`, certificates, uploads or `venv`.

Fill `.env` as in `DEPLOYMENT_PLAN.md` §4 (strong `POSTGRES_PASSWORD`, new `SECRET_KEY`, real
`OPENAI_API_KEY`, `ENVIRONMENT=production`, `ADMIN_EMAIL` / `ADMIN_PASSWORD`). For
`STUDENT_ID_SALT`: **copy the value from your local `.env`** if you will restore your local data
(step 8A); otherwise generate a new one and keep it safe.

## 7. HTTPS certificate and first start

```bash
sudo certbot certonly --standalone -d ailas-btech.com -m <your email> --agree-tos -n
mkdir -p nginx/certs
sudo cp /etc/letsencrypt/live/ailas-btech.com/{fullchain,privkey}.pem nginx/certs/
sudo chown ubuntu:ubuntu nginx/certs/*.pem

docker compose -f docker-compose.prod.yml up -d --build      # first ARM build: ~10–15 min
docker compose -f docker-compose.prod.yml logs -f backend    # wait for Uvicorn "startup complete"
```

Renewal cron (`sudo crontab -e`):
```
0 3 * * 1 certbot renew --pre-hook "docker compose -f /home/ubuntu/ailas/docker-compose.prod.yml stop nginx" --post-hook "cp /etc/letsencrypt/live/ailas-btech.com/*.pem /home/ubuntu/ailas/nginx/certs/ && docker compose -f /home/ubuntu/ailas/docker-compose.prod.yml start nginx"
```

## 8. Data: pick one

### 8A. Defense demo — copy your local database (demo accounts included)

On Windows, with the local Docker Postgres running:

```powershell
docker exec ai-learning-analytics-postgres-1 pg_dump -U ailas_user -Fc ailas_db -f /tmp/ailas.dump
docker cp ai-learning-analytics-postgres-1:/tmp/ailas.dump .\ailas.dump
tar czf uploads.tgz uploads
scp ailas.dump uploads.tgz ubuntu@<PUBLIC_IP>:~
```

(Use `docker cp`, not `>` redirection: PowerShell would corrupt the binary dump.)

On the server:

```bash
cd ~/ailas
docker compose -f docker-compose.prod.yml exec -T postgres pg_restore -U ailas_user -d ailas_db --clean --if-exists --no-owner < ~/ailas.dump
docker compose -f docker-compose.prod.yml cp ~/uploads.tgz backend:/tmp/uploads.tgz
docker compose -f docker-compose.prod.yml exec backend sh -c "tar xzf /tmp/uploads.tgz -C /app && rm /tmp/uploads.tgz"
docker compose -f docker-compose.prod.yml restart backend
```

**The demo passwords (Admin@1234, Demo@1234, …) are public in the repo.** Once the site is online,
change at least the admin, VP, Dean and PD passwords, and wipe or tear down the server after the
defense.

### 8B. Real pilot — start clean

```bash
docker compose -f docker-compose.prod.yml exec backend python -m backend.seed
```
Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, then remove `ADMIN_PASSWORD` from `.env`.
Never run `seed_demo` here.

## 9. Check it

- `https://ailas-btech.com` loads; `http://` redirects to `https://`.
- `https://ailas-btech.com/health` shows `"db":"connected"` and `"llm_api":"configured"`.
- Log in, upload a syllabus, and confirm AI extraction works (proves the OpenAI key).
- Run the go-live checklist in `DEPLOYMENT_PLAN.md` §10.

## 10. Updating later

```bash
# Windows
git archive --format=tar.gz -o ailas.tar.gz HEAD
scp ailas.tar.gz ubuntu@<PUBLIC_IP>:~
# server
cd ~/ailas && tar xzf ~/ailas.tar.gz -C ~/ailas
docker compose -f docker-compose.prod.yml up -d --build   # migrations run on backend start
docker image prune -f
```
Back up first (`DEPLOYMENT_PLAN.md` §7). `.env`, certificates and the database/uploads volumes are
untouched by the update.

## Cost

| Item | Est. |
|---|---|
| Oracle Always Free (2 OCPU / 12 GB ARM, 100 GB disk) | ₱0 |
| Domain (.com, first year) | ≈ ₱600–800 |
| OpenAI credit (US$5 minimum, lasts the pilot with `llm_cache`) | ≈ ₱315 |
| Let's Encrypt certificate | ₱0 |
| **Total** | **≈ ₱900–1,100**, within the ₱2,000 budget |

Risks: Oracle changed the free limits without notice in June 2026 and could again; keep the
nightly backup (`DEPLOYMENT_PLAN.md` §7) so you can move to Hetzner CX23 (≈ ₱430/mo) within an hour.
