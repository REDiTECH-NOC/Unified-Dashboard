# REDiTECH Command Center — Deployment Guide

## Prerequisites

- Docker & Docker Compose v2+ installed on your host
- A Microsoft 365 tenant with Entra ID (Azure AD)
- A domain name with DNS access (for HTTPS / reverse proxy)
- Git installed

---

## 1. Microsoft Entra ID Setup

### 1.1 App Registration

1. Go to [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations**
2. Click **New registration**
   - **Name:** `REDiTECH Command Center`
   - **Supported account types:** Accounts in this organizational directory only (Single tenant)
   - **Redirect URI (Web):** `https://your-domain.com/api/auth/callback/microsoft-entra-id`
3. After creation, copy these values:
   - **Application (client) ID** → use as `AUTH_MICROSOFT_ENTRA_ID_ID`
   - **Directory (tenant) ID** → use as `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID`

### 1.2 Client Secret

1. In the app registration → **Certificates & secrets** → **Client secrets** → **New client secret**
2. Set a description (e.g., "RCC Production") and expiration (recommended: 24 months)
3. Copy the **Value** immediately (it won't be shown again) → use as `AUTH_MICROSOFT_ENTRA_ID_SECRET`

### 1.3 API Permissions

Add these permissions under **API permissions** → **Add a permission** → **Microsoft Graph**:

| Permission | Type | Purpose |
|---|---|---|
| `User.Read` | Delegated | Sign in and read user profile |
| `GroupMember.Read.All` | Application | Read group memberships (role assignment) |
| `Mail.Send` | Application | Send email notifications via Microsoft 365 |

After adding all three, click **Grant admin consent for [your tenant]**.

### 1.4 Security Groups

1. Go to **Microsoft Entra ID** → **Groups** → **New group**
2. Create two **Security** groups:

| Group Name | Purpose |
|---|---|
| `RCC-Admins` | Members get the Admin role on first SSO login |
| `RCC-Users` | Members get the User role on first SSO login |

3. Add appropriate users as members of each group
4. Copy each group's **Object ID**:
   - RCC-Admins Object ID → use as `ENTRA_ADMIN_GROUP_ID`
   - RCC-Users Object ID → use as `ENTRA_USER_GROUP_ID`

Users in RCC-Admins get full admin access. Users in RCC-Users get standard technician access. Users are auto-provisioned on first SSO login — no pre-registration needed.

---

## 2. Docker Deployment

### 2.1 Clone & Configure

```bash
git clone https://github.com/REDiTECH-NOC/Unified-Dashboard.git
cd Unified-Dashboard

# Create environment file from template
cp .env.example .env

# Edit .env with your values from the Entra ID setup above
nano .env
```

Required `.env` values to set:
- `POSTGRES_PASSWORD` — choose a strong database password
- `NEXTAUTH_URL` — your full domain (e.g., `https://dashboard.yourdomain.com`)
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `AUTH_MICROSOFT_ENTRA_ID_ID` — from step 1.1
- `AUTH_MICROSOFT_ENTRA_ID_SECRET` — from step 1.2
- `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` — from step 1.1
- `ENTRA_ADMIN_GROUP_ID` — from step 1.4
- `ENTRA_USER_GROUP_ID` — from step 1.4
- `GLASSBREAK_ADMIN_EMAIL` — emergency local admin email
- `GLASSBREAK_ADMIN_PASSWORD` — emergency local admin password

### 2.2 Build & Start

```bash
# Build the app image and start all containers
docker compose up -d --build

# Run database migrations
docker compose exec app npx prisma db push

# Verify all containers are running
docker compose ps
```

You should see 5 containers running:
- `rcc-app` — Next.js application (port 3000)
- `rcc-db` — PostgreSQL database (port 5432)
- `rcc-redis` — Redis cache (port 6379)
- `rcc-n8n` — n8n workflow automation (port 5678)
- `rcc-grafana` — Grafana analytics (port 3001)

### 2.3 Reverse Proxy (HTTPS)

Set up a reverse proxy (Nginx, Caddy, or Traefik) to handle TLS termination:

**Nginx example:**
```nginx
server {
    listen 443 ssl;
    server_name dashboard.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 3. Post-Deployment Verification

### 3.1 Health Check

```bash
# Check app is responding
curl -s http://localhost:3000 | head -20

# Check database connection
docker compose exec app npx prisma db execute --stdin <<< "SELECT 1;"

# Check container logs for errors
docker compose logs app --tail 50
```

### 3.2 First Login

1. Navigate to `https://your-domain.com` in a browser
2. Click **Sign in with Microsoft** — you should be redirected to Microsoft login
3. After authenticating, you'll be auto-provisioned with the role matching your Entra group
4. Verify your role in the top-right profile dropdown

### 3.3 Glass-Break Admin

If SSO is unavailable, use the local admin account:
1. Navigate to `https://your-domain.com/login`
2. Enter the `GLASSBREAK_ADMIN_EMAIL` and `GLASSBREAK_ADMIN_PASSWORD` from your .env
3. Complete TOTP setup on first login (scan QR code with Microsoft Authenticator)

---

## 4. Updating

```bash
cd Unified-Dashboard
git pull origin main
docker compose up -d --build
docker compose exec app npx prisma db push
```

---

## 5. Azure Container Apps (Future)

For production Azure deployment, the same Docker image will be pushed to Azure Container Registry (ACR) and deployed via Bicep templates to Azure Container Apps. This provides:
- Auto-scaling based on HTTP traffic
- Managed TLS certificates
- Azure-managed PostgreSQL Flexible Server
- Azure Cache for Redis
- Azure Key Vault for secrets injection

Bicep templates will be added in a future phase.
