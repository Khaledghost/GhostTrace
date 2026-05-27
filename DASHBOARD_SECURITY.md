# GhostTrace Dashboard Security Guide

## 🔒 Security Overview

GhostTrace dashboard is **private by default** and includes multiple security layers:

1. **IP Whitelisting** - Control which IPs can access the dashboard
2. **Rate Limiting** - Prevent brute force and DoS attacks
3. **Embedded Database** - No external database required (SQLite by default)
4. **Secure by Default** - Localhost-only access unless explicitly configured

---

## 🏠 Default Behavior (Localhost Only)

By default, the dashboard is accessible only from `localhost`:

```javascript
await ghosttrace.init();
```

Dashboard will be accessible at:
- ✅ `http://localhost:3001`
- ✅ `http://127.0.0.1:3001`
- ❌ External IPs blocked

---

## 🌍 Making Dashboard Public

### Option 1: Environment Variable

```env
GHOST_DASHBOARD_PUBLIC=true
```

### Option 2: Programmatic

```javascript
await ghosttrace.init({
  dashboardPublic: true,
});
```

⚠️ **Warning:** Only enable public access if you're behind a firewall or using IP whitelisting!

---

## 🎯 IP Whitelisting

### Allow Specific IPs

```env
# Single IP
GHOST_DASHBOARD_IPS=192.168.1.100

# Multiple IPs (comma-separated)
GHOST_DASHBOARD_IPS=192.168.1.100,10.0.0.50,172.16.0.25

# CIDR ranges
GHOST_DASHBOARD_IPS=192.168.1.0/24,10.0.0.0/16

# Wildcards
GHOST_DASHBOARD_IPS=192.168.*.*,10.0.0.*
```

### Programmatic Configuration

```javascript
await ghosttrace.init({
  dashboardIpWhitelist: [
    '192.168.1.100',    // Specific IP
    '10.0.0.0/16',      // CIDR range
    '172.16.*.*',       // Wildcard
  ],
});
```

### Common Scenarios

**Office Network Only:**
```env
GHOST_DASHBOARD_IPS=192.168.0.0/16
```

**VPN + Office:**
```env
GHOST_DASHBOARD_IPS=10.8.0.0/24,192.168.1.0/24
```

**Specific Developers:**
```env
GHOST_DASHBOARD_IPS=1.2.3.4,5.6.7.8,9.10.11.12
```

---

## 🚦 Dashboard Rate Limiting

Protect against brute force attacks with rate limiting:

```env
# Max requests per 15 minutes (default: 100)
GHOST_DASHBOARD_RATE_LIMIT=50
```

Or programmatically:

```javascript
await ghosttrace.init({
  dashboardRateLimit: 50,
});
```

**Default:** 100 requests per 15 minutes per IP

---

## 🗄️ Embedded Database (SQLite)

GhostTrace uses **SQLite by default** - no external database needed!

### Default Storage Location

```
./data/ghosttrace.sqlite
```

### Custom Database Path

```env
GHOST_DATA_DIR=./my-data
GHOST_DB_PATH=./my-data/security.db
```

Or programmatically:

```javascript
await ghosttrace.init({
  database: {
    type: 'sqlite',
    storage: './custom/path/ghosttrace.db',
  },
});
```

### Benefits of SQLite

✅ **Zero Configuration** - Works out of the box
✅ **No External Dependencies** - Single file database
✅ **Fast Performance** - Great for most use cases
✅ **Easy Backup** - Just copy the `.sqlite` file
✅ **Portable** - Move between systems easily

### When to Use External Database

Use PostgreSQL or MySQL if you need:
- Multiple GhostTrace instances sharing data
- Advanced replication
- Database-level security
- Extremely high write volumes (100k+ req/sec)

---

## 🔧 Nginx Configuration

### Basic Reverse Proxy

