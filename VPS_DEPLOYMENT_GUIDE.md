# GPK Billing - Complete VPS Deployment Guide (Ubuntu / Debian)

- **Domain / Subdomain**: `gpk-billing.gemshine.tech`
- **Backend API Port**: `5032`
- **Database**: Local MongoDB on VPS (`mongodb://127.0.0.1:27017/gpk_billing`)
- **Web App Directory**: `/var/www/gpk-billing`
- **Process Manager**: PM2 (`ecosystem.config.cjs`)
- **Web Server / Reverse Proxy**: Nginx + Let's Encrypt SSL (Certbot)

---

## 🏗️ Architecture Overview

```
                      Internet (Client Browser / Mobile)
                                     │
                                     ▼
                        [ DNS: A Record / CNAME ]
                         gpk-billing.gemshine.tech
                                     │
                                     ▼
                     [ Nginx Reverse Proxy (SSL 443) ]
                                     │
             ┌───────────────────────┴───────────────────────┐
             │                                               │
      Static Frontend SPA                               Backend API
     (/var/www/gpk-billing/dist)                (http://127.0.0.1:5032/api)
                                                             │
                                                  ┌──────────┴──────────┐
                                                  ▼                     ▼
                                           Local MongoDB           Cloudinary
                                        (127.0.0.1:27017)       (Bill PDFs / CDN)
                                         [db: gpk_billing]
```

---

## 📋 Step 1: Connect to VPS & Initial Server Setup

Log in to your VPS terminal:
```bash
ssh root@YOUR_VPS_IP
```

Update packages:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget gnupg ufw nginx build-essential
```

### 1.1 Install Node.js (v20 LTS):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # Output should be v20.x
npm -v
```

### 1.2 Install PM2 (Process Manager):
```bash
sudo npm install -g pm2
```

---

## 🍃 Step 2: Install and Configure MongoDB on VPS

### 2.1 Install MongoDB Community Edition (Ubuntu 22.04 / 24.04):
```bash
# Import MongoDB public GPG Key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor --yes

# Add MongoDB repository list
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update & install MongoDB
sudo apt update
sudo apt install -y mongodb-org
```

### 2.2 Start and Enable MongoDB Service:
```bash
sudo systemctl start mongod
sudo systemctl enable mongod
sudo systemctl status mongod
```
*(Verify active running status: `active (running)`)*

### 2.3 Create & Initialize the `gpk_billing` Database:
Open the MongoDB shell:
```bash
mongosh
```

In the `mongosh` prompt, run:
```javascript
// Switch to gpk_billing database
use gpk_billing

// Insert an initial initialization record to create the database namespace
db.init.insertOne({ project: "GPK Billing", created_at: new Date() })

// Verify database exists
show dbs

// Exit mongosh
exit
```

> **Note**: When the backend server starts, it automatically connects to `mongodb://127.0.0.1:27017/gpk_billing` and auto-creates the collections and default admin accounts:
> - **Super Admin**: `superadmin` / `superadmin123`
> - **Store Admin**: `admin` / `admin123`

---

## 📂 Step 3: Clone Project & Prepare Web Directory

```bash
# Create target web directory
sudo mkdir -p /var/www/gpk-billing
sudo chown -R $USER:$USER /var/www/gpk-billing
cd /var/www/gpk-billing

# Clone your repository (or upload code)
git clone <YOUR_GIT_REPOSITORY_URL> .
```

---

## ⚙️ Step 4: Configure Backend Environment (`server/.env`)

In `/var/www/gpk-billing/server/.env`:
```bash
# You can simply copy the prepared production template:
cp server/.env.production server/.env

# Or view/edit it with nano:
nano server/.env
```

Ensure the following configuration:
```env
PORT=5032
NODE_ENV=production
MONGODB_URI=mongodb://127.0.0.1:27017/gpk_billing
CORS_ORIGIN=https://gpk-billing.gemshine.tech,http://gpk-billing.gemshine.tech,http://localhost:5173

# Optional: Cloudinary credentials for bill PDF storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```
*(Save and exit nano: `Ctrl + O`, `Enter`, `Ctrl + X`)*

---

## 🔨 Step 5: Install Dependencies & Build Application

```bash
cd /var/www/gpk-billing

# Install frontend dependencies
npm install

# Install backend dependencies
npm --prefix server install

# Build both frontend and backend
npm run build:all
```

---

## 🚀 Step 6: Start Backend with PM2

Run PM2 using the configured `ecosystem.config.cjs`:
```bash
cd /var/www/gpk-billing
pm2 start ecosystem.config.cjs

# Save PM2 process list so it restarts automatically on server reboot
pm2 save
pm2 startup
```
*(If `pm2 startup` displays a command, copy-paste and run it).*

### Check backend status:
```bash
pm2 status
pm2 logs gpk-billing-api --lines 30
```

Verify backend health directly on port 5032:
```bash
curl http://127.0.0.1:5032/api/health
```
*(Expected response: `{"status":"OK","message":"GPK Crackers API Server is running smoothly","port":5032,...}`)*

---

## 🌐 Step 7: Configure Nginx & Domain

### 7.1 DNS Configuration (In your Domain Provider / Cloudflare):
Ensure an **A Record** exists for:
- Host / Name: `gpk-billing`
- Type: `A`
- Value: `<YOUR_VPS_IP>`
- TTL: Auto

### 7.2 Copy Nginx Site Configuration:
```bash
sudo cp /var/www/gpk-billing/nginx/gpk-billing.gemshine.tech.conf /etc/nginx/sites-available/gpk-billing.gemshine.tech
```

### 7.3 Enable the Site in Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/gpk-billing.gemshine.tech /etc/nginx/sites-enabled/
```

### 7.4 Test and Reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔒 Step 8: Install Free SSL Certificate (Certbot Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d gpk-billing.gemshine.tech
```
- Enter your email address.
- Agree to terms (`Y`).
- Certbot will automatically configure HTTPS in Nginx and set up auto-renewal.

Test SSL renewal:
```bash
sudo certbot renew --dry-run
```

---

## 🛡️ Step 9: Configure Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 🔄 Updating the Project in the Future

Whenever you push new changes to GitHub, simply run the deployment script on your VPS:

```bash
cd /var/www/gpk-billing
bash deploy.sh
```

This single command will:
1. Pull new code (`git pull`)
2. Install new dependencies
3. Re-build frontend & backend (`npm run build:all`)
4. Zero-downtime reload backend via PM2 (`pm2 reload ecosystem.config.cjs`)

---

## 🩺 Quick Troubleshooting Cheatsheet

| Issue | Diagnostic Command | Fix |
|---|---|---|
| Backend not responding | `pm2 status` / `pm2 logs gpk-billing-api` | `pm2 restart gpk-billing-api` |
| Port 5032 check | `curl http://127.0.0.1:5032/api/health` | Verify `server/.env` has `PORT=5032` |
| MongoDB down | `sudo systemctl status mongod` | `sudo systemctl restart mongod` |
| Nginx 502 Bad Gateway | `sudo tail -n 50 /var/log/nginx/error.log` | Ensure PM2 app `gpk-billing-api` is online |
| Nginx config error | `sudo nginx -t` | Fix syntax in `/etc/nginx/sites-available/gpk-billing.gemshine.tech` |
| Frontend 404 on refresh | Check `try_files $uri $uri/ /index.html;` | Included in Nginx config |
