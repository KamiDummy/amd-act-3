# Deployment

NotALawyer runs on one Linux server with Docker Compose:

- **web**: Caddy serving the built frontend. It gets an HTTPS certificate from Let's Encrypt on its own and passes `/api`, `/auth`, `/health` and `/docs` to the backend, so the browser talks to a single origin.
- **backend**: the FastAPI app. On every start it applies migrations and restores the demo contracts, then serves on port 8000, reachable only by Caddy.

The database stays external (Supabase). Uploaded PDFs live in the `storage` volume.

## Requirements

- A server with 2 GB of RAM or more (the embedding model and PyTorch take about 1 GB) and ports 80 and 443 open. These steps use Ubuntu 24.04.
- A domain with an `A` record pointing at the server. Caddy can't get a certificate until it resolves.
- The values for `backend/.env`: the database URL, the Token Factory key and an access code.

## 1. Prepare the server

Log in with an SSH key, then turn off password login:

```bash
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload ssh
```

Allow only SSH and the web:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp     # HTTP/3
ufw --force enable
```

Install Docker Engine from Docker's repository, as in [Docker's guide for Ubuntu](https://docs.docker.com/engine/install/ubuntu/):

```bash
apt-get update && apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

## 2. Configure

```bash
git clone https://github.com/KamiDummy/amd-act-3.git /opt/notalawyer
cd /opt/notalawyer
cp backend/.env.example backend/.env
echo "DOMAIN=your.domain.com" > .env
```

Fill in `backend/.env` (see [Configuration](../README.md#configuration)). In production:

- set `JWT_SECRET` to a long random value, or every restart signs everyone out: `openssl rand -base64 32`;
- set `CORS_ORIGINS=["https://your.domain.com"]`. The app calls the API on its own origin, so this only matters for other clients;
- leave `STORAGE_DIR` unset; the `storage` volume is mounted at its default.

```bash
chmod 600 backend/.env
```

## 3. Start

```bash
docker compose up -d --build
```

The first build takes a few minutes. It downloads PyTorch (CPU only) and the embedding model into the image. Then check:

```bash
docker compose ps                        # both services "healthy" / "running"
curl https://your.domain.com/health/db   # {"status":"db connected"}
```

## Operating

| Task | Command |
| --- | --- |
| Deploy the latest `main` | `git pull && docker compose up -d --build` |
| Follow the logs | `docker compose logs -f backend` (or `web`) |
| Restart | `docker compose restart backend` |
| Load or refresh Ontario law | `docker compose exec backend python -m backend.ontario_laws` |
| Back up uploaded PDFs | `docker run --rm -v notalawyer_storage:/data -v "$PWD":/backup alpine tar czf /backup/storage.tgz -C /data .` |

Containers restart on their own after a crash or a reboot. Keep the `caddy_data` volume: it holds the certificates, and Let's Encrypt limits how often a domain can get new ones.
