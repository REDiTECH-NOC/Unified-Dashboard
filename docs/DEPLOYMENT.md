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
   - **Application (client) ID** → use as `AZURE_AD_CLIENT_ID`
   - **Directory (tenant) ID** → use as `AZURE_AD_TENANT_ID`

### 1.2 Client Secret

1. In the app registration → **Certificates & secrets** → **Client secrets** → **New client secret**
2. Set a description (e.g., "RCC Production") and expiration (recommended: 24 months)
3. Copy the **Value** immediately (it won't be shown again) → use as `AZURE_AD_CLIENT_SECRET`

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
   - RCC-Admins Object ID → use as `ENTRA_GROUP_ADMINS`
   - RCC-Users Object ID → use as `ENTRA_GROUP_USERS`

Users in RCC-Admins get full admin access. Users in RCC-Users get standard technician access. Users are auto-provisioned on first SSO login — no pre-registration needed.

### 1.5 Multiple Environments (Same App Registration)

A single Entra app registration supports both development and production. Add all redirect URIs under **Authentication** → **Web** → **Redirect URIs**:

| Environment | Redirect URI |
|---|---|
| Local Dev | `https://dashboardv1.yourdomain.com/api/auth/callback/microsoft-entra-id` |
| Production | `https://dashboard.yourdomain.com/api/auth/callback/microsoft-entra-id` |

Both environments share the same Client ID, Tenant ID, and Client Secret.

---

## 2. Development Environment (Local Docker)

The local Docker environment is used for building, testing, and iterating during development. Once a phase or feature is complete, changes are pushed to GitHub and automatically deployed to Azure via CI/CD.

### 2.1 Clone & Configure

```bash
git clone https://github.com/REDiTECH-NOC/Unified-Dashboard.git
cd Unified-Dashboard

# Create environment file from template
cp .env.example .env

# Edit .env with your values
nano .env
```

Required `.env` values to set:
- `POSTGRES_PASSWORD` — choose a strong database password
- `NEXTAUTH_URL` — your dev domain (e.g., `https://dashboardv1.yourdomain.com`)
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `AZURE_AD_CLIENT_ID` — from step 1.1
- `AZURE_AD_CLIENT_SECRET` — from step 1.2
- `AZURE_AD_TENANT_ID` — from step 1.1
- `ENTRA_GROUP_ADMINS` — from step 1.4
- `ENTRA_GROUP_USERS` — from step 1.4
- `GLASSBREAK_ADMIN_EMAIL` — emergency local admin email
- `GLASSBREAK_ADMIN_PASSWORD` — emergency local admin password

### 2.2 Build & Start

```bash
# Build the app image and start all containers
docker compose up -d --build

# Run database migrations
docker compose exec app npx prisma@5.22.0 db push

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

Set up a reverse proxy (Nginx Proxy Manager, Caddy, or Traefik) to handle TLS termination and route your dev domain to port 3000.

### 2.4 Rebuilding After Code Changes

```bash
# Rebuild and restart only the app container
docker compose up -d --build app

# If schema changed, run migrations
docker compose exec app npx prisma@5.22.0 db push
```

---

## 3. Production Deployment (Azure)

Production runs on Azure Container Apps with managed PostgreSQL and Redis. Deployments are automated via GitHub Actions CI/CD.

### 3.1 Development → Production Workflow

```
Local Docker (dev) → Test & Verify → Git Push to main → GitHub Actions CI/CD → Azure Container Apps
```

1. **Develop locally** — build and test features on the local Docker environment
2. **Commit & push** — push changes to `main` branch on GitHub
3. **CI/CD auto-deploys** — GitHub Actions builds the Docker image, pushes to ACR, and deploys to Azure Container Apps
4. **Verify in production** — confirm at your production domain

### 3.2 Azure Infrastructure

The following Azure resources are provisioned:

| Resource | Name | Details |
|---|---|---|
| Resource Group | reditech-command-center | Central US |
| Container Registry | reditechacr | Basic tier, admin enabled |
| Container App | rcc-app | 0.5 vCPU, 1Gi RAM, min 1 replica |
| Container App | rcc-n8n | 0.5 vCPU, 1Gi RAM, scale-to-zero |
| Container App | rcc-grafana | 0.25 vCPU, 0.5Gi RAM, scale-to-zero |
| PostgreSQL | rcc-postgres | Burstable B1ms, v16, 32GB |
| Redis | rcc-redis | Basic C0, TLS on port 6380 |
| Key Vault | rcc-vault-prod | Standard tier, RBAC authorization |

### 3.3 Secrets Management

Production secrets are stored in Azure Key Vault (`rcc-vault-prod`) and injected into the Container App via managed identity. No plain-text secrets in the Container App configuration.

Key Vault secrets:
- `database-url` — PostgreSQL connection string
- `redis-url` — Redis TLS connection string
- `nextauth-secret` — JWT signing secret
- `azure-ad-client-secret` — Entra app client secret
- `glassbreak-password` — Local admin emergency password

### 3.4 GitHub Actions CI/CD

The workflow (`.github/workflows/deploy.yml`) triggers on:
- Push to `main` branch when `app/` files change
- Manual dispatch from GitHub Actions UI

**Required GitHub Secrets** (set via GitHub web UI → Settings → Secrets):
- `AZURE_CREDENTIALS` — service principal JSON
- `ACR_USERNAME` — ACR admin username
- `ACR_PASSWORD` — ACR admin password

### 3.5 Custom Domain & SSL

Production uses a custom domain with Azure-managed SSL certificate (CNAME → Container App FQDN).

---

## 4. Post-Deployment Verification

### 4.1 Health Check

```bash
# Check app is responding
curl -s https://your-domain.com | head -20

# Check container logs for errors (local)
docker compose logs app --tail 50
```

### 4.2 First Login

1. Navigate to `https://your-domain.com` in a browser
2. Click **Sign in with Microsoft** — you should be redirected to Microsoft login
3. After authenticating, you'll be auto-provisioned with the role matching your Entra group
4. Verify your role in the top-right profile dropdown

### 4.3 Glass-Break Admin

If SSO is unavailable, use the local admin account:
1. Navigate to `https://your-domain.com/login`
2. Enter the `GLASSBREAK_ADMIN_EMAIL` and `GLASSBREAK_ADMIN_PASSWORD` from your .env
3. Complete TOTP setup on first login (scan QR code with Microsoft Authenticator)

---

## 5. Updating

### Local Development
```bash
git pull origin main
docker compose up -d --build
docker compose exec app npx prisma@5.22.0 db push
```

### Production (Automated)
Push to `main` triggers GitHub Actions → builds Docker image → deploys to Azure Container Apps automatically.

### Manual Production Deploy
If needed, trigger a manual deploy from GitHub → Actions → "Build & Deploy to Azure" → "Run workflow".
