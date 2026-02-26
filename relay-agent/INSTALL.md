# REDiTECH Relay Agent - Installation Guide

Lightweight service that runs on an Ubuntu machine in your datacenter.
It polls the Command Center for tasks and executes them over SSH on your local network.

## Requirements

- Ubuntu 20.04+ (or any Linux with systemd)
- Node.js 20+ (`curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs`)
- Network access to your 3CX PBXs (SSH port 22) and to the Command Center (HTTPS port 443)

## Quick Install

```bash
# 1. Extract to /opt
sudo mkdir -p /opt/reditech-relay-agent
sudo tar xzf reditech-relay-agent.tar.gz -C /opt/reditech-relay-agent

# 2. Install dependencies and build
cd /opt/reditech-relay-agent
sudo npm install --production
sudo npm run build

# 3. Configure
sudo cp .env.example .env
sudo nano .env
#   RCC_API_URL=https://your-command-center-url.com
#   RCC_AGENT_API_KEY=rcc_ag_xxxxx  (from Register Agent button in the dashboard)

# 4. Create service user
sudo useradd -r -s /usr/sbin/nologin reditech 2>/dev/null || true
sudo chown -R reditech:reditech /opt/reditech-relay-agent

# 5. Install and start the service
sudo cp systemd/relay-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now relay-agent

# 6. Verify
sudo systemctl status relay-agent
sudo journalctl -u relay-agent -f
```

## Updating

```bash
cd /opt/reditech-relay-agent
sudo systemctl stop relay-agent
sudo tar xzf /path/to/new/reditech-relay-agent.tar.gz -C /opt/reditech-relay-agent --strip-components=0
sudo npm install --production
sudo npm run build
sudo systemctl start relay-agent
```

## Uninstalling

```bash
sudo systemctl disable --now relay-agent
sudo rm /etc/systemd/system/relay-agent.service
sudo systemctl daemon-reload
sudo rm -rf /opt/reditech-relay-agent
sudo userdel reditech
```

## Troubleshooting

- **"Initial heartbeat failed"** - Check RCC_API_URL (no trailing slash) and RCC_AGENT_API_KEY
- **"Poll failed: 401"** - API key is invalid or agent was deactivated
- **"Connection refused" on SSH** - PBX not reachable from this machine, check firewall/network
- **Service won't start** - Check `journalctl -u relay-agent -e` for details
