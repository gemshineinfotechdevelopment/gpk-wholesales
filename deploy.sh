#!/usr/bin/env bash
# ==============================================================================
# GPK Billing VPS Deployment / Update Script
# Domain: gpk-billing.gemshine.tech
# Target Path: /var/www/gpk-billing
# Usage on VPS: bash deploy.sh
# ==============================================================================

set -e

echo "🚀 [1/5] Pulling latest changes from Git..."
git pull origin main

echo "📦 [2/5] Installing root & frontend dependencies..."
npm install

echo "📦 [3/5] Installing backend dependencies..."
npm --prefix server install

echo "🔨 [4/5] Building frontend (Vite) & backend (TypeScript)..."
npm run build:all

echo "🔄 [5/5] Reloading PM2 backend service (Port 5032)..."
pm2 reload ecosystem.config.cjs || pm2 start ecosystem.config.cjs
pm2 save

echo "=========================================================="
echo "✅ Deployment completed successfully for gpk-billing.gemshine.tech!"
echo "🌐 URL: https://gpk-billing.gemshine.tech"
echo "📊 PM2 Status: pm2 status"
echo "📜 Logs: pm2 logs gpk-billing-api"
echo "=========================================================="
