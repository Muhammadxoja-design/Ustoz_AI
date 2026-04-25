#!/bin/bash
set -e

# Terminal Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}   BrainStorm AI: Automated Production Deployment v1.0   ${NC}"
echo -e "${BLUE}====================================================${NC}"

# 1. Interactive Setup
echo -e "\n${GREEN}[1/7] Initializing Security Configuration...${NC}"
read -p "Enter Telegram BOT_TOKEN: " BOT_TOKEN
read -p "Enter VITE_TELEGRAM_BOT_ID: " VITE_TELEGRAM_BOT_ID
read -s -p "Enter Secure POSTGRES_PASSWORD: " POSTGRES_PASSWORD
echo -e "\n"

# 2. System Prep & Firewall Hardening
echo -e "${GREEN}[2/7] Updating System & Configuring Firewall...${NC}"
apt-get update && apt-get upgrade -y
apt-get install -y curl gnupg lsb-release ufw ca-certificates openssl

echo -e "${GREEN}Configuring UFW Firewall...${NC}"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 3. Docker Setup
echo -e "${GREEN}[3/7] Installing Docker & Docker Compose Engine...${NC}"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 4. Environment Variable Generation
echo -e "${GREEN}[4/7] Generating Production Environment Secrets...${NC}"
cat <<EOF > .env
# Backend & Bot Config
BOT_TOKEN=$BOT_TOKEN
ADMIN_TELEGRAM_IDS=1234567,8901234
WEBAPP_URL=https://brainstorm.yourdomain.com

# Database (PostgreSQL)
POSTGRES_USER=brainstorm_admin
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=brainstorm_db

# In-Memory Session Storage (Redis)
REDIS_PASSWORD=$(openssl rand -base64 24)

# Frontend Build Variables (Vite)
VITE_TELEGRAM_BOT_ID=$VITE_TELEGRAM_BOT_ID
VITE_TEST_START_TIME=2026-05-05T09:00:00+05:00
EOF

chmod 600 .env

# 5. Execution
echo -e "${GREEN}[5/7] Building & Launching BrainStorm AI Infrastructure...${NC}"
docker compose up -d --build

# 6. Automated Migration
echo -e "${GREEN}[6/7] Waiting for PostgreSQL to initialize (15s)...${NC}"
sleep 15

echo -e "${GREEN}[7/7] Synchronizing Prisma Database Schema...${NC}"
docker exec -i brainstorm_app npx prisma migrate deploy

echo -e "\n${BLUE}====================================================${NC}"
echo -e "${GREEN}   DEPLOYMENT COMPLETE: BrainStorm AI is now ONLINE!     ${NC}"
echo -e "${BLUE}====================================================${NC}"
echo -e "Live Logs: docker compose logs -f app"
