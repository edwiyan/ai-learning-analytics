# Edge Nginx (production)

`nginx.conf` terminates HTTPS with **TLS 1.3 only** (capstone §3.5 Security), redirects HTTP to
HTTPS, adds security headers (HSTS, CSP, X-Frame-Options, nosniff, Referrer-Policy,
Permissions-Policy) and routes API prefixes to the backend and everything else to the SPA.

## Certificates

Nginx expects two files in `nginx/certs/` (git-ignored):

- `fullchain.pem`: certificate chain
- `privkey.pem`: private key

**Pilot / LAN (self-signed):**

```bash
sh nginx/make-self-signed-cert.sh ailas.btech.local
```

Browsers will warn once per device; install the certificate as trusted on pilot machines to avoid it.

**Public domain:** use Let's Encrypt (e.g. `certbot certonly --standalone -d your.domain`) and copy
`fullchain.pem` / `privkey.pem` into `nginx/certs/`.

## Check TLS 1.3

```bash
openssl s_client -connect localhost:443 -tls1_3 </dev/null | grep -E "Protocol|Cipher"
openssl s_client -connect localhost:443 -tls1_2 </dev/null   # must fail
```
