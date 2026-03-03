#!/bin/bash
# ==========================================
# Mindmap Selfhost - PRODUCTION DEPLOY SCRIPT
# Run this on your local machine to deploy standard to 103.57.220.131
# Warning: Make sure you put the proper server password or SSH KEY
# ==========================================

SERVER="103.57.220.131"
PORT=24700
USER="root"
DOMAIN="mindmap.nerolyn.com"

# The SSH command stub
SSH="ssh -o StrictHostKeyChecking=no -p $PORT $USER@$SERVER"

echo "Step 1: Setting up server prerequisites (Docker, Nginx, Certbot)..."
$SSH << EOF
  apt-get update -y
  apt-get install -y docker.io docker-compose curl git ufw nginx software-properties-common
  systemctl enable docker
  systemctl start docker

  # Ensure UFW allows needed connections
  ufw allow ssh
  ufw allow 24700/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  # Don't blindly "ufw enable" in script to avoid locking out, but warn user
  echo "UFW prepped for 80, 443, 24700"

  # Install certbot
  apt-get install -y certbot python3-certbot-nginx
EOF

echo "Step 2: Pushing code..."
# Uses standard git push to a git bare repo, or simplest: rsync
# We will use git repository on server to receive
$SSH << EOF
  mkdir -p /opt/mindmap/app
EOF

# Sync project (excluding heavy paths and envs)
rsync -avz -e "ssh -p $PORT -o StrictHostKeyChecking=no" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.next' \
    --exclude 'generated' \
    ./ $USER@$SERVER:/opt/mindmap/app/

echo "Step 3: Creating Production .env and Docker Setup on VPS..."
$SSH << EOF
  cd /opt/mindmap/app

  # Setup standard ports locally bound for DB logic to avoid system-wide collision
  cat << 'DOCKER' > docker-compose.prod.yml
version: "3"
services:
  app:
    build: 
      context: .
      args:
        NEXT_PUBLIC_API_URL: https://${DOMAIN}
        NEXT_PUBLIC_SOCKET_URL: https://${DOMAIN}
    restart: unless-stopped
    ports:
      - "127.0.0.1:3057:3000" # Sits locally, nginx will proxy to 3057
    env_file:
      - .env.production
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: root
      POSTGRES_PASSWORD: secretpassword123
      POSTGRES_DB: mindmap
    volumes:
      - pgdata:/var/lib/postgresql/data
    # No ports mapping to host! (100% safe from clashes)

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redisdata:/data
    # No ports mapping to host! (100% safe from clashes)

volumes:
  pgdata:
  redisdata:
DOCKER

  # Write .env
  cat << ENV > .env.production
DATABASE_URL="postgresql://root:secretpassword123@db:5432/mindmap?schema=public"
REDIS_URL="redis://redis:6379"
NODE_ENV="production"
JWT_SECRET="PLEASE_CHANGE_ME_PRODUCTION_SECURE_TOKEN_512BIT_CHUNKS!"
NEXT_PUBLIC_APP_URL="https://${DOMAIN}"
ENV

  # Docker deployment execution
  docker-compose -f docker-compose.prod.yml down
  docker-compose -f docker-compose.prod.yml build
  docker-compose -f docker-compose.prod.yml up -d

  # Sleep 10s for DB ready, then migrate Prisma
  sleep 10
  docker-compose -f docker-compose.prod.yml exec -T app npx prisma migrate deploy
EOF

echo "Step 4: NGINX and SSL configuring..."
$SSH << EOF
  cat << NGINX > /etc/nginx/sites-available/mindmap
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:3057;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\\$host;
        proxy_cache_bypass \\\$http_upgrade;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
    }
}
NGINX

  ln -sf /etc/nginx/sites-available/mindmap /etc/nginx/sites-enabled/
  # Test and reload
  nginx -t
  systemctl reload nginx

  # Issue SSL Certificate (will succeed if domain is pointed properly via DNS)
  certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos -m admin@${DOMAIN}
EOF

echo "Done! Access https://${DOMAIN}"