```nginx
server {
    listen 80;
    server_name security.yourcompany.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Forward real client IP
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### With SSL (Let's Encrypt)

```nginx
server {
    listen 443 ssl http2;
    server_name security.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/security.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/security.yourcompany.com/privkey.pem;
    
    # SSL Security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        # IP Whitelist (additional layer)
        allow 192.168.1.0/24;
        allow 10.0.0.0/16;
        deny all;
        
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Forward real client IP
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name security.yourcompany.com;
    return 301 https://$server_name$request_uri;
}
```

### With Additional Security

```nginx
server {
    listen 443 ssl http2;
    server_name security.yourcompany.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/security.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/security.yourcompany.com/privkey.pem;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=dashboard:10m rate=10r/s;
    limit_req zone=dashboard burst=20 nodelay;

    location / {
        # IP Whitelist
        allow 192.168.1.0/24;
        deny all;
        
        # Proxy to GhostTrace
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Forward real client IP (important for GhostTrace IP whitelist)
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### GhostTrace Configuration for Nginx

When behind Nginx, tell GhostTrace to trust proxy headers:

```env
TRUST_PROXY=true
```

Or programmatically:

```javascript
const app = express();
app.set('trust proxy', 1);

await ghosttrace.init();
```

---

## 🔐 Complete Security Setup Example

### 1. GhostTrace Configuration

```env
# .env
GHOST_ADMIN_EMAIL=admin@company.com
GHOST_ADMIN_PASS=secure-password-here

# Dashboard on localhost only (Nginx will proxy)
GHOST_PORT=3001

# Enable if behind Nginx
TRUST_PROXY=true

# IP Whitelist (office + VPN)
GHOST_DASHBOARD_IPS=192.168.1.0/24,10.8.0.0/24

# Rate limiting
GHOST_DASHBOARD_RATE_LIMIT=100

# Embedded database
GHOST_DATA_DIR=./data
```

### 2. Start GhostTrace

```javascript
const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();
app.set('trust proxy', 1); // Behind Nginx

(async () => {
  await ghosttrace.init();
  app.use('/api', ghosttrace.secure());
  
  app.listen(3000);
})();
```

### 3. Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name security.company.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Office network only
    allow 192.168.1.0/24;
    deny all;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## 🧪 Testing Security

### Test IP Whitelist

From allowed IP:
```bash
curl http://localhost:3001/api/soc/command-center
# Should work
```

From blocked IP:
```bash
curl http://your-server:3001/api/soc/command-center
# Should return 403 Forbidden
```

### Test Rate Limit

```bash
# Send many requests quickly
for i in {1..150}; do
  curl http://localhost:3001/login.html
done
# Should hit rate limit after 100 requests
```

### Check SQLite Database

```bash
# View database file
ls -lh ./data/ghosttrace.sqlite

# Query with sqlite3
sqlite3 ./data/ghosttrace.sqlite
> .tables
> SELECT * FROM users;
```

---

## 📊 Monitoring

### Check Who's Accessing Dashboard

GhostTrace logs all blocked access attempts:

```
[GhostTrace] Blocked dashboard access from 1.2.3.4
```

### Dashboard Statistics

In the dashboard, view:
- Failed login attempts
- Rate limit violations
- IP access patterns

---

## 🆘 Troubleshooting

### "Access denied: IP not whitelisted"

**Solution:** Add your IP to whitelist:
```env
GHOST_DASHBOARD_IPS=your.ip.address.here
```

### Can't Access Dashboard Remotely

**Solution:** Either:
1. Set `GHOST_DASHBOARD_PUBLIC=true` (not recommended)
2. Add your IP to whitelist
3. Use VPN to access from whitelisted network

### SQLite Database Locked

**Solution:** Only one process can write to SQLite. Stop other GhostTrace instances or use PostgreSQL:
```env
GHOST_DB_TYPE=postgres
GHOST_DB_HOST=localhost
GHOST_DB_NAME=ghosttrace
# ... other DB settings
```

---

## 📚 Best Practices

1. **✅ Always use IP whitelisting in production**
2. **✅ Run behind Nginx with SSL**
3. **✅ Keep dashboard on localhost unless proxied**
4. **✅ Use strong admin passwords**
5. **✅ Monitor access logs regularly**
6. **✅ Backup SQLite database regularly**
7. **❌ Never set `GHOST_DASHBOARD_PUBLIC=true` without IP whitelist**
8. **❌ Don't expose port 3001 directly to internet**

---

## 🔒 Security Checklist

- [ ] Dashboard is private (not public)
- [ ] IP whitelist configured
- [ ] Strong admin password set
- [ ] Rate limiting enabled
- [ ] Running behind Nginx with SSL
- [ ] `TRUST_PROXY=true` if behind proxy
- [ ] Regular database backups
- [ ] Monitoring access logs
- [ ] Security headers configured
- [ ] Firewall rules in place

---

**Your dashboard is now secure! 🛡️**
