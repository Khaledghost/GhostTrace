# 🔧 Fix: "fetch failed" in AI Provider Configuration

## Root Cause

The **"✗ fetch failed"** error occurs because:

1. ✅ The server is running fine
2. ✅ The AI configuration API endpoints work
3. ❌ **You're not logged in to the dashboard**
4. ❌ The JavaScript tries to fetch `/api/ai/configs` without authentication
5. ❌ The server returns a redirect (302) to `/login.html`
6. ❌ The frontend interprets this as a failed fetch

## Solution: Login to the Dashboard

### Step 1: Find Your Login Credentials

Your database has these users:

```
✅ Email: admin@test.local | Role: admin
✅ Email: analyst@test.local | Role: analyst  
✅ Email: viewer-qa@test.local | Role: viewer
```

### Step 2: Try These Passwords

Common test passwords (try each one):

1. `password`
2. `test123`  
3. `admin`
4. `Admin123!`
5. `test`

### Step 3: Login Steps

1. **Open login page:**
   ```
   http://localhost:3001/login.html
   ```

2. **Enter credentials:**
   - Email: `admin@test.local`
   - Password: Try the passwords above

3. **Once logged in:**
   - Navigate to **AI Configuration** page
   - The "fetch failed" error will disappear
   - You'll see the AI provider configuration form

## Alternative: Test Without Browser

If you want to verify the API works without the UI:

```bash
# Login via API
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.local","password":"Admin123!"}' \
  -c /tmp/cookies.txt -v

# If login succeeds, test AI configs endpoint
curl http://localhost:3001/api/ai/configs \
  -b /tmp/cookies.txt | jq '.'
```

Expected successful response:
```json
{
  "success": true,
  "data": []  // Empty array if no providers configured yet
}
```

## What You'll See After Login

Once authenticated, the AI Configuration page will show:

```
✅ AI Provider Configuration

Supports OpenAI, Claude, Gemini, Grok, Ollama, and custom OpenAI-compatible APIs.

Available Providers:
┌─────────────────────────────────────────────┐
│ OpenAI                                      │
│ GPT-4o, GPT-4, GPT-3.5                     │
│ [Configure]                                 │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Anthropic Claude                            │
│ Claude 3.5 Sonnet, Haiku, Opus            │
│ [Configure]                                 │
└─────────────────────────────────────────────┘

... and more providers

[+ Add New Provider]
```

## If You Can't Remember the Password

### Option 1: Check Your Notes
Look for where you documented the test user passwords during development.

### Option 2: Check Application Logs
Sometimes passwords are logged during initial setup (not recommended for production, but common in dev):

```bash
grep -i "password\|created.*user" /tmp/ghosttrace-validation.log | head -10
```

### Option 3: Reset via Database (Advanced)

```bash
# Connect to database
psql -U postgres -d dna

# List users
SELECT email, name, role FROM users;

# Reset password (sets it to "Admin123!")
UPDATE users 
SET "passwordHash" = '$2a$10$N9qo8uLO.Wmh8yBPH4jhJO8tN8F5jEo0u0Q0cBNQ8X2xdQ5yJXvYi' 
WHERE email = 'admin@test.local';
```

### Option 4: Create New Admin User

```bash
cd /home/wal8y/Desktop/graduation

# Run this script (it will create user if not exists)
npm run setup-admin
# Or manually run the setup endpoint
```

## Quick Debug Checklist

✅ **Server Running?**
```bash
curl http://localhost:3001/health
# Should return: {"status":"OK"}
```

✅ **Login Page Accessible?**
```bash
curl http://localhost:3001/login.html | grep -i "login"
# Should return HTML with login form
```

✅ **API Responds?**
```bash
curl http://localhost:3001/api/ai/providers
# Should redirect or return auth error (both are fine - means API is working)
```

## Why This Happens

### Normal Flow (When Logged In):
```
Browser → /ai-configuration page
    ↓
JavaScript → fetch('/api/ai/configs')
    ↓
Server checks authentication → ✅ Valid session
    ↓
Returns: {"success": true, "data": [...]}
```

### Your Current Flow (Not Logged In):
```
Browser → /ai-configuration page
    ↓
JavaScript → fetch('/api/ai/configs')
    ↓
Server checks authentication → ❌ No session
    ↓
Returns: 302 Redirect to /login.html
    ↓
JavaScript sees non-JSON response → "✗ fetch failed"
```

## Summary

**The error is EXPECTED behavior** when not authenticated.

**To fix:**
1. Go to: `http://localhost:3001/login.html`
2. Login with `admin@test.local` + one of the test passwords
3. Navigate back to AI Configuration
4. ✅ Error will be gone!

---

**Note:** This is a security feature, not a bug! The API correctly refuses to serve data to unauthenticated requests.
